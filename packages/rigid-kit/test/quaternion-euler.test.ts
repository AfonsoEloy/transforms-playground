import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { quat, euler, EULER_ORDERS, type EulerFrame } from '../src/types.js';
import { eulerToQuaternion, quaternionToEuler } from '../src/conversions/quaternion-euler.js';
import { expectQuatClose } from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;
const FRAMES: EulerFrame[] = ['intrinsic', 'extrinsic'];

const angle = fc.double({
  min: -Math.PI + 1e-6,
  max: Math.PI - 1e-6,
  noNaN: true,
  noDefaultInfinity: true,
});

// Middle-angle arbitraries kept away from the gimbal singularities, where the
// decomposition is non-unique and inherently ill-conditioned. The interior is
// where the 1e-12 round-trip bar applies; exact singularities are covered by the
// dedicated gimbal tests below (SPEC Phase 1: "gimbal-lock handled without NaN").
const GIMBAL_MARGIN = 0.05;
const taitBryanMiddle = fc.double({
  min: -Math.PI / 2 + GIMBAL_MARGIN,
  max: Math.PI / 2 - GIMBAL_MARGIN,
  noNaN: true,
  noDefaultInfinity: true,
});
const properMiddle = fc.double({
  min: GIMBAL_MARGIN,
  max: Math.PI - GIMBAL_MARGIN,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('eulerToQuaternion — known answers', () => {
  it('intrinsic ZYX, yaw 90° only → 90° about Z', () => {
    const q = eulerToQuaternion(euler(Math.PI / 2, 0, 0, 'ZYX', 'intrinsic'));
    expectQuatClose(q, quat(SQRT1_2, 0, 0, SQRT1_2));
  });

  it('intrinsic ZYX, roll 90° only (a3) → 90° about X', () => {
    const q = eulerToQuaternion(euler(0, 0, Math.PI / 2, 'ZYX', 'intrinsic'));
    expectQuatClose(q, quat(SQRT1_2, SQRT1_2, 0, 0));
  });

  it('identity angles → identity quaternion (all orders/frames)', () => {
    for (const order of EULER_ORDERS) {
      for (const frame of FRAMES) {
        expectQuatClose(eulerToQuaternion(euler(0, 0, 0, order, frame)), quat(1, 0, 0, 0));
      }
    }
  });

  it('intrinsic XYZ(a,b,c) ≡ extrinsic ZYX(c,b,a) (CLAUDE.md gotcha)', () => {
    const a = 0.3;
    const b = -0.7;
    const c = 1.1;
    const intr = eulerToQuaternion(euler(a, b, c, 'XYZ', 'intrinsic'));
    const extr = eulerToQuaternion(euler(c, b, a, 'ZYX', 'extrinsic'));
    expectQuatClose(intr, extr);
  });
});

describe('quaternionToEuler — known answers', () => {
  it('90° about Z, extracted as intrinsic ZYX → (π/2, 0, 0)', () => {
    const e = quaternionToEuler(quat(SQRT1_2, 0, 0, SQRT1_2), 'ZYX', 'intrinsic');
    expect(e.a1).toBeCloseTo(Math.PI / 2, 12);
    expect(e.a2).toBeCloseTo(0, 12);
    expect(e.a3).toBeCloseTo(0, 12);
  });
});

describe('property: euler ↔ quaternion round-trips (all 12 orders × 2 frames)', () => {
  for (const order of EULER_ORDERS) {
    const proper = order[0] === order[2];
    const middle = proper ? properMiddle : taitBryanMiddle;
    for (const frame of FRAMES) {
      it(`${order} ${frame}: e → q → e → q reproduces the rotation`, () => {
        fc.assert(
          fc.property(angle, middle, angle, (a1, a2, a3) => {
            const q = eulerToQuaternion(euler(a1, a2, a3, order, frame));
            const e2 = quaternionToEuler(q, order, frame);
            expect(Number.isNaN(e2.a1 + e2.a2 + e2.a3)).toBe(false);
            expectQuatClose(eulerToQuaternion(e2), q, 1e-12);
          }),
          { numRuns: 2000 },
        );
      });
    }
  }
});

describe('gimbal lock — handled without NaN, still reproduces the rotation', () => {
  it('Tait–Bryan ZYX with pitch = +90°', () => {
    const e = euler(0.3, Math.PI / 2, 0.5, 'ZYX', 'intrinsic');
    const q = eulerToQuaternion(e);
    const e2 = quaternionToEuler(q, 'ZYX', 'intrinsic');
    expect(Number.isNaN(e2.a1 + e2.a2 + e2.a3)).toBe(false);
    expect(e2.a2).toBeCloseTo(Math.PI / 2, 9);
    expectQuatClose(eulerToQuaternion(e2), q, 1e-12);
  });

  it('Tait–Bryan ZYX with pitch = -90°', () => {
    const e = euler(0.9, -Math.PI / 2, -0.2, 'ZYX', 'intrinsic');
    const q = eulerToQuaternion(e);
    const e2 = quaternionToEuler(q, 'ZYX', 'intrinsic');
    expect(Number.isNaN(e2.a1 + e2.a2 + e2.a3)).toBe(false);
    expect(e2.a2).toBeCloseTo(-Math.PI / 2, 9);
    expectQuatClose(eulerToQuaternion(e2), q, 1e-12);
  });

  it('proper ZXZ with second angle = 0', () => {
    const e = euler(0.4, 0, 0.8, 'ZXZ', 'intrinsic');
    const q = eulerToQuaternion(e);
    const e2 = quaternionToEuler(q, 'ZXZ', 'intrinsic');
    expect(Number.isNaN(e2.a1 + e2.a2 + e2.a3)).toBe(false);
    expectQuatClose(eulerToQuaternion(e2), q, 1e-12);
  });

  it('proper ZXZ with second angle = π', () => {
    const e = euler(0.4, Math.PI, 0.8, 'ZXZ', 'intrinsic');
    const q = eulerToQuaternion(e);
    const e2 = quaternionToEuler(q, 'ZXZ', 'intrinsic');
    expect(Number.isNaN(e2.a1 + e2.a2 + e2.a3)).toBe(false);
    expect(e2.a2).toBeCloseTo(Math.PI, 9);
    expectQuatClose(eulerToQuaternion(e2), q, 1e-12);
  });
});
