import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { quat, IDENTITY_QUATERNION } from '../src/types.js';
import { conjugate, multiply } from '../src/quaternion.js';
import { expectQuatClose, unitQuaternion } from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;

describe('conjugate — known answers', () => {
  it('negates the vector part, keeps the scalar', () => {
    expect(conjugate(quat(0.5, 1, -2, 3))).toEqual(quat(0.5, -1, 2, -3));
  });

  it('leaves the identity unchanged (as a rotation)', () => {
    // conj negates the vector part, producing -0 components; compare as rotations.
    expectQuatClose(conjugate(IDENTITY_QUATERNION), IDENTITY_QUATERNION);
  });

  it('inverts a 90° rotation about Z to −90° about Z', () => {
    const zHalf = quat(SQRT1_2, 0, 0, SQRT1_2); // +90° about Z
    expectQuatClose(conjugate(zHalf), quat(SQRT1_2, 0, 0, -SQRT1_2)); // −90° about Z
  });
});

describe('conjugate — properties', () => {
  it('is an involution: conj(conj(q)) = q', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        expect(conjugate(conjugate(q))).toEqual(q);
      }),
    );
  });

  it('is the inverse for unit quaternions: q ⊗ conj(q) = identity', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        expectQuatClose(multiply(q, conjugate(q)), IDENTITY_QUATERNION, 1e-12);
        expectQuatClose(multiply(conjugate(q), q), IDENTITY_QUATERNION, 1e-12);
      }),
    );
  });
});
