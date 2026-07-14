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
  /** Canonicalized quaternion (w ≥ 0), the display form of the hub. */
  readonly quaternion: Quaternion;
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
 */
export function deriveViews(state: AppState): DerivedViews {
  // The rotation actually shown: active as stored, passive = its inverse.
  const shown = state.passive ? conjugate(state.rotation) : state.rotation;

  const euler = quaternionToEuler(shown, state.eulerOrder, state.eulerFrame);
  const proximity = gimbalProximity(euler);

  return {
    quaternion: canonicalize(shown),
    matrix: quaternionToMatrix(shown),
    euler,
    axisAngle: quaternionToAxisAngle(shown),
    rotationVector: quaternionToRotationVector(shown),
    gimbalProximity: proximity,
    nearGimbalLock: proximity >= GIMBAL_WARN_PROXIMITY,
  };
}
