/**
 * App shell: global convention controls plus the five representation panels,
 * all driven by the single URL-backed reducer (DECISIONS #006). Every panel
 * reads from one `deriveViews(state)` and writes back through `setRotation`, so
 * editing any representation updates all the others live (SPEC §4 Phase 1).
 */

import { useState } from 'react';
import { IDENTITY_QUATERNION } from 'rigid-kit';
import { deriveViews } from './derive.js';
import { MAX_PRECISION, MIN_PRECISION, type AngleUnit, type QuatOrder } from './state/app-state.js';
import { useUrlState } from './state/use-url-state.js';
import { QuaternionPanel } from './components/QuaternionPanel.js';
import { MatrixPanel } from './components/MatrixPanel.js';
import { EulerPanel } from './components/EulerPanel.js';
import { AxisAnglePanel } from './components/AxisAnglePanel.js';
import { RotationVectorPanel } from './components/RotationVectorPanel.js';

export function App() {
  const [state, dispatch] = useUrlState();
  const views = deriveViews(state);
  const [linkCopied, setLinkCopied] = useState(false);

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1200);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  return (
    <main className="app">
      <header className="app-head">
        <h1>Transforms Playground</h1>
        <p className="tagline">
          Edit any representation — the rest update live. State lives in the URL.
        </p>
      </header>

      <section className="controls">
        <label className="field">
          <span className="field-label">quaternion order</span>
          <select
            value={state.quatOrder}
            onChange={(e) => dispatch({ type: 'setQuatOrder', value: e.target.value as QuatOrder })}
          >
            <option value="wxyz">w, x, y, z</option>
            <option value="xyzw">x, y, z, w</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">angles</span>
          <select
            value={state.angleUnit}
            onChange={(e) => dispatch({ type: 'setAngleUnit', value: e.target.value as AngleUnit })}
          >
            <option value="deg">degrees</option>
            <option value="rad">radians</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">precision</span>
          <input
            type="number"
            min={MIN_PRECISION}
            max={MAX_PRECISION}
            value={state.precision}
            onChange={(e) => dispatch({ type: 'setPrecision', value: Number(e.target.value) })}
          />
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={state.passive}
            onChange={(e) => dispatch({ type: 'setPassive', value: e.target.checked })}
          />
          <span className="field-label">passive (inverse)</span>
        </label>

        <div className="control-actions">
          <button
            type="button"
            onClick={() => dispatch({ type: 'setRotation', rotation: IDENTITY_QUATERNION })}
          >
            Reset
          </button>
          <button type="button" onClick={copyLink}>
            {linkCopied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </section>

      <div className="panels">
        <QuaternionPanel state={state} views={views} dispatch={dispatch} />
        <MatrixPanel state={state} views={views} dispatch={dispatch} />
        <EulerPanel state={state} views={views} dispatch={dispatch} />
        <AxisAnglePanel state={state} views={views} dispatch={dispatch} />
        <RotationVectorPanel state={state} views={views} dispatch={dispatch} />
      </div>
    </main>
  );
}
