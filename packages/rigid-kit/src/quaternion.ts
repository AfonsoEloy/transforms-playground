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
