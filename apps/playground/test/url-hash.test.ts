/**
 * URL-hash round-trip tests (CLAUDE.md rule #6: URL state is the single source
 * of truth, and every serializable field must have a round-trip test).
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EULER_ORDERS, quat } from 'rigid-kit';
import { INITIAL_STATE, type AppState } from '../src/state/app-state.js';
import { parseState, serializeState } from '../src/state/url-hash.js';

/** A finite double with -0 normalized to 0 (serialization can't preserve -0's sign). */
const finite = fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => (n === 0 ? 0 : n));

/** Arbitrary AppState covering every serializable field. */
const arbState: fc.Arbitrary<AppState> = fc.record({
  rotation: fc.tuple(finite, finite, finite, finite).map(([w, x, y, z]) => quat(w, x, y, z)),
  quatOrder: fc.constantFrom('wxyz', 'xyzw'),
  angleUnit: fc.constantFrom('deg', 'rad'),
  eulerOrder: fc.constantFrom(...EULER_ORDERS),
  eulerFrame: fc.constantFrom('intrinsic', 'extrinsic'),
  precision: fc.integer({ min: 3, max: 12 }),
  passive: fc.boolean(),
}) as fc.Arbitrary<AppState>;

describe('url-hash serialize/parse', () => {
  it('round-trips every serializable field exactly', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const restored = parseState(serializeState(state));
        expect(restored).toEqual(state);
        // Quaternion components must survive bit-for-bit (Object.is catches sign).
        expect(Object.is(restored.rotation.w, state.rotation.w)).toBe(true);
        expect(Object.is(restored.rotation.x, state.rotation.x)).toBe(true);
        expect(Object.is(restored.rotation.y, state.rotation.y)).toBe(true);
        expect(Object.is(restored.rotation.z, state.rotation.z)).toBe(true);
      }),
    );
  });

  it('round-trips through a leading "#" (as location.hash provides it)', () => {
    const state: AppState = { ...INITIAL_STATE, precision: 9, passive: true };
    expect(parseState('#' + serializeState(state))).toEqual(state);
  });

  it('falls back to defaults for a missing hash', () => {
    expect(parseState('')).toEqual(INITIAL_STATE);
  });

  it('falls back to defaults for malformed fields but keeps valid ones', () => {
    const parsed = parseState('q=notanumber&qorder=bogus&prec=999&eorder=ZYX');
    expect(parsed.rotation).toEqual(INITIAL_STATE.rotation); // bad quat → default
    expect(parsed.quatOrder).toBe(INITIAL_STATE.quatOrder); // bad enum → default
    expect(parsed.precision).toBe(12); // 999 clamped into range
    expect(parsed.eulerOrder).toBe('ZYX'); // valid value preserved
  });

  it('keeps the quaternion legible (commas not percent-encoded)', () => {
    const s = serializeState(INITIAL_STATE);
    expect(s).toContain('q=1,0,0,0');
  });
});
