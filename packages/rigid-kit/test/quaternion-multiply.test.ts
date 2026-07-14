import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { quat, IDENTITY_QUATERNION, type RotMat3 } from '../src/types.js';
import { multiply } from '../src/quaternion.js';
import { quaternionToMatrix } from '../src/conversions/quaternion-rotation-matrix.js';
import { expectQuatClose, unitQuaternion } from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;

/** Matrix product A·B, named fields. */
function matMul(
  A: RotMat3,
  B: RotMat3,
): [number, number, number, number, number, number, number, number, number] {
  return [
    A.m00 * B.m00 + A.m01 * B.m10 + A.m02 * B.m20,
    A.m00 * B.m01 + A.m01 * B.m11 + A.m02 * B.m21,
    A.m00 * B.m02 + A.m01 * B.m12 + A.m02 * B.m22,
    A.m10 * B.m00 + A.m11 * B.m10 + A.m12 * B.m20,
    A.m10 * B.m01 + A.m11 * B.m11 + A.m12 * B.m21,
    A.m10 * B.m02 + A.m11 * B.m12 + A.m12 * B.m22,
    A.m20 * B.m00 + A.m21 * B.m10 + A.m22 * B.m20,
    A.m20 * B.m01 + A.m21 * B.m11 + A.m22 * B.m21,
    A.m20 * B.m02 + A.m21 * B.m12 + A.m22 * B.m22,
  ];
}

describe('multiply — known answers', () => {
  it('q ⊗ identity = identity ⊗ q = q', () => {
    const q = quat(SQRT1_2, 0, 0, SQRT1_2);
    expectQuatClose(multiply(q, IDENTITY_QUATERNION), q);
    expectQuatClose(multiply(IDENTITY_QUATERNION, q), q);
  });

  it('90° about Z composed with itself is 180° about Z', () => {
    const zHalf = quat(SQRT1_2, 0, 0, SQRT1_2); // 90° about Z
    expectQuatClose(multiply(zHalf, zHalf), quat(0, 0, 0, 1)); // 180° about Z
  });
});

describe('property: multiply matches matrix multiplication', () => {
  it('R(a⊗b) = R(a)·R(b)', () => {
    fc.assert(
      fc.property(unitQuaternion, unitQuaternion, (a, b) => {
        const lhs = quaternionToMatrix(multiply(a, b));
        const rhs = matMul(quaternionToMatrix(a), quaternionToMatrix(b));
        const keys = ['m00', 'm01', 'm02', 'm10', 'm11', 'm12', 'm20', 'm21', 'm22'] as const;
        keys.forEach((k, idx) => {
          expect(Math.abs(lhs[k] - rhs[idx]!)).toBeLessThanOrEqual(1e-12);
        });
      }),
      { numRuns: 5000 },
    );
  });

  it('is associative up to sign', () => {
    fc.assert(
      fc.property(unitQuaternion, unitQuaternion, unitQuaternion, (a, b, c) => {
        expectQuatClose(multiply(multiply(a, b), c), multiply(a, multiply(b, c)), 1e-12);
      }),
      { numRuns: 5000 },
    );
  });
});
