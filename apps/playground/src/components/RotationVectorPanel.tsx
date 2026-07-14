/**
 * Rotation-vector (exponential-coordinates) input panel. The vector is axis·angle
 * in radians internally; components are shown scaled to the active angle unit so
 * the vector's magnitude reads as the rotation angle in that unit. Unlike
 * axis–angle it has no zero singularity — the zero vector is exactly identity.
 */

import { rotationVector, rotationVectorToQuaternion } from 'rigid-kit';
import type { Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { formatNumber, radToUnit, unitToRad } from '../format.js';
import { NumberField } from './NumberField.js';
import { Panel } from './Panel.js';
import { commitShown } from './commit.js';

type Axis = 'x' | 'y' | 'z';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
}

export function RotationVectorPanel({ state, views, dispatch }: Props) {
  const r = views.rotationVector;
  const unit = state.angleUnit;

  function commitComponent(k: Axis, displayValue: number): void {
    const rad = unitToRad(displayValue, unit);
    const next = rotationVector(
      k === 'x' ? rad : r.x,
      k === 'y' ? rad : r.y,
      k === 'z' ? rad : r.z,
    );
    commitShown(dispatch, state.passive, rotationVectorToQuaternion(next));
  }

  const unitSuffix = unit === 'deg' ? '°' : 'rad';
  const axes: readonly Axis[] = ['x', 'y', 'z'];
  const copyText = `[${axes
    .map((k) => formatNumber(radToUnit(r[k], unit), state.precision))
    .join(', ')}] ${unit}`;

  return (
    <Panel title="Rotation vector" copyText={copyText}>
      <div className="field-row">
        {axes.map((k) => (
          <label key={k} className="field">
            <span className="field-label">
              {k} ({unitSuffix})
            </span>
            <NumberField
              value={radToUnit(r[k], unit)}
              precision={state.precision}
              ariaLabel={`rotation vector ${k}`}
              onCommit={(n) => commitComponent(k, n)}
            />
          </label>
        ))}
      </div>
    </Panel>
  );
}
