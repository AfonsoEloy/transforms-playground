/**
 * Quaternion utilities. All operate on the scalar-first {w,x,y,z} type.
 * Convention: active rotations, right-handed; see types.ts.
 */

import { quat, type Quaternion } from './types.js';
import { ZeroMagnitudeError } from './errors.js';

/** Euclidean norm ‖q‖ = √(w²+x²+y²+z²). */
export function quatNorm(q: Quaternion): number {
  return Math.hypot(q.w, q.x, q.y, q.z);
}

/**
 * Hamilton product `a ⊗ b`. With our active-rotation, `v' = R v` convention the
 * product composes rotations in the SAME order as matrices: if `a` rotates by Rₐ
 * and `b` by R_b, then `multiply(a, b)` rotates by Rₐ·R_b (i.e. apply b first,
 * then a). Not commutative. Does not normalize (unit·unit is already unit).
 */
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return quat(
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  );
}

/**
 * Quaternion conjugate q* = (w, −x, −y, −z): negate the vector part. For a UNIT
 * quaternion this is exactly the inverse rotation (q ⊗ q* = identity), so it is
 * how the UI shows the passive/inverse view (SPEC §2). For a non-unit quaternion
 * it is the conjugate but not the inverse — no normalization happens here
 * (CLAUDE.md rule 3).
 */
export function conjugate(q: Quaternion): Quaternion {
  return quat(q.w, -q.x, -q.y, -q.z);
}

/**
 * Whether q is unit length to within `tol` (absolute error on the norm).
 * Purely diagnostic — conversions never call this to auto-repair.
 */
export function isUnit(q: Quaternion, tol = 1e-12): boolean {
  return Math.abs(quatNorm(q) - 1) <= tol;
}

/**
 * Return a unit quaternion parallel to q. This is the EXPLICIT repair the UI
 * invokes deliberately (CLAUDE.md rule 3) — conversion functions must not call
 * it implicitly. Throws on a zero quaternion, which has no direction.
 */
export function normalize(q: Quaternion): Quaternion {
  const n = quatNorm(q);
  if (n === 0) {
    throw new ZeroMagnitudeError('cannot normalize a zero quaternion (norm = 0)');
  }
  return quat(q.w / n, q.x / n, q.y / n, q.z / n);
}

/**
 * Canonicalize the double-cover sign so w ≥ 0 (SPEC.md §2: q and −q represent
 * the same rotation; we canonicalize on OUTPUT, never on user input). For w = 0
 * the sign is resolved by the first nonzero of x, then y, then z, so the choice
 * is deterministic.
 */
export function canonicalize(q: Quaternion): Quaternion {
  const negative =
    q.w < 0 || (q.w === 0 && (q.x < 0 || (q.x === 0 && (q.y < 0 || (q.y === 0 && q.z < 0)))));
  return negative ? quat(-q.w, -q.x, -q.y, -q.z) : q;
}
