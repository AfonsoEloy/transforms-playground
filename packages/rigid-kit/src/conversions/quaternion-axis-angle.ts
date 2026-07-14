/**
 * Conversions between unit quaternions and axis–angle.
 *
 * Convention (SPEC.md §2): scalar-first quaternions {w,x,y,z}, ACTIVE rotations,
 * right-handed frames. A unit quaternion is q = (cos(θ/2), sin(θ/2)·n̂) for a
 * rotation of angle θ about unit axis n̂.
 */

import { quat, vec3, axisAngle, type Quaternion, type AxisAngle } from '../types.js';
import { canonicalize } from '../quaternion.js';
import { ZeroMagnitudeError } from '../errors.js';

/**
 * Quaternion from axis–angle. Assumes a UNIT axis (a non-unit axis yields a
 * non-unit quaternion — we do not silently normalize, CLAUDE.md rule 3). Throws
 * `ZeroMagnitudeError` on a zero-length axis, whose rotation is undefined, so
 * the caller gets a typed error instead of a NaN/degenerate quaternion.
 */
export function axisAngleToQuaternion(aa: AxisAngle): Quaternion {
  const { axis, angle } = aa;
  if (axis.x === 0 && axis.y === 0 && axis.z === 0) {
    throw new ZeroMagnitudeError('axis–angle has a zero-length axis; rotation axis is undefined');
  }
  const half = angle / 2;
  const s = Math.sin(half);
  return quat(Math.cos(half), s * axis.x, s * axis.y, s * axis.z);
}

/**
 * Axis–angle from a unit quaternion. Canonicalizes to w ≥ 0 first, so the angle
 * lands in [0, π]. Uses θ = 2·atan2(‖(x,y,z)‖, w) rather than 2·acos(w): atan2 is
 * well-conditioned across the whole range (acos loses precision as w → 1). At the
 * identity the axis is undefined, so we report +X̂ with angle 0.
 */
export function quaternionToAxisAngle(q: Quaternion): AxisAngle {
  const c = canonicalize(q);
  const vNorm = Math.hypot(c.x, c.y, c.z);
  if (vNorm === 0) {
    return axisAngle(vec3(1, 0, 0), 0);
  }
  const angle = 2 * Math.atan2(vNorm, c.w);
  return axisAngle(vec3(c.x / vNorm, c.y / vNorm, c.z / vNorm), angle);
}
