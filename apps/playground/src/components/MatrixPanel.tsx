/**
 * Rotation-matrix input panel. A matrix is only a rotation when its columns are
 * orthonormal with determinant +1, so edits accumulate into a local "pending"
 * matrix: as soon as it is orthonormal (and proper) we convert it to the hub;
 * otherwise we show the orthonormality defect and offer an explicit
 * Orthonormalize (SVD/polar) repair (CLAUDE.md rule 3 — never silent). A pure
 * reflection (det < 0) cannot be repaired by a small correction and is reported.
 */

import {
  determinant,
  matrixToQuaternion,
  orthonormalityError,
  orthonormalize,
  rotMat3,
  type RotMat3,
} from 'rigid-kit';
import { useState, type Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { formatNumber } from '../format.js';
import { NumberField } from './NumberField.js';
import { Panel } from './Panel.js';
import { commitShown } from './commit.js';

type MatKey = 'm00' | 'm01' | 'm02' | 'm10' | 'm11' | 'm12' | 'm20' | 'm21' | 'm22';

const ROWS: readonly (readonly MatKey[])[] = [
  ['m00', 'm01', 'm02'],
  ['m10', 'm11', 'm12'],
  ['m20', 'm21', 'm22'],
];

/** Orthonormality defect below this is treated as a clean rotation to convert. */
const ORTHO_TOL = 1e-6;

function withCell(m: RotMat3, key: MatKey, value: number): RotMat3 {
  const v = (k: MatKey): number => (k === key ? value : m[k]);
  return rotMat3(
    v('m00'),
    v('m01'),
    v('m02'),
    v('m10'),
    v('m11'),
    v('m12'),
    v('m20'),
    v('m21'),
    v('m22'),
  );
}

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
}

export function MatrixPanel({ state, views, dispatch }: Props) {
  // Non-null while the user is editing a not-yet-valid rotation matrix.
  const [pending, setPending] = useState<RotMat3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = pending ?? views.matrix;
  const err = orthonormalityError(shown);
  const det = determinant(shown);

  function commitCell(key: MatKey, value: number): void {
    setError(null);
    const candidate = withCell(shown, key, value);
    if (orthonormalityError(candidate) < ORTHO_TOL && determinant(candidate) > 0) {
      commitShown(dispatch, state.passive, matrixToQuaternion(candidate));
      setPending(null);
    } else {
      setPending(candidate);
    }
  }

  function orthonormalizeNow(): void {
    try {
      const repaired = orthonormalize(shown);
      commitShown(dispatch, state.passive, matrixToQuaternion(repaired));
      setPending(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const copyText = ROWS.map((row) =>
    row.map((k) => formatNumber(shown[k], state.precision)).join('  '),
  ).join('\n');

  const dirty = pending !== null;
  const needsRepair = err > ORTHO_TOL || det <= 0;

  const footer = (
    <>
      {needsRepair && (
        <p className="warn">
          Not orthonormal — defect {formatNumber(err, 6)}, det {formatNumber(det, 6)}.{' '}
          <button type="button" className="fix-btn" onClick={orthonormalizeNow}>
            Orthonormalize (SVD)
          </button>
          {dirty && (
            <button type="button" className="fix-btn" onClick={() => setPending(null)}>
              Discard edits
            </button>
          )}
        </p>
      )}
      {error && <p className="warn">{error}</p>}
    </>
  );

  return (
    <Panel title="Rotation matrix" copyText={copyText} footer={footer}>
      <div className="matrix-grid">
        {ROWS.map((row, i) =>
          row.map((k, j) => (
            <NumberField
              key={k}
              value={shown[k]}
              precision={state.precision}
              ariaLabel={`matrix row ${i} col ${j}`}
              onCommit={(n) => commitCell(k, n)}
            />
          )),
        )}
      </div>
    </Panel>
  );
}
