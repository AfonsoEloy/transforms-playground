/**
 * Tests for the rigid transform (SE(3)) type and its algebra — written before the
 * implementation (CLAUDE.md rule 2).
 *
 * Convention (SPEC §2): a Transform is a homogeneous 4×4 [R | t; 0 1], rotation
 * top-left, translation last column; active, right-handed, column vectors,
 * p' = R p + t. Composition matches the matrix/quaternion order: `composeTransform(a, b)`
 * applies b first, then a (so it equals a·b as 4×4 matrices). All rotations here
 * are unit quaternions, as the rest of rigid-kit assumes.
 *
 * Coverage: known answers (pure translation, pure rotation, mixed), agreement of
 * `transformPoint` with the compose definition, and the group properties
 * (identity, associativity, inverse, chain fold equivalence).
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';

import {
  quat,
  transform,
  vec3,
  IDENTITY_TRANSFORM,
  type Transform,
  type Vec3,
} from '../src/types.js';
import { conjugate } from '../src/quaternion.js';
import {
  composeChain,
  composeTransform,
  invertTransform,
  transformPoint,
} from '../src/transform.js';
import { expectQuatClose, expectVec3Close, unitQuaternion } from './_helpers.js';

const SQRT1_2 = Math.SQRT1_2;
const rot90Z = quat(SQRT1_2, 0, 0, SQRT1_2); // +90° about Z: X̂→Ŷ

/** Any finite translation (not a unit vector). */
const anyVec3: fc.Arbitrary<Vec3> = fc
  .tuple(
    fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
  )
  .map(([x, y, z]) => vec3(x, y, z));

const anyTransform: fc.Arbitrary<Transform> = fc
  .tuple(unitQuaternion, anyVec3)
  .map(([r, t]) => transform(r, t));

/** Compare two transforms as rotation-up-to-sign plus translation. */
function expectTransformClose(a: Transform, b: Transform, tol = 1e-12): void {
  expectQuatClose(a.rotation, b.rotation, tol);
  expectVec3Close(a.translation, b.translation, tol);
}

describe('transform / transformPoint — known answers', () => {
  it('identity maps every point to itself', () => {
    const p = vec3(0.3, -0.7, 1.2);
    expectVec3Close(transformPoint(IDENTITY_TRANSFORM, p), p);
  });

  it('pure translation adds the offset', () => {
    const t = transform(quat(1, 0, 0, 0), vec3(1, 2, 3));
    expectVec3Close(transformPoint(t, vec3(0, 0, 0)), vec3(1, 2, 3));
    expectVec3Close(transformPoint(t, vec3(-1, -2, -3)), vec3(0, 0, 0));
  });

  it('rotation then translation: p′ = R p + t', () => {
    // 90° about Z sends X̂→Ŷ, then shift by +X̂.
    const t = transform(rot90Z, vec3(1, 0, 0));
    expectVec3Close(transformPoint(t, vec3(1, 0, 0)), vec3(1, 1, 0));
  });
});

describe('composeTransform — known answers', () => {
  it('applies the right operand first (a·b)', () => {
    const rot = transform(rot90Z, vec3(0, 0, 0));
    const shift = transform(quat(1, 0, 0, 0), vec3(1, 0, 0));
    // rotate first, then shift: (1,0,0) → (0,1,0) → (1,1,0)
    const rotThenShift = composeTransform(shift, rot);
    expectVec3Close(transformPoint(rotThenShift, vec3(1, 0, 0)), vec3(1, 1, 0));
    // shift first, then rotate: (1,0,0) → (2,0,0) → (0,2,0)
    const shiftThenRot = composeTransform(rot, shift);
    expectVec3Close(transformPoint(shiftThenRot, vec3(1, 0, 0)), vec3(0, 2, 0));
  });

  it('identity is a two-sided unit', () => {
    const t = transform(rot90Z, vec3(4, -1, 2));
    expectTransformClose(composeTransform(IDENTITY_TRANSFORM, t), t);
    expectTransformClose(composeTransform(t, IDENTITY_TRANSFORM), t);
  });
});

describe('transform — properties', () => {
  it('compose agrees with sequential point application', () => {
    fc.assert(
      fc.property(anyTransform, anyTransform, anyVec3, (a, b, p) => {
        expectVec3Close(
          transformPoint(composeTransform(a, b), p),
          transformPoint(a, transformPoint(b, p)),
          1e-9,
        );
      }),
    );
  });

  it('composition is associative', () => {
    fc.assert(
      fc.property(anyTransform, anyTransform, anyTransform, (a, b, c) => {
        expectTransformClose(
          composeTransform(composeTransform(a, b), c),
          composeTransform(a, composeTransform(b, c)),
          1e-9,
        );
      }),
    );
  });

  it('inverse composes to identity on both sides', () => {
    fc.assert(
      fc.property(anyTransform, (t) => {
        const inv = invertTransform(t);
        expectTransformClose(composeTransform(inv, t), IDENTITY_TRANSFORM, 1e-9);
        expectTransformClose(composeTransform(t, inv), IDENTITY_TRANSFORM, 1e-9);
      }),
    );
  });

  it('inverse undoes a mapped point', () => {
    fc.assert(
      fc.property(anyTransform, anyVec3, (t, p) => {
        expectVec3Close(transformPoint(invertTransform(t), transformPoint(t, p)), p, 1e-9);
      }),
    );
  });

  it('invertTransform uses the conjugate rotation', () => {
    fc.assert(
      fc.property(anyTransform, (t) => {
        expectQuatClose(invertTransform(t).rotation, conjugate(t.rotation), 1e-12);
      }),
    );
  });
});

describe('composeChain — fold over an ordered list', () => {
  it('empty chain is the identity', () => {
    expectTransformClose(composeChain([]), IDENTITY_TRANSFORM);
  });

  it('a single element is returned unchanged', () => {
    const t = transform(rot90Z, vec3(1, 2, 3));
    expectTransformClose(composeChain([t]), t);
  });

  it('folds left-to-right, matching nested composeTransform', () => {
    fc.assert(
      fc.property(anyTransform, anyTransform, anyTransform, (a, b, c) => {
        expectTransformClose(
          composeChain([a, b, c]),
          composeTransform(composeTransform(a, b), c),
          1e-9,
        );
      }),
    );
  });

  it('chain application equals applying elements right-to-left', () => {
    fc.assert(
      fc.property(anyTransform, anyTransform, anyVec3, (a, b, p) => {
        expectVec3Close(
          transformPoint(composeChain([a, b]), p),
          transformPoint(a, transformPoint(b, p)),
          1e-9,
        );
      }),
    );
  });
});
