import { MAX_PRECISION, MIN_PRECISION } from './state/app-state.js';
import { useUrlState } from './state/use-url-state.js';

/**
 * App shell wired to the single URL-backed state spine (DECISIONS #006). This
 * currently exposes only the global convention controls and a live state
 * readout; the per-representation input panels (SPEC §4 Phase 1) land on top of
 * this reducer in the next slice.
 */
export function App() {
  const [state, dispatch] = useUrlState();
  const q = state.rotation;

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Transforms Playground</h1>

      <section style={{ display: 'grid', gap: '0.75rem', marginBlock: '1.5rem' }}>
        <label>
          Quaternion order{' '}
          <select
            value={state.quatOrder}
            onChange={(e) =>
              dispatch({ type: 'setQuatOrder', value: e.target.value as 'wxyz' | 'xyzw' })
            }
          >
            <option value="wxyz">w, x, y, z</option>
            <option value="xyzw">x, y, z, w</option>
          </select>
        </label>

        <label>
          Angles{' '}
          <select
            value={state.angleUnit}
            onChange={(e) =>
              dispatch({ type: 'setAngleUnit', value: e.target.value as 'deg' | 'rad' })
            }
          >
            <option value="deg">degrees</option>
            <option value="rad">radians</option>
          </select>
        </label>

        <label>
          Precision{' '}
          <input
            type="number"
            min={MIN_PRECISION}
            max={MAX_PRECISION}
            value={state.precision}
            onChange={(e) => dispatch({ type: 'setPrecision', value: Number(e.target.value) })}
          />
        </label>
      </section>

      <p>Canonical rotation (quaternion hub):</p>
      <pre>{`{ w: ${q.w}, x: ${q.x}, y: ${q.y}, z: ${q.z} }`}</pre>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>
        State is stored in the URL — copy the link to share this exact configuration.
      </p>
    </main>
  );
}
