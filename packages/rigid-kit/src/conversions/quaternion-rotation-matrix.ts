/**
 * Conversions between unit quaternions and 3×3 rotation matrices.
 *
 * Convention (SPEC.md §2): scalar-first quaternions {w,x,y,z}, ACTIVE rotations,
 * right-handed frames, column vectors, v' = R v, matrix fields mIJ = row I col J.
 *
 * Neither function normalizes or orthonormalizes its input (CLAUDE.md rule 3):
 * `quaternionToMatrix` assumes ‖q‖ = 1 and `matrixToQuaternion` assumes a proper
 * rotation (orthonormal, det +1). Repair is done explicitly elsewhere via
 * `normalize` / `orthonormalize`.
 */

import { quat, rotMat3, type Quaternion, type RotMat3 } from '../types.js';
import { canonicalize } from '../quaternion.js';

/**
 * Rotation matrix of a unit quaternion. Assumes ‖q‖ = 1; a non-unit quaternion
 * yields a scaled/sheared matrix (by design — we do not silently normalize).
 */
export function quaternionToMatrix(q: Quaternion): RotMat3 {
  const { w, x, y, z } = q;

  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return rotMat3(
    1 - 2 * (yy + zz),
    2 * (xy - wz),
    2 * (xz + wy),
    2 * (xy + wz),
    1 - 2 * (xx + zz),
    2 * (yz - wx),
    2 * (xz - wy),
    2 * (yz + wx),
    1 - 2 * (xx + yy),
  );
}

/**
 * Unit quaternion of a rotation matrix, canonicalized to w ≥ 0.
 *
 * WHY the branching: naïvely recovering w from √(1+trace) and dividing the
 * off-diagonals by 4w loses precision (or divides by ~0) near a 180° rotation,
 * where w → 0. Shepperd's method instead recovers whichever of w,x,y,z is
 * largest — selected by comparing the trace against the diagonal entries — so
 * the pivot we divide by is always ≥ 1/2. This keeps the 180° / gimbal-lock
 * cases NaN-free (CLAUDE.md rule 2, SPEC Phase 1 acceptance).
 */
export function matrixToQuaternion(R: RotMat3): Quaternion {
  const { m00, m01, m02, m10, m11, m12, m20, m21, m22 } = R;
  const trace = m00 + m11 + m22;

  let w: number;
  let x: number;
  let y: number;
  let z: number;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2; // s = 4w
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 >= m11 && m00 >= m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2; // s = 4x
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 >= m22) {
    const s = Math.sqrt(1 - m00 + m11 - m22) * 2; // s = 4y
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 - m00 - m11 + m22) * 2; // s = 4z
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }

  return canonicalize(quat(w, x, y, z));
}
