/**
 * Conversions between unit quaternions and Euler angles, for all 12 sequences
 * (6 Tait–Bryan + 6 proper) in both intrinsic and extrinsic frames.
 *
 * Convention (SPEC.md §2): scalar-first quaternions {w,x,y,z}, ACTIVE rotations,
 * right-handed frames, radians. `a1,a2,a3` are the rotations about the first,
 * second, third axis of `order`. Intrinsic = rotate about the moving (new) axis;
 * extrinsic = about the fixed world axes. Intrinsic "ABC" ≡ extrinsic "CBA".
 */

import {
  quat,
  euler,
  type Quaternion,
  type EulerAngles,
  type EulerOrder,
  type EulerFrame,
} from '../types.js';
import { multiply, canonicalize } from '../quaternion.js';

type Axis = 'X' | 'Y' | 'Z';

// Axis label → 0-based index (0=x, 1=y, 2=z), matching the quaternion vector part.
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { X: 0, Y: 1, Z: 2 };

/** Elementary rotation quaternion about a single principal axis. */
function elementaryQuat(axis: Axis, angle: number): Quaternion {
  const h = angle / 2;
  const c = Math.cos(h);
  const s = Math.sin(h);
  switch (axis) {
    case 'X':
      return quat(c, s, 0, 0);
    case 'Y':
      return quat(c, 0, s, 0);
    case 'Z':
      return quat(c, 0, 0, s);
  }
}

/** Wrap an angle to (-π, π]. */
function wrapPi(a: number): number {
  const twoPi = 2 * Math.PI;
  let r = a % twoPi;
  if (r > Math.PI) r -= twoPi;
  else if (r <= -Math.PI) r += twoPi;
  return r;
}

/**
 * Quaternion from Euler angles. Composes the three elementary rotations; for an
 * intrinsic sequence the product runs in listed order (moving-frame rule), for
 * extrinsic it runs reversed (fixed-frame rule). Output canonicalized to w ≥ 0.
 */
export function eulerToQuaternion(e: EulerAngles): Quaternion {
  const a1 = e.order[0] as Axis;
  const a2 = e.order[1] as Axis;
  const a3 = e.order[2] as Axis;
  const q1 = elementaryQuat(a1, e.a1);
  const q2 = elementaryQuat(a2, e.a2);
  const q3 = elementaryQuat(a3, e.a3);
  const q =
    e.frame === 'intrinsic' ? multiply(multiply(q1, q2), q3) : multiply(multiply(q3, q2), q1);
  return canonicalize(q);
}

/**
 * Euler angles from a unit quaternion for a given sequence and frame.
 *
 * Implements the direct, singularity-aware method of Bernardes & Viollet (2022,
 * "Quaternion to Euler angles conversion: A direct, general and computationally
 * efficient method", PLOS ONE): one uniform algorithm for all 24 conventions.
 * Everything goes through `atan2` (never a bare `asin`), so gimbal lock — middle
 * angle at 0/π (proper) or ±π/2 (Tait–Bryan) — is handled without NaN; at a
 * singularity the split between the first and third angle is arbitrary, and we
 * assign the whole determined sum/difference to the first angle (third = 0).
 *
 * Returned ranges: middle angle in [0, π] (proper) or [-π/2, π/2] (Tait–Bryan);
 * outer angles in (-π, π].
 */
export function quaternionToEuler(
  q: Quaternion,
  order: EulerOrder,
  frame: EulerFrame,
): EulerAngles {
  const extrinsic = frame === 'extrinsic';

  // The reduction below is derived for EXTRINSIC sequences. An intrinsic "ABC"
  // is the same rotation as extrinsic "CBA", so for intrinsic we reverse the
  // axis order and route the computed first/third angles back to a3/a1.
  const seq = [
    AXIS_INDEX[order[0] as Axis],
    AXIS_INDEX[order[1] as Axis],
    AXIS_INDEX[order[2] as Axis],
  ] as number[];
  let angleFirst: 0 | 2;
  let angleThird: 0 | 2;
  if (extrinsic) {
    angleFirst = 0;
    angleThird = 2;
  } else {
    seq.reverse();
    angleFirst = 2;
    angleThird = 0;
  }

  const i = seq[0]!;
  const j = seq[1]!;
  let k = seq[2]!;
  const symmetric = i === k;
  // Proper (symmetric) sequences repeat the first axis; replace the third with
  // the remaining axis so (i, j, k) is always a permutation of (0, 1, 2).
  if (symmetric) k = 3 - i - j;

  // Sign of the permutation (i, j, k) relative to (0, 1, 2): +1 even, −1 odd.
  const sign = ((i - j) * (j - k) * (k - i)) / 2;

  // Quaternion components, 0-indexed as [x, y, z, w]. Flat access is internal to
  // the algorithm; the layout is declared here (CLAUDE.md rule 5).
  const comp = [q.x, q.y, q.z, q.w];
  const qw = comp[3]!;
  const qi = comp[i]!;
  const qj = comp[j]!;
  const qk = comp[k]! * sign;

  // Bernardes–Viollet reduction: map (possibly Tait–Bryan) to a common form.
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  if (symmetric) {
    a = qw;
    b = qi;
    c = qj;
    d = qk;
  } else {
    a = qw - qj;
    b = qi + qk;
    c = qj + qw;
    d = qk - qi;
  }

  const angle2 = 2 * Math.atan2(Math.hypot(c, d), Math.hypot(a, b)); // [0, π]
  const halfSum = Math.atan2(b, a);
  const halfDiff = Math.atan2(d, c);

  const angles = [0, 0, 0];
  angles[1] = angle2;
  const SINGULAR_TOL = 1e-7;
  if (angle2 < SINGULAR_TOL) {
    // Middle angle ≈ 0: only (first + third) is determined; fold it into first.
    angles[angleFirst] = 2 * halfSum;
    angles[angleThird] = 0;
  } else if (angle2 > Math.PI - SINGULAR_TOL) {
    // Middle angle ≈ π: only (first − third) = −2·halfDiff is determined (the
    // general branch's first − third), so fold that into first with third = 0.
    angles[angleFirst] = -2 * halfDiff;
    angles[angleThird] = 0;
  } else {
    angles[angleFirst] = halfSum - halfDiff;
    angles[angleThird] = halfSum + halfDiff;
  }

  // Undo the reductions: ε on the third angle, and the π/2 offset for Tait–Bryan.
  if (!symmetric) {
    angles[angleThird] = angles[angleThird]! * sign;
    angles[1] = angles[1]! - Math.PI / 2;
  }

  return euler(wrapPi(angles[0]!), wrapPi(angles[1]!), wrapPi(angles[2]!), order, frame);
}
