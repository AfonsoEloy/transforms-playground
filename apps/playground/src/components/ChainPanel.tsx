/**
 * The composition-chain panel (SPEC §4 Phase 3): an ordered list of transforms
 * T1·T2·…·Tn. Selecting a row routes the five representation panels + translation
 * panel to that element. Each row can be toggled on/off (dropped from the product
 * without deletion), inverted, reordered, or removed. The composed result is
 * rendered separately by ChainResult.
 *
 * The chain application order is left-to-right = matrix reading order: T1 is
 * applied LAST, Tn FIRST (a point flows up the list). Read-only summaries here
 * derive from `deriveViews`-style normalization but stay lightweight.
 */

import { normalize, quatNorm, quaternionToAxisAngle, type Transform } from 'rigid-kit';
import type { Dispatch } from 'react';
import type { Action, AppState } from '../state/app-state.js';
import { formatAngle, formatNumber } from '../format.js';

interface Props {
  readonly state: AppState;
  readonly dispatch: Dispatch<Action>;
}

/** A short "rot 90.0°, t=(1, 0, 0)" summary of an element's transform. */
function summarize(t: Transform, state: AppState): string {
  const n = quatNorm(t.rotation);
  const angle = n > 0 ? quaternionToAxisAngle(normalize(t.rotation)).angle : 0;
  const p = t.translation;
  const prec = Math.min(state.precision, 3);
  const tt = `(${formatNumber(p.x, prec)}, ${formatNumber(p.y, prec)}, ${formatNumber(p.z, prec)})`;
  return `rot ${formatAngle(angle, state.angleUnit, Math.min(state.precision, 2))}, t=${tt}`;
}

export function ChainPanel({ state, dispatch }: Props) {
  const { chain, selectedId } = state;
  const last = chain.length - 1;

  return (
    <section className="chain">
      <header className="chain-head">
        <h2>Chain — T1 · T2 · … (T1 applied last)</h2>
        <button type="button" onClick={() => dispatch({ type: 'addElement' })}>
          + Add transform
        </button>
      </header>

      <ol className="chain-list">
        {chain.map((el, i) => {
          const selected = el.id === selectedId;
          return (
            <li
              key={el.id}
              className={`chain-item${selected ? ' selected' : ''}${el.enabled ? '' : ' disabled'}`}
            >
              <button
                type="button"
                className="chain-select"
                aria-pressed={selected}
                onClick={() => dispatch({ type: 'selectElement', id: el.id })}
              >
                <span className="chain-tag">
                  T{i + 1}
                  {el.inverted ? '⁻¹' : ''}
                </span>
                <span className="chain-summary">{summarize(el.transform, state)}</span>
              </button>

              <div className="chain-actions">
                <label className="chain-toggle" title="Include in the product">
                  <input
                    type="checkbox"
                    checked={el.enabled}
                    aria-label={`enable T${i + 1}`}
                    onChange={() => dispatch({ type: 'toggleEnabled', id: el.id })}
                  />
                </label>
                <button
                  type="button"
                  className={el.inverted ? 'active' : ''}
                  aria-pressed={el.inverted}
                  title="Invert this transform"
                  onClick={() => dispatch({ type: 'toggleInverted', id: el.id })}
                >
                  inv
                </button>
                <button
                  type="button"
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => dispatch({ type: 'moveElement', id: el.id, toIndex: i - 1 })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={i === last}
                  onClick={() => dispatch({ type: 'moveElement', id: el.id, toIndex: i + 1 })}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="chain-remove"
                  title="Remove"
                  aria-label={`remove T${i + 1}`}
                  onClick={() => dispatch({ type: 'removeElement', id: el.id })}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
