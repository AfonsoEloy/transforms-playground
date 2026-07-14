/**
 * Translation input panel for the selected chain element (SPEC §2 homogeneous
 * transforms: translation is the last column of the 4×4). Unitless components
 * (SPEC §2 "user's choice; meters implied in examples"). Editing writes the
 * selected element's translation; the rotation panels edit its rotation part.
 *
 * Translation has no active/passive transpose, so it is shown as-is regardless of
 * the passive toggle (which is a rotation convention).
 */

import { vec3 } from 'rigid-kit';
import type { Dispatch } from 'react';
import type { DerivedViews } from '../derive.js';
import type { Action, AppState } from '../state/app-state.js';
import { NumberField } from './NumberField.js';
import { Panel } from './Panel.js';

type Axis = 'x' | 'y' | 'z';

interface Props {
  readonly state: AppState;
  readonly views: DerivedViews;
  readonly dispatch: Dispatch<Action>;
}

const AXES: readonly Axis[] = ['x', 'y', 'z'];

export function TranslationPanel({ state, views, dispatch }: Props) {
  const t = views.translation;

  function commitComponent(k: Axis, value: number): void {
    dispatch({
      type: 'setTranslation',
      translation: vec3(k === 'x' ? value : t.x, k === 'y' ? value : t.y, k === 'z' ? value : t.z),
    });
  }

  return (
    <Panel title="Translation">
      <div className="field-row">
        {AXES.map((k) => (
          <label key={k} className="field">
            <span className="field-label">{k}</span>
            <NumberField
              value={t[k]}
              precision={state.precision}
              ariaLabel={`translation ${k}`}
              onCommit={(n) => commitComponent(k, n)}
            />
          </label>
        ))}
      </div>
    </Panel>
  );
}
