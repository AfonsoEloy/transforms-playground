/**
 * Euler-angle input panel. Sequence (12 orders) and frame (intrinsic/extrinsic)
 * are display conventions on the same hub, so changing them re-extracts the
 * angles without changing the rotation. Angles show in the active unit (deg/rad).
 * Near a singular configuration the panel flags gimbal-lock proximity (SPEC §3).
 */

import {
  EULER_ORDERS,
  euler,
  eulerToQuaternion,
  type EulerFrame,
  type EulerOrder,
} from 'rigid-kit';
import type { Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { formatNumber, radToUnit, unitToRad } from '../format.js';
import { NumberField } from './NumberField.js';
import { Panel } from './Panel.js';
import { commitShown } from './commit.js';

type Slot = 'a1' | 'a2' | 'a3';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
}

export function EulerPanel({ state, views, dispatch }: Props) {
  const e = views.euler;
  const unit = state.angleUnit;

  function commitAngle(slot: Slot, displayValue: number): void {
    const rad = unitToRad(displayValue, unit);
    const next = euler(
      slot === 'a1' ? rad : e.a1,
      slot === 'a2' ? rad : e.a2,
      slot === 'a3' ? rad : e.a3,
      state.eulerOrder,
      state.eulerFrame,
    );
    commitShown(dispatch, state.passive, eulerToQuaternion(next));
  }

  const slots: readonly Slot[] = ['a1', 'a2', 'a3'];
  const unitSuffix = unit === 'deg' ? '°' : 'rad';
  const copyText =
    slots.map((s) => formatNumber(radToUnit(e[s], unit), state.precision)).join(', ') +
    ` (${state.eulerOrder}, ${state.eulerFrame}, ${unit})`;

  const footer = views.nearGimbalLock ? (
    <p className="warn">
      Near gimbal lock (proximity {formatNumber(views.gimbalProximity, 3)}) — the first and third
      angles are ill-conditioned for this sequence.
    </p>
  ) : undefined;

  return (
    <Panel title="Euler angles" copyText={copyText} footer={footer}>
      <div className="field-row wrap">
        <label className="field">
          <span className="field-label">order</span>
          <select
            value={state.eulerOrder}
            onChange={(ev) =>
              dispatch({ type: 'setEulerOrder', value: ev.target.value as EulerOrder })
            }
          >
            {EULER_ORDERS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">frame</span>
          <select
            value={state.eulerFrame}
            onChange={(ev) =>
              dispatch({ type: 'setEulerFrame', value: ev.target.value as EulerFrame })
            }
          >
            <option value="intrinsic">intrinsic</option>
            <option value="extrinsic">extrinsic</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        {slots.map((s, i) => (
          <label key={s} className="field">
            <span className="field-label">
              {state.eulerOrder[i]} ({unitSuffix})
            </span>
            <NumberField
              value={radToUnit(e[s], unit)}
              precision={state.precision}
              ariaLabel={`euler ${s}`}
              onCommit={(n) => commitAngle(s, n)}
            />
          </label>
        ))}
      </div>
    </Panel>
  );
}
