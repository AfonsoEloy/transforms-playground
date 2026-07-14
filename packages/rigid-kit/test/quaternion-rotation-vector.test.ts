import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { quat, rotationVector, IDENTITY_QUATERNION } from '../src/types.js';
import {
  rotationVectorToQuaternion,
  quaternionToRotationVector,
} from '../src/conversions/quaternion-rotation-vector.js';
import {
  expectQuatClose,
  expectVec3Close,
  unitQuaternion,
  unitVec3,
  openAngle,
} from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;

describe('rotationVectorToQuaternion — known answers', () => {
  it('zero vector → identity quaternion (no NaN)', () => {
    const q = rotationVectorToQuaternion(rotationVector(0, 0, 0));
    expectQuatClose(q, IDENTITY_QUATERNION);
    expect(Number.isNaN(q.w + q.x + q.y + q.z)).toBe(false);
  });

  it('(0, 0, π/2) → 90° about Z', () => {
    const q = rotationVectorToQuaternion(rotationVector(0, 0, Math.PI / 2));
    expectQuatClose(q, quat(SQRT1_2, 0, 0, SQRT1_2));
  });
});

describe('quaternionToRotationVector — known answers', () => {
  it('identity → zero vector', () => {
    expectVec3Close(quaternionToRotationVector(IDENTITY_QUATERNION), rotationVector(0, 0, 0));
  });

  it('90° about Z → (0, 0, π/2)', () => {
    const r = quaternionToRotationVector(quat(SQRT1_2, 0, 0, SQRT1_2));
    expectVec3Close(r, rotationVector(0, 0, Math.PI / 2));
  });
});

describe('property: rotation vector ↔ quaternion', () => {
  it('quat → rotvec → quat recovers the input (up to sign)', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const back = rotationVectorToQuaternion(quaternionToRotationVector(q));
        expectQuatClose(back, q, 1e-12);
      }),
      { numRuns: 10000 },
    );
  });

  it('rotvec with magnitude in (0,π) → quat → rotvec recovers the vector', () => {
    fc.assert(
      fc.property(unitVec3, openAngle, (axis, angle) => {
        const r = rotationVector(axis.x * angle, axis.y * angle, axis.z * angle);
        const back = quaternionToRotationVector(rotationVectorToQuaternion(r));
        expectVec3Close(back, r, 1e-9);
      }),
      { numRuns: 10000 },
    );
  });

  it('recovered rotvec magnitude equals the recovered angle in [0, π]', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const r = quaternionToRotationVector(q);
        const mag = Math.hypot(r.x, r.y, r.z);
        expect(mag).toBeLessThanOrEqual(Math.PI + 1e-12);
      }),
      { numRuns: 10000 },
    );
  });
});
