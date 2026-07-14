import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { quat, vec3, axisAngle, IDENTITY_QUATERNION, type Quaternion } from '../src/types.js';
import { quatNorm } from '../src/quaternion.js';
import { ZeroMagnitudeError } from '../src/errors.js';
import {
  axisAngleToQuaternion,
  quaternionToAxisAngle,
} from '../src/conversions/quaternion-axis-angle.js';
import {
  expectQuatClose,
  expectVec3Close,
  unitQuaternion,
  unitVec3,
  openAngle,
} from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;

describe('axisAngleToQuaternion — known answers', () => {
  it('angle 0 → identity quaternion (any axis)', () => {
    expectQuatClose(axisAngleToQuaternion(axisAngle(vec3(0, 0, 1), 0)), IDENTITY_QUATERNION);
    expectQuatClose(axisAngleToQuaternion(axisAngle(vec3(1, 0, 0), 0)), IDENTITY_QUATERNION);
  });

  it('90° about +Z → quat(√½, 0, 0, √½)', () => {
    const q = axisAngleToQuaternion(axisAngle(vec3(0, 0, 1), Math.PI / 2));
    expectQuatClose(q, quat(SQRT1_2, 0, 0, SQRT1_2));
  });

  it('180° about +X → quat(0, 1, 0, 0)', () => {
    const q = axisAngleToQuaternion(axisAngle(vec3(1, 0, 0), Math.PI));
    expectQuatClose(q, quat(0, 1, 0, 0));
  });

  it('throws ZeroMagnitudeError on a zero-length axis (never NaN)', () => {
    expect(() => axisAngleToQuaternion(axisAngle(vec3(0, 0, 0), 1))).toThrow(ZeroMagnitudeError);
  });
});

describe('quaternionToAxisAngle — known answers', () => {
  it('identity → angle 0, axis +X by convention', () => {
    const aa = quaternionToAxisAngle(IDENTITY_QUATERNION);
    expect(aa.angle).toBeCloseTo(0, 12);
    expectVec3Close(aa.axis, vec3(1, 0, 0));
  });

  it('quat 90° about Z → axis +Z, angle π/2', () => {
    const aa = quaternionToAxisAngle(quat(SQRT1_2, 0, 0, SQRT1_2));
    expect(aa.angle).toBeCloseTo(Math.PI / 2, 12);
    expectVec3Close(aa.axis, vec3(0, 0, 1));
  });
});

describe('property: axis–angle ↔ quaternion', () => {
  it('quat → axis-angle → quat recovers the input (up to sign)', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const back = axisAngleToQuaternion(quaternionToAxisAngle(q));
        expectQuatClose(back, q, 1e-12);
      }),
      { numRuns: 10000 },
    );
  });

  it('axis-angle (unit axis, angle in (0,π)) → quat → axis-angle recovers axis & angle', () => {
    fc.assert(
      fc.property(unitVec3, openAngle, (axis, angle) => {
        const aa = quaternionToAxisAngle(axisAngleToQuaternion(axisAngle(axis, angle)));
        expect(Math.abs(aa.angle - angle)).toBeLessThanOrEqual(1e-12);
        expectVec3Close(aa.axis, axis, 1e-9);
      }),
      { numRuns: 10000 },
    );
  });

  it('axisAngleToQuaternion of a unit axis is a unit quaternion', () => {
    fc.assert(
      fc.property(unitVec3, openAngle, (axis, angle) => {
        const q: Quaternion = axisAngleToQuaternion(axisAngle(axis, angle));
        expect(Math.abs(quatNorm(q) - 1)).toBeLessThanOrEqual(1e-12);
      }),
      { numRuns: 10000 },
    );
  });

  it('recovered angle is always in [0, π]', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const { angle } = quaternionToAxisAngle(q);
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThanOrEqual(Math.PI + 1e-12);
      }),
      { numRuns: 10000 },
    );
  });
});
