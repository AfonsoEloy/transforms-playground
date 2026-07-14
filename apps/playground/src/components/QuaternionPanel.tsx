/**
 * Quaternion input panel. Fields follow the active display order (wxyz/xyzw,
 * SPEC §2). A non-unit entry is allowed but flagged with its norm and a one-click
 * Normalize (CLAUDE.md rule 3: explicit repair, never silent). Output is
 * canonicalized to w ≥ 0, with a note when that flips the sign of the input.
 */

import { normalize, quat, type Quaternion } from 'rigid-kit';
import type { Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { formatNumber } from '../format.js';
import { quaternionCopyFormats } from '../copy.js';
import { NumberField } from './NumberField.js';
import { Panel } from './Panel.js';
import { commitShown } from './commit.js';

type Component = 'w' | 'x' | 'y' | 'z';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
}

export function QuaternionPanel({ state, views, dispatch }: Props) {
  const q = views.quaternion;
  const order: Component[] =
    state.quatOrder === 'wxyz' ? ['w', 'x', 'y', 'z'] : ['x', 'y', 'z', 'w'];

  function commitComponent(k: Component, value: number): void {
    const next: Quaternion = quat(
      k === 'w' ? value : q.w,
      k === 'x' ? value : q.x,
      k === 'y' ? value : q.y,
      k === 'z' ? value : q.z,
    );
    commitShown(dispatch, state.passive, next);
  }

  const copyFormats = quaternionCopyFormats(q, state.quatOrder, state.precision);

  const footer = (
    <>
      {!views.quaternionIsUnit && (
        <p className="warn">
          Not a unit quaternion — ‖q‖ = {formatNumber(views.quaternionNorm, state.precision)}.{' '}
          <button
            type="button"
            className="fix-btn"
            disabled={views.quaternionNorm === 0}
            onClick={() => commitShown(dispatch, state.passive, normalize(q))}
          >
            Normalize
          </button>
        </p>
      )}
      {state.rotation.w < 0 && <p className="note">Sign canonicalized to w ≥ 0 for display.</p>}
    </>
  );

  return (
    <Panel title="Quaternion" copyFormats={copyFormats} footer={footer}>
      <div className="field-row">
        {order.map((k) => (
          <label key={k} className="field">
            <span className="field-label">{k}</span>
            <NumberField
              value={q[k]}
              precision={state.precision}
              ariaLabel={`quaternion ${k}`}
              onCommit={(n) => commitComponent(k, n)}
            />
          </label>
        ))}
      </div>
    </Panel>
  );
}
