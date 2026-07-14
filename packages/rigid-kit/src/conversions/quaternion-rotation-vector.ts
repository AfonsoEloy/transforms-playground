/**
 * Conversions between unit quaternions and rotation vectors (exponential
 * coordinates): r = θ·n̂, where θ = ‖r‖ is the angle and n̂ = r/‖r‖ the axis.
 *
 * Convention (SPEC.md §2): scalar-first quaternions {w,x,y,z}, ACTIVE rotations,
 * right-handed frames. Unlike axis–angle, the rotation vector has no singularity
 * at the identity — the zero vector maps to (and from) the identity quaternion.
 */

import {
  quat,
  rotationVector,
  IDENTITY_QUATERNION,
  type Quaternion,
  type RotationVector,
} from '../types.js';
import { canonicalize } from '../quaternion.js';

/**
 * Quaternion from a rotation vector. The zero vector is the identity (handled
 * explicitly to avoid 0/0); otherwise q = (cos(θ/2), sin(θ/2)·r/θ) with θ = ‖r‖.
 */
export function rotationVectorToQuaternion(r: RotationVector): Quaternion {
  const angle = Math.hypot(r.x, r.y, r.z);
  if (angle === 0) {
    return IDENTITY_QUATERNION;
  }
  const half = angle / 2;
  // sin(half)/angle scales r (magnitude θ) down to the vector part sin(half)·n̂.
  const s = Math.sin(half) / angle;
  return quat(Math.cos(half), s * r.x, s * r.y, s * r.z);
}

/**
 * Rotation vector from a unit quaternion. Canonicalizes to w ≥ 0 so ‖r‖ = θ lands
 * in [0, π]. At the identity (‖(x,y,z)‖ = 0) the result is the zero vector.
 */
export function quaternionToRotationVector(q: Quaternion): RotationVector {
  const c = canonicalize(q);
  const vNorm = Math.hypot(c.x, c.y, c.z);
  if (vNorm === 0) {
    return rotationVector(0, 0, 0);
  }
  const angle = 2 * Math.atan2(vNorm, c.w);
  // c.{x,y,z} = sin(θ/2)·n̂ and vNorm = sin(θ/2), so angle/vNorm scales to θ·n̂.
  const k = angle / vNorm;
  return rotationVector(k * c.x, k * c.y, k * c.z);
}
