/**
 * URL-hash round-trip tests (CLAUDE.md rule #6: URL state is the single source
 * of truth, and every serializable field must have a round-trip test). The chain
 * carries per-element transform + flags; selection is stored as an index.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EULER_ORDERS, quat, transform, vec3 } from 'rigid-kit';
import {
  INITIAL_STATE,
  makeElement,
  type AppState,
  type ChainElement,
} from '../src/state/app-state.js';
import { parseState, serializeState } from '../src/state/url-hash.js';

/** A finite double with -0 normalized to 0 (serialization can't preserve -0's sign). */
const finite = fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => (n === 0 ? 0 : n));

const arbElementSpec = fc.record({
  r: fc.tuple(finite, finite, finite, finite),
  t: fc.tuple(finite, finite, finite),
  enabled: fc.boolean(),
  inverted: fc.boolean(),
});

/** Arbitrary AppState covering every serializable field (chain ids are index-based). */
const arbState: fc.Arbitrary<AppState> = fc
  .record({
    elements: fc.array(arbElementSpec, { minLength: 1, maxLength: 6 }),
    selFrac: fc.double({ min: 0, max: 0.999, noNaN: true, noDefaultInfinity: true }),
    quatOrder: fc.constantFrom('wxyz', 'xyzw'),
    angleUnit: fc.constantFrom('deg', 'rad'),
    eulerOrder: fc.constantFrom(...EULER_ORDERS),
    eulerFrame: fc.constantFrom('intrinsic', 'extrinsic'),
    precision: fc.integer({ min: 3, max: 12 }),
    passive: fc.boolean(),
    probe: fc.tuple(finite, finite, finite),
    showAxis: fc.boolean(),
    showIntermediates: fc.boolean(),
  })
  .map((r): AppState => {
    const chain = r.elements.map((e, i) =>
      makeElement(String(i), transform(quat(...e.r), vec3(...e.t)), e.enabled, e.inverted),
    );
    const selIndex = Math.min(chain.length - 1, Math.floor(r.selFrac * chain.length));
    return {
      chain,
      selectedId: String(selIndex),
      quatOrder: r.quatOrder as AppState['quatOrder'],
      angleUnit: r.angleUnit as AppState['angleUnit'],
      eulerOrder: r.eulerOrder,
      eulerFrame: r.eulerFrame as AppState['eulerFrame'],
      precision: r.precision,
      passive: r.passive,
      probe: vec3(...r.probe),
      showAxis: r.showAxis,
      showIntermediates: r.showIntermediates,
    };
  });

describe('url-hash serialize/parse', () => {
  it('round-trips every serializable field exactly', () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const restored = parseState(serializeState(state));
        expect(restored).toEqual(state);
        // Every transform component must survive bit-for-bit (Object.is catches sign).
        state.chain.forEach((el, i) => {
          const r: ChainElement = restored.chain[i]!;
          for (const k of ['w', 'x', 'y', 'z'] as const) {
            expect(Object.is(r.transform.rotation[k], el.transform.rotation[k])).toBe(true);
          }
          for (const k of ['x', 'y', 'z'] as const) {
            expect(Object.is(r.transform.translation[k], el.transform.translation[k])).toBe(true);
          }
        });
        expect(Object.is(restored.probe.x, state.probe.x)).toBe(true);
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
    const parsed = parseState('c=bogus&qorder=bad&prec=999&eorder=ZYX');
    expect(parsed.chain).toEqual(INITIAL_STATE.chain); // bad chain → default single identity
    expect(parsed.quatOrder).toBe(INITIAL_STATE.quatOrder); // bad enum → default
    expect(parsed.precision).toBe(12); // 999 clamped into range
    expect(parsed.eulerOrder).toBe('ZYX'); // valid value preserved
  });

  it('clamps an out-of-range selection index to a valid element', () => {
    const parsed = parseState('c=1,0,0,0,0,0,0,1,0;0,0,0,1,0,0,0,1,0&sel=7');
    expect(parsed.chain.length).toBe(2);
    expect(parsed.selectedId).toBe('1'); // clamped to the last element
  });

  it('accepts a legacy single-rotation q= as a one-element chain', () => {
    const parsed = parseState('q=0.5,0.5,0.5,0.5');
    expect(parsed.chain.length).toBe(1);
    expect(parsed.chain[0]!.transform.rotation).toEqual(quat(0.5, 0.5, 0.5, 0.5));
    expect(parsed.chain[0]!.transform.translation).toEqual(vec3(0, 0, 0));
  });

  it('keeps the chain legible (commas and semicolons not percent-encoded)', () => {
    const two: AppState = {
      ...INITIAL_STATE,
      chain: [makeElement('0'), makeElement('1')],
    };
    const s = serializeState(two);
    expect(s).toContain('c=1,0,0,0,0,0,0,1,0;1,0,0,0,0,0,0,1,0');
  });
});
