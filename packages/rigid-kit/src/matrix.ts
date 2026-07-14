/**
 * Rotation-matrix diagnostics and explicit repair.
 *
 * Convention (SPEC.md §2): RotMat3 field mIJ is row I, column J (0-indexed);
 * rotations are ACTIVE, right-handed, column-vector, v' = R v. A valid rotation
 * is a member of SO(3): orthonormal columns AND determinant +1.
 *
 * These helpers are the EXPLICIT validation/repair the UI invokes deliberately
 * (CLAUDE.md rule 3) — conversion functions never call them to auto-fix input.
 * Degenerate matrices throw a typed error rather than producing NaN.
 */

import { rotMat3, type RotMat3 } from './types.js';
import { SingularMatrixError } from './errors.js';

// Internal flat layout, row-major: index 3*row + col. Declared here so the
// helper arithmetic below can stay index-based (CLAUDE.md rule 5 permits flat
// arrays in internal code with a declared layout); public APIs use named fields.
type Flat9 = [number, number, number, number, number, number, number, number, number];

function toFlat(m: RotMat3): Flat9 {
  return [m.m00, m.m01, m.m02, m.m10, m.m11, m.m12, m.m20, m.m21, m.m22];
}

function det9(a: Flat9): number {
  return (
    a[0] * (a[4] * a[8] - a[5] * a[7]) -
    a[1] * (a[3] * a[8] - a[5] * a[6]) +
    a[2] * (a[3] * a[7] - a[4] * a[6])
  );
}

/** Determinant of a 3×3 matrix. A proper rotation has determinant +1; a value
 * near −1 signals a reflection (orthonormal but improper). */
export function determinant(m: RotMat3): number {
  return det9(toFlat(m));
}

/**
 * Orthonormality defect ‖MᵀM − I‖_F (Frobenius norm): 0 exactly when the columns
 * are orthonormal, growing with the departure. This is the actionable metric the
 * UI shows next to the "Orthonormalize" action.
 *
 * NOTE: it measures orthonormality only, not handedness — a reflection has
 * MᵀM = I so its error is 0. Check `determinant` for the +1/−1 (proper/improper)
 * distinction.
 */
export function orthonormalityError(m: RotMat3): number {
  // g = MᵀM − I; g_ij = colᵢ · colⱼ − δ_ij. Columns of M:
  const c0x = m.m00,
    c0y = m.m10,
    c0z = m.m20;
  const c1x = m.m01,
    c1y = m.m11,
    c1z = m.m21;
  const c2x = m.m02,
    c2y = m.m12,
    c2z = m.m22;

  const g00 = c0x * c0x + c0y * c0y + c0z * c0z - 1;
  const g11 = c1x * c1x + c1y * c1y + c1z * c1z - 1;
  const g22 = c2x * c2x + c2y * c2y + c2z * c2z - 1;
  const g01 = c0x * c1x + c0y * c1y + c0z * c1z;
  const g02 = c0x * c2x + c0y * c2y + c0z * c2z;
  const g12 = c1x * c2x + c1y * c2y + c1z * c2z;

  // Symmetric, so each off-diagonal is counted twice.
  return Math.sqrt(g00 * g00 + g11 * g11 + g22 * g22 + 2 * (g01 * g01 + g02 * g02 + g12 * g12));
}

/** Inverse of a 3×3 matrix (caller guarantees det ≠ 0). Adjugateᵀ / det. */
function inverse9(a: Flat9, det: number): Flat9 {
  const inv = 1 / det;
  return [
    (a[4] * a[8] - a[5] * a[7]) * inv,
    (a[2] * a[7] - a[1] * a[8]) * inv,
    (a[1] * a[5] - a[2] * a[4]) * inv,
    (a[5] * a[6] - a[3] * a[8]) * inv,
    (a[0] * a[8] - a[2] * a[6]) * inv,
    (a[2] * a[3] - a[0] * a[5]) * inv,
    (a[3] * a[7] - a[4] * a[6]) * inv,
    (a[1] * a[6] - a[0] * a[7]) * inv,
    (a[0] * a[4] - a[1] * a[3]) * inv,
  ];
}

const REPAIR_DET_TOL = 1e-8;
const HIGHAM_MAX_ITERS = 100;
const HIGHAM_CONVERGENCE = 1e-15;

/**
 * Return the nearest proper rotation (in SO(3)) to `m` — the EXPLICIT repair
 * behind the UI's "Orthonormalize (SVD)" action (CLAUDE.md rule 3). Computes the
 * orthogonal polar factor Q of M = Q P via Higham's iteration
 * `Q ← ½(Q + Q⁻ᵀ)`, which converges quadratically to Q; for a proper input Q is
 * exactly the U Vᵀ of the SVD, i.e. the Frobenius-nearest orthogonal matrix.
 *
 * The input must be a non-degenerate proper near-rotation. It throws
 * `SingularMatrixError` when det(M) ≈ 0 (rank-deficient — no orthogonal factor)
 * or det(M) < 0 (a reflection, whose nearest rotation is not a small correction
 * and would require a full SVD to compute honestly). Never returns NaN.
 */
export function orthonormalize(m: RotMat3): RotMat3 {
  let y = toFlat(m);
  const det = det9(y);
  if (Math.abs(det) < REPAIR_DET_TOL) {
    throw new SingularMatrixError(`cannot orthonormalize a rank-deficient matrix (det = ${det})`);
  }
  if (det < 0) {
    throw new SingularMatrixError(
      `cannot orthonormalize a reflection (det = ${det} < 0); nearest rotation needs a full SVD`,
    );
  }

  for (let iter = 0; iter < HIGHAM_MAX_ITERS; iter++) {
    const yInv = inverse9(y, det9(y));
    // next = ½(Y + Y⁻ᵀ). Y⁻ᵀ transposes yInv (swap off-diagonal indices).
    const next: Flat9 = [
      0.5 * (y[0] + yInv[0]),
      0.5 * (y[1] + yInv[3]),
      0.5 * (y[2] + yInv[6]),
      0.5 * (y[3] + yInv[1]),
      0.5 * (y[4] + yInv[4]),
      0.5 * (y[5] + yInv[7]),
      0.5 * (y[6] + yInv[2]),
      0.5 * (y[7] + yInv[5]),
      0.5 * (y[8] + yInv[8]),
    ];
    let maxDiff = 0;
    for (let i = 0; i < 9; i++) maxDiff = Math.max(maxDiff, Math.abs(next[i]! - y[i]!));
    y = next;
    if (maxDiff <= HIGHAM_CONVERGENCE) break;
  }

  return rotMat3(y[0], y[1], y[2], y[3], y[4], y[5], y[6], y[7], y[8]);
}
