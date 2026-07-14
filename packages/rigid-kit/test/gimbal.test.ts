import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { euler, EULER_ORDERS } from '../src/types.js';
import { gimbalProximity } from '../src/gimbal.js';

const HALF_PI = Math.PI / 2;

describe('gimbalProximity — Tait–Bryan (distinct axes, singular at ±π/2)', () => {
  it('is 0 when the middle angle is 0 (well away from lock)', () => {
    expect(gimbalProximity(euler(0.3, 0, 0.7, 'ZYX', 'intrinsic'))).toBeCloseTo(0, 12);
  });

  it('is 1 at the +π/2 singularity', () => {
    expect(gimbalProximity(euler(0.3, HALF_PI, 0.7, 'ZYX', 'intrinsic'))).toBeCloseTo(1, 12);
  });

  it('is 1 at the -π/2 singularity', () => {
    expect(gimbalProximity(euler(0.3, -HALF_PI, 0.7, 'XYZ', 'extrinsic'))).toBeCloseTo(1, 12);
  });

  it('grows monotonically as the middle angle approaches π/2', () => {
    const near = gimbalProximity(euler(0, HALF_PI - 0.01, 0, 'ZYX', 'intrinsic'));
    const far = gimbalProximity(euler(0, HALF_PI - 0.5, 0, 'ZYX', 'intrinsic'));
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(0.99);
  });
});

describe('gimbalProximity — proper Euler (repeated axis, singular at 0/π)', () => {
  it('is 1 when the middle angle is 0', () => {
    expect(gimbalProximity(euler(0.3, 0, 0.7, 'ZXZ', 'intrinsic'))).toBeCloseTo(1, 12);
  });

  it('is 1 when the middle angle is π', () => {
    expect(gimbalProximity(euler(0.3, Math.PI, 0.7, 'ZXZ', 'intrinsic'))).toBeCloseTo(1, 12);
  });

  it('is 0 when the middle angle is π/2 (well away from lock)', () => {
    expect(gimbalProximity(euler(0.3, HALF_PI, 0.7, 'ZXZ', 'intrinsic'))).toBeCloseTo(0, 12);
  });
});

describe('gimbalProximity — properties', () => {
  it('always lands in [0, 1] for any order/frame/angle', () => {
    const orderArb = fc.constantFrom(...EULER_ORDERS);
    const frameArb = fc.constantFrom('intrinsic' as const, 'extrinsic' as const);
    const angleArb = fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(angleArb, angleArb, angleArb, orderArb, frameArb, (a1, a2, a3, order, frame) => {
        const p = gimbalProximity(euler(a1, a2, a3, order, frame));
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }),
      { numRuns: 3000 },
    );
  });
});
