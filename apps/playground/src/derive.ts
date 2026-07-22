/**
 * Derive everything the UI renders from the chain model (SPEC §4 Phase 3).
 *
 * Two things come out of one pure pass:
 *  - the SELECTED element's five representations, which the panels edit; and
 *  - the COMPOSED chain result T1·T2·…·Tn (only the enabled elements, each
 *    inverted if flagged), which drives the 3D view, the probe mapping, and the
 *    composed-result readout — plus the cumulative intermediate frames.
 *
 * Passive display (SPEC §2): a passive rotation is the inverse of the active one,
 * so when `passive` is set every ROTATION view derives from the conjugate
 * quaternion (transpose display only). Translation is not a rotation and is shown
 * as-is. Applied identically to the selected element and the composed result.
 *
 * A rotation may be a NON-UNIT draft (the quaternion panel allows it). The
 * geometric views are only defined for a unit rotation, so we normalize
 * EXPLICITLY here — app-layer display repair surfaced beside the panel's non-unit
 * warning, never a silent fix inside a rigid-kit conversion (CLAUDE.md rule 3).
 */

import {
  canonicalize,
  composeChain,
  conjugate,
  gimbalProximity,
  IDENTITY_QUATERNION,
  invertTransform,
  isUnit,
  normalize,
  quatNorm,
  quaternionToAxisAngle,
  quaternionToEuler,
  quaternionToMatrix,
  quaternionToRotationVector,
  rotateVector,
  transform,
  vec3,
  type AxisAngle,
  type EulerAngles,
  type Quaternion,
  type RotationVector,
  type RotMat3,
  type Transform,
  type Vec3,
} from 'rigid-kit';
import { selectedElement, type AppState } from './state/app-state.js';

/**
 * Warn when `gimbalProximity` (0 = clear, 1 = exactly at lock) reaches this. At
 * 0.999 the separable margin |cos a2| (or |sin a2|) is under 1e-3 — the outer two
 * Euler angles are becoming unreliable.
 */
export const GIMBAL_WARN_PROXIMITY = 0.999;

/** The five rotation representations of one unit orientation, ready for display. */
export interface RotationReps {
  readonly matrix: RotMat3;
  readonly euler: EulerAngles;
  readonly axisAngle: AxisAngle;
  readonly rotationVector: RotationVector;
  /** Proximity to the Euler sequence's singular configuration (0 clear → 1 at lock). */
  readonly gimbalProximity: number;
  /** True when the Euler output is close enough to gimbal lock to be unreliable. */
  readonly nearGimbalLock: boolean;
}

/** The composed chain result T1·…·Tn and its display forms (SPEC §4 Phase 3). */
export interface ComposedResult extends RotationReps {
  /** The raw composed rigid transform (active, not passive-adjusted). */
  readonly transform: Transform;
  /** Unit rotation actually visualized (passive-adjusted): feed to the 3D view. */
  readonly orientation: Quaternion;
  /** Composed translation (last column of the 4×4); shown as-is under passive. */
  readonly translation: Vec3;
  /** Canonicalized (w ≥ 0) composed rotation for the quaternion readout. */
  readonly quaternion: Quaternion;
}

/** All representations of the current state, ready for display. */
export interface DerivedViews {
  /** Canonicalized selected-element quaternion (w ≥ 0), the display form as entered. */
  readonly quaternion: Quaternion;
  /** Norm of the (passive-adjusted) selected quaternion — 1 for a valid rotation. */
  readonly quaternionNorm: number;
  /** Whether the selected quaternion is unit length (drives the non-unit warning). */
  readonly quaternionIsUnit: boolean;
  /** True when canonicalization flipped the shown sign (drives the "w ≥ 0" note). */
  readonly quaternionSignFlipped: boolean;
  /** The selected element's unit orientation (passive-adjusted). */
  readonly orientation: Quaternion;
  readonly matrix: RotMat3;
  readonly euler: EulerAngles;
  readonly axisAngle: AxisAngle;
  readonly rotationVector: RotationVector;
  readonly gimbalProximity: number;
  readonly nearGimbalLock: boolean;
  /** The selected element's translation (edited by the translation panel). */
  readonly translation: Vec3;
  /** The probe direction normalized to unit length (the 3D arrow's direction). */
  readonly probeUnit: Vec3;
  /** Where the COMPOSED rotation sends the unit probe (SPEC §4 Phase 2). */
  readonly probeMapped: Vec3;
  /** The composed chain result (3D view + result readout). */
  readonly composed: ComposedResult;
  /**
   * Cumulative composed frames after each enabled element (post-invert), in chain
   * order — the intermediate frames the 3D scene can draw (SPEC §4 Phase 3).
   */
  readonly frames: readonly Transform[];
  /**
   * Display name for each entry of `frames`, in the same order: the chain-panel
   * label of the element that produced it (`T1`, `T2`, …, with `⁻¹` when the
   * element is inverted). Numbered by CHAIN position, not by position among the
   * enabled elements, so disabling T2 leaves T3 called "T3" in the 3D view.
   */
  readonly frameLabels: readonly string[];
}

