/**
 * Tests for rotateVector — the active rotation of a 3-vector by a unit
 * quaternion (v' = R v, SPEC §2). Written before the implementation (CLAUDE.md
 * rule 2): known answers, agreement with the matrix form, and the rotation-group
 * properties (norm preservation, composition, inverse).
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { quat, vec3, type RotMat3, type Vec3 } from '../src/types.js';
import { conjugate, multiply } from '../src/quaternion.js';
import { quaternionToMatrix } from '../src/conversions/quaternion-rotation-matrix.js';
import { rotateVector } from '../src/quaternion.js';
import { expectVec3Close, unitQuaternion } from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;

/** Reference matrix·vector (v' = R v) to check the quaternion form against. */
function applyMatrix(m: RotMat3, v: Vec3): Vec3 {
  return vec3(
    m.m00 * v.x + m.m01 * v.y + m.m02 * v.z,
    m.m10 * v.x + m.m11 * v.y + m.m12 * v.z,
    m.m20 * v.x + m.m21 * v.y + m.m22 * v.z,
  );
}

/** Any finite 3-vector (not necessarily unit) for general-position checks. */
const anyVec3: fc.Arbitrary<Vec3> = fc
  .tuple(
    fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
  )
  .map(([x, y, z]) => vec3(x, y, z));

function norm(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

describe('rotateVector — known answers', () => {
  const zHalf = quat(SQRT1_2, 0, 0, SQRT1_2); // +90° about Z

  it('identity leaves the vector unchanged', () => {
    const v = vec3(0.3, -0.7, 1.2);
    expectVec3Close(rotateVector(quat(1, 0, 0, 0), v), v);
  });

  it('90° about Z sends X̂ to Ŷ', () => {
    expectVec3Close(rotateVector(zHalf, vec3(1, 0, 0)), vec3(0, 1, 0));
  });

  it('90° about Z sends Ŷ to −X̂', () => {
    expectVec3Close(rotateVector(zHalf, vec3(0, 1, 0)), vec3(-1, 0, 0));
  });

  it('90° about Z leaves Ẑ fixed', () => {
    expectVec3Close(rotateVector(zHalf, vec3(0, 0, 1)), vec3(0, 0, 1));
  });
});

describe('rotateVector — properties', () => {
  it('agrees with the rotation-matrix form R v', () => {
    fc.assert(
      fc.property(unitQuaternion, anyVec3, (q, v) => {
        expectVec3Close(rotateVector(q, v), applyMatrix(quaternionToMatrix(q), v), 1e-12);
      }),
    );
  });

  it('preserves vector norm', () => {
    fc.assert(
      fc.property(unitQuaternion, anyVec3, (q, v) => {
        expect(Math.abs(norm(rotateVector(q, v)) - norm(v))).toBeLessThanOrEqual(1e-12);
      }),
    );
  });

  it('composes: R(a⊗b) v = R(a) (R(b) v)', () => {
    fc.assert(
      fc.property(unitQuaternion, unitQuaternion, anyVec3, (a, b, v) => {
        expectVec3Close(
          rotateVector(multiply(a, b), v),
          rotateVector(a, rotateVector(b, v)),
          1e-12,
        );
      }),
    );
  });

  it('inverse recovers the input: R(q*) (R(q) v) = v', () => {
    fc.assert(
      fc.property(unitQuaternion, anyVec3, (q, v) => {
        expectVec3Close(rotateVector(conjugate(q), rotateVector(q, v)), v, 1e-12);
      }),
    );
  });
});
