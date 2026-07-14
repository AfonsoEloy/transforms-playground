/**
 * Derive every representation from the canonical quaternion hub (SPEC §4 Phase 1:
 * "editing any panel updates all others live"). This is the read side — panels
 * render from `deriveViews(state)`; the write side is each panel converting its
 * own edit back to a quaternion and dispatching `setRotation`.
 *
 * Passive display (SPEC §2): a passive rotation is the inverse of the active one,
 * so when `passive` is set we derive every view from the conjugate quaternion
 * (unit-quaternion inverse). That transposes the matrix and negates the angles —
 * exactly "transposes display only", applied consistently to all representations.
 *
 * Assumes the hub is a unit quaternion; dispatchers maintain that invariant
 * (a user's non-unit draft stays panel-local until normalized).
 */

import {
  canonicalize,
  conjugate,
  IDENTITY_QUATERNION,
  isUnit,
  normalize,
  quatNorm,
  quaternionToAxisAngle,
  quaternionToEuler,
  quaternionToMatrix,
  quaternionToRotationVector,
  gimbalProximity,
  type AxisAngle,
  type EulerAngles,
  type Quaternion,
  type RotationVector,
  type RotMat3,
} from 'rigid-kit';
import type { AppState } from './state/app-state.js';

/**
 * Warn when `gimbalProximity` (0 = clear, 1 = exactly at lock) reaches this. At
 * 0.999 the separable margin |cos a2| (or |sin a2|) is under 1e-3 — the outer two
 * Euler angles are becoming unreliable.
 */
export const GIMBAL_WARN_PROXIMITY = 0.999;

/** All representations of the current rotation, ready for display. */
export interface DerivedViews {
  /** Canonicalized quaternion (w ≥ 0), the display form of the hub as entered. */
  readonly quaternion: Quaternion;
  /** Norm of the (passive-adjusted) hub quaternion — 1 for a valid rotation. */
  readonly quaternionNorm: number;
  /** Whether the hub is unit length (drives the panel's non-unit warning). */
  readonly quaternionIsUnit: boolean;
  /**
   * The unit rotation actually visualized/converted: the (passive-adjusted) hub
   * normalized to unit length. Distinct from `quaternion`, which is the raw
   * display form and may be non-unit while the user is mid-edit. Feed this to the
   * 3D view so it matches the matrix/Euler/axis-angle forms, which derive from it.
   */
  readonly orientation: Quaternion;
  readonly matrix: RotMat3;
  readonly euler: EulerAngles;
  readonly axisAngle: AxisAngle;
  readonly rotationVector: RotationVector;
  /** Proximity to the Euler sequence's singular configuration (0 clear → 1 at lock). */
  readonly gimbalProximity: number;
  /** True when the Euler output is close enough to gimbal lock to be unreliable. */
  readonly nearGimbalLock: boolean;
}

/**
 * Compute all representation views for the given state. Pure: same state in,
 * same views out; no mutation of the hub.
 *
 * The hub may hold a user's NON-UNIT quaternion draft. The matrix/Euler/
 * axis-angle/rotation-vector forms are only defined for a unit quaternion, so we
 * normalize EXPLICITLY here (app-layer display repair, surfaced alongside a
 * non-unit warning in the quaternion panel) before converting — this is not a
 * silent fix inside a rigid-kit conversion (CLAUDE.md rule 3). A degenerate
 * zero-norm hub falls back to identity for the geometric views; the norm warning
 * still tells the user their input was invalid.
 */
export function deriveViews(state: AppState): DerivedViews {
  // The rotation actually shown: active as stored, passive = its inverse.
  const shown = state.passive ? conjugate(state.rotation) : state.rotation;

  const norm = quatNorm(shown);
  const unit = norm > 0 ? normalize(shown) : IDENTITY_QUATERNION;

  const euler = quaternionToEuler(unit, state.eulerOrder, state.eulerFrame);
  const proximity = gimbalProximity(euler);

  return {
    quaternion: canonicalize(shown),
    quaternionNorm: norm,
    quaternionIsUnit: isUnit(shown, 1e-9),
    orientation: unit,
    matrix: quaternionToMatrix(unit),
    euler,
    axisAngle: quaternionToAxisAngle(unit),
    rotationVector: quaternionToRotationVector(unit),
    gimbalProximity: proximity,
    nearGimbalLock: proximity >= GIMBAL_WARN_PROXIMITY,
  };
}
