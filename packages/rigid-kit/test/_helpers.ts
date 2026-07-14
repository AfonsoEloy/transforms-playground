import { expect } from 'vitest';
import fc from 'fast-check';

import { quat, vec3, type Quaternion, type Vec3, type RotMat3 } from '../src/types.js';
import { quatNorm } from '../src/quaternion.js';

const MAT3_KEYS = ['m00', 'm01', 'm02', 'm10', 'm11', 'm12', 'm20', 'm21', 'm22'] as const;

/** Componentwise closeness for 3×3 matrices. */
export function expectMat3Close(a: RotMat3, b: RotMat3, tol = 1e-12): void {
  for (const k of MAT3_KEYS) {
    expect(Math.abs(a[k] - b[k]), k).toBeLessThanOrEqual(tol);
  }
}

/**
 * Compare two quaternions as rotations, i.e. up to the double-cover sign.
 * Align by the dot product rather than by canonicalizing on w: near a 180°
 * rotation w ≈ 0, so a w-based sign choice is unstable and would flip x,y,z for
 * an arbitrarily small perturbation. `q` and `−q` denote the same rotation, so
 * we negate one to match before comparing componentwise.
 */
export function expectQuatClose(a: Quaternion, b: Quaternion, tol = 1e-12): void {
  const dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  const s = dot < 0 ? -1 : 1;
  expect(Math.abs(a.w - s * b.w), 'w').toBeLessThanOrEqual(tol);
  expect(Math.abs(a.x - s * b.x), 'x').toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - s * b.y), 'y').toBeLessThanOrEqual(tol);
  expect(Math.abs(a.z - s * b.z), 'z').toBeLessThanOrEqual(tol);
}

/** Componentwise closeness for 3-vectors (and rotation-vector-like triples). */
export function expectVec3Close(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  tol = 1e-12,
): void {
  expect(Math.abs(a.x - b.x), 'x').toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - b.y), 'y').toBeLessThanOrEqual(tol);
  expect(Math.abs(a.z - b.z), 'z').toBeLessThanOrEqual(tol);
}

const finiteUnit = fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true });

/** fast-check arbitrary for unit quaternions (uniform-ish over the 3-sphere). */
export const unitQuaternion: fc.Arbitrary<Quaternion> = fc
  .tuple(finiteUnit, finiteUnit, finiteUnit, finiteUnit)
  .map(([w, x, y, z]) => quat(w, x, y, z))
  .filter((q) => quatNorm(q) > 1e-3)
  .map((q) => {
    const n = quatNorm(q);
    return quat(q.w / n, q.x / n, q.y / n, q.z / n);
  });

/** fast-check arbitrary for unit 3-vectors (rotation axes). */
export const unitVec3: fc.Arbitrary<Vec3> = fc
  .tuple(finiteUnit, finiteUnit, finiteUnit)
  .filter(([x, y, z]) => Math.hypot(x, y, z) > 1e-3)
  .map(([x, y, z]) => {
    const n = Math.hypot(x, y, z);
    return vec3(x / n, y / n, z / n);
  });

/**
 * Rotation angles strictly inside (0, π). Kept off both endpoints so axis–angle
 * / rotation-vector recovery is unambiguous: at 0 the axis is undefined, at π
 * the axis sign is (both signs name the same rotation).
 */
export const openAngle: fc.Arbitrary<number> = fc.double({
  min: 1e-3,
  max: Math.PI - 1e-3,
  noNaN: true,
  noDefaultInfinity: true,
});
