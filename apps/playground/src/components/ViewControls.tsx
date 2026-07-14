/**
 * Controls for the 3D view (SPEC §4 Phase 2): point the probe vector and read
 * where the rotation sends it, toggle the rotation-axis arrow, and scrub/play the
 * identity→target sweep.
 *
 * The probe and axis toggle are shareable state (they live in the URL, rule #6);
 * the sweep is ephemeral view state owned by App (it only animates this view).
 */

import { vec3 } from 'rigid-kit';
import type { Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { formatNumber } from '../format.js';
import { NumberField } from './NumberField.js';

type Axis = 'x' | 'y' | 'z';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
  readonly sweep: number;
  readonly onSweepChange: (value: number) => void;
  readonly playing: boolean;
  readonly onPlay: () => void;
}

const AXES: readonly Axis[] = ['x', 'y', 'z'];

export function ViewControls({
  state,
  views,
  dispatch,
  sweep,
  onSweepChange,
  playing,
  onPlay,
}: Props) {
  const p = state.probe;
  const mapped = views.probeMapped;

  function commitProbe(k: Axis, value: number): void {
    dispatch({
      type: 'setProbe',
      value: vec3(k === 'x' ? value : p.x, k === 'y' ? value : p.y, k === 'z' ? value : p.z),
    });
  }

  const mappedText = `(${AXES.map((k) => formatNumber(mapped[k], state.precision)).join(', ')})`;

  return (
    <section className="view-controls">
      <div className="view-control-group">
        <span className="field-label">probe vector</span>
        <div className="field-row">
          {AXES.map((k) => (
            <label key={k} className="field">
              <span className="field-label">{k}</span>
              <NumberField
                value={p[k]}
                precision={state.precision}
                ariaLabel={`probe ${k}`}
                step={0.1}
                onCommit={(n) => commitProbe(k, n)}
              />
            </label>
          ))}
          <span className="probe-mapped" aria-label="probe maps to">
            → {mappedText}
          </span>
        </div>
      </div>

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={state.showAxis}
          onChange={(e) => dispatch({ type: 'setShowAxis', value: e.target.checked })}
        />
        <span className="field-label">rotation axis</span>
      </label>

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={state.showIntermediates}
          onChange={(e) => dispatch({ type: 'setShowIntermediates', value: e.target.checked })}
        />
        <span className="field-label">intermediate frames</span>
      </label>

      <div className="view-control-group sweep">
        <span className="field-label">sweep (identity → target)</span>
        <div className="field-row">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={sweep}
            aria-label="sweep from identity to target"
            onChange={(e) => onSweepChange(Number(e.target.value))}
          />
          <button type="button" onClick={onPlay} disabled={playing}>
            {playing ? 'Playing…' : 'Play'}
          </button>
        </div>
      </div>
    </section>
  );
}
