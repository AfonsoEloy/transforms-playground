/**
 * Axis–angle input panel. The axis is shown as a unit vector; a non-unit axis
 * the user types is normalized explicitly before conversion (the library refuses
 * a non-unit axis rather than silently fixing it — CLAUDE.md rule 3). The angle
 * shows in the active unit. At angle 0 the axis is arbitrary (identity).
 */

import { axisAngle, axisAngleToQuaternion, vec3 } from 'rigid-kit';
import type { Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { radToUnit, unitToRad } from '../format.js';
import { axisAngleCopyFormats } from '../copy.js';
import { NumberField } from './NumberField.js';
import { Panel } from './Panel.js';
import { commitShown } from './commit.js';

type Axis = 'x' | 'y' | 'z';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
}

export function AxisAnglePanel({ state, views, dispatch }: Props) {
  const aa = views.axisAngle;
  const unit = state.angleUnit;

  function commitAxisComponent(k: Axis, value: number): void {
    const raw = vec3(
      k === 'x' ? value : aa.axis.x,
      k === 'y' ? value : aa.axis.y,
      k === 'z' ? value : aa.axis.z,
    );
    const mag = Math.hypot(raw.x, raw.y, raw.z);
    if (mag === 0) return; // undefined axis; keep the last rotation
    const unitAxis = vec3(raw.x / mag, raw.y / mag, raw.z / mag);
    commitShown(dispatch, state.passive, axisAngleToQuaternion(axisAngle(unitAxis, aa.angle)));
  }

  function commitAngle(displayValue: number): void {
    const rad = unitToRad(displayValue, unit);
    commitShown(dispatch, state.passive, axisAngleToQuaternion(axisAngle(aa.axis, rad)));
  }

  const unitSuffix = unit === 'deg' ? '°' : 'rad';
  const axes: readonly Axis[] = ['x', 'y', 'z'];
  const copyFormats = axisAngleCopyFormats(aa, unit, state.precision);

  const footer =
    Math.abs(aa.angle) < 1e-9 ? (
      <p className="note">Angle is 0 — the axis is arbitrary (identity rotation).</p>
    ) : undefined;

  return (
    <Panel title="Axis–angle" copyFormats={copyFormats} footer={footer}>
      <div className="field-row">
        {axes.map((k) => (
          <label key={k} className="field">
            <span className="field-label">n{k}</span>
            <NumberField
              value={aa.axis[k]}
              precision={state.precision}
              ariaLabel={`axis ${k}`}
              step={0.05}
              onCommit={(n) => commitAxisComponent(k, n)}
            />
          </label>
        ))}
        <label className="field">
          <span className="field-label">θ ({unitSuffix})</span>
          <NumberField
            value={radToUnit(aa.angle, unit)}
            precision={state.precision}
            ariaLabel="axis-angle angle"
            onCommit={commitAngle}
          />
        </label>
      </div>
    </Panel>
  );
}
