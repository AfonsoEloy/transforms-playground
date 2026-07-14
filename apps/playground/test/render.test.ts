/**
 * Render smoke test: mount the full app (all five panels + controls) with the
 * server renderer and assert it produces markup without throwing. This exercises
 * the React wiring — deriveViews feeding every panel, NumberField/Panel — that
 * the pure-logic tests don't cover. No DOM/browser: window is absent here, so
 * useUrlState hydrates from INITIAL_STATE and effects don't run.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App.js';

describe('App render', () => {
  it('renders the full panel tree without throwing', () => {
    const html = renderToString(createElement(App));
    expect(html).toContain('Transforms Playground');
    // Every representation panel is present.
    for (const title of [
      'Quaternion',
      'Rotation matrix',
      'Euler angles',
      'Axis',
      'Rotation vector',
    ]) {
      expect(html).toContain(title);
    }
    // Identity default: quaternion w = 1 shows at the default precision.
    expect(html).toContain('1.000000');
  });
});