/** Unit-length copy of a vector; falls back to +X for a zero vector (no direction). */
function unitOrX(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  return n > 0 ? vec3(v.x / n, v.y / n, v.z / n) : vec3(1, 0, 0);
}

/** Explicit display repair: unit rotation (identity for a zero-norm draft). */
function unitOrIdentity(q: Quaternion): Quaternion {
  const n = quatNorm(q);
  return n > 0 ? normalize(q) : IDENTITY_QUATERNION;
}

/** A transform with its rotation normalized, so composition/inversion stay valid. */
function unitTransform(t: Transform): Transform {
  return transform(unitOrIdentity(t.rotation), t.translation);
}

/** The five rotation representations of an already-unit orientation. */
function rotationReps(
  unitShown: Quaternion,
  order: AppState['eulerOrder'],
  frame: AppState['eulerFrame'],
): RotationReps {
  const euler = quaternionToEuler(unitShown, order, frame);
  const proximity = gimbalProximity(euler);
  return {
    matrix: quaternionToMatrix(unitShown),
    euler,
    axisAngle: quaternionToAxisAngle(unitShown),
    rotationVector: quaternionToRotationVector(unitShown),
    gimbalProximity: proximity,
    nearGimbalLock: proximity >= GIMBAL_WARN_PROXIMITY,
  };
}

/**
 * Compute all views for the given state. Pure: same state in, same views out.
 */
export function deriveViews(state: AppState): DerivedViews {
  // --- selected element (what the panels edit) -------------------------------
  const sel = selectedElement(state);
  const rawRot = sel.transform.rotation;
  const norm = quatNorm(rawRot);
  const shownRaw = state.passive ? conjugate(rawRot) : rawRot;
  const unitSel = unitOrIdentity(shownRaw);
  const selReps = rotationReps(unitSel, state.eulerOrder, state.eulerFrame);

  // --- composed chain result (3D view, probe, readout) -----------------------
  // Keep the chain index alongside each enabled element: the 3D frame names must
  // match the chain panel's numbering, which counts disabled elements too.
  const enabled = state.chain
    .map((element, chainIndex) => ({ element, chainIndex }))
    .filter(({ element }) => element.enabled);
  const resolved = enabled.map(({ element }) => {
    const u = unitTransform(element.transform);
    return element.inverted ? invertTransform(u) : u;
  });
  const composedT = composeChain(resolved);
  const cShownRaw = state.passive ? conjugate(composedT.rotation) : composedT.rotation;
  const cUnit = unitOrIdentity(cShownRaw);
  const cReps = rotationReps(cUnit, state.eulerOrder, state.eulerFrame);

  // Cumulative intermediate frames: composition of the first k resolved elements.
  const frames: Transform[] = [];
  for (let k = 1; k <= resolved.length; k++) {
    frames.push(composeChain(resolved.slice(0, k)));
  }
  const frameLabels = enabled.map(
    ({ element, chainIndex }) => `T${chainIndex + 1}${element.inverted ? '⁻¹' : ''}`,
  );

  const probeUnit = unitOrX(state.probe);

  return {
    quaternion: canonicalize(shownRaw),
    quaternionNorm: norm,
    quaternionIsUnit: isUnit(rawRot, 1e-9),
    quaternionSignFlipped: shownRaw.w < 0,
    orientation: unitSel,
    ...selReps,
    translation: sel.transform.translation,
    probeUnit,
    probeMapped: rotateVector(cUnit, probeUnit),
    composed: {
      transform: composedT,
      orientation: cUnit,
      translation: composedT.translation,
      quaternion: canonicalize(cShownRaw),
      ...cReps,
    },
    frames,
    frameLabels,
  };
}
