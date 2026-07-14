/**
 * Read-only readout of the composed chain result T1·T2·…·Tn (SPEC §4 Phase 3
 * "live composed result"). Shows the composed rotation (as a quaternion in the
 * active display order, with a copy button) and the composed translation. This is
 * what the 3D view visualizes; it updates live as any element or flag changes.
 */

import type { DerivedViews } from '../derive.js';
import type { AppState } from '../state/app-state.js';
import { formatAngle, formatNumber } from '../format.js';
import { quaternionCopyFormats } from '../copy.js';
import { Panel } from './Panel.js';

type Component = 'w' | 'x' | 'y' | 'z';
type Axis = 'x' | 'y' | 'z';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
}

const AXES: readonly Axis[] = ['x', 'y', 'z'];

export function ChainResult({ state, views }: Props) {
  const c = views.composed;
  const order: Component[] =
    state.quatOrder === 'wxyz' ? ['w', 'x', 'y', 'z'] : ['x', 'y', 'z', 'w'];
  const copyFormats = quaternionCopyFormats(c.quaternion, state.quatOrder, state.precision);

  return (
    <Panel title="Composed result" copyFormats={copyFormats}>
      <div className="result-grid">
        <div className="result-row">
          <span className="field-label">quaternion</span>
          <span className="result-values">
            {order.map((k) => (
              <span key={k} className="result-cell">
                <span className="result-key">{k}</span>{' '}
                {formatNumber(c.quaternion[k], state.precision)}
              </span>
            ))}
          </span>
        </div>
        <div className="result-row">
          <span className="field-label">translation</span>
          <span className="result-values">
            {AXES.map((k) => (
              <span key={k} className="result-cell">
                <span className="result-key">{k}</span>{' '}
                {formatNumber(c.translation[k], state.precision)}
              </span>
            ))}
          </span>
        </div>
        <div className="result-row">
          <span className="field-label">rotation</span>
          <span className="result-values">
            {formatAngle(c.axisAngle.angle, state.angleUnit, state.precision)} about (
            {AXES.map((k) => formatNumber(c.axisAngle.axis[k], Math.min(state.precision, 4))).join(
              ', ',
            )}
            )
          </span>
        </div>
      </div>
    </Panel>
  );
}
