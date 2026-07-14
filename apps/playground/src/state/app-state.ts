/**
 * Single serializable app-state object and its reducer (DECISIONS #006).
 *
 * The state has exactly one canonical rotation — a quaternion hub (SPEC §2:
 * quaternions are the internal interchange type). Every representation panel
 * converts its own input to a quaternion and dispatches `setRotation`; every
 * panel derives its displayed value back from the same hub. The remaining fields
 * are *display conventions* only — they never change the underlying rotation,
 * only how it is shown (SPEC §2 "UI display is switchable").
 *
 * Everything here is URL-serializable (see url-hash.ts); ephemeral editing state
 * (a half-typed matrix, a non-unit quaternion draft) lives in panel-local React
 * state and is deliberately NOT part of this object (CLAUDE.md rule #6).
 */

import type { EulerFrame, EulerOrder, Quaternion } from 'rigid-kit';
import { IDENTITY_QUATERNION, quat } from 'rigid-kit';

/** How the quaternion components are ordered for display (SPEC §2 toggle). */
export type QuatOrder = 'wxyz' | 'xyzw';

/** Whether angles are shown in degrees or radians (radians are internal). */
export type AngleUnit = 'deg' | 'rad';

/** Number of significant decimals shown (SPEC §4 Phase 1: 3–12, default 6). */
export const MIN_PRECISION = 3;
export const MAX_PRECISION = 12;
export const DEFAULT_PRECISION = 6;

/**
 * The complete shareable application state. `rotation` is the canonical hub;
 * all other fields are display conventions. Immutable — the reducer returns a
 * new object on every change.
 */
export interface AppState {
  /** Canonical rotation, stored as the quaternion the user last committed. */
  readonly rotation: Quaternion;
  /** Quaternion component display order. */
  readonly quatOrder: QuatOrder;
  /** Angle display unit. */
  readonly angleUnit: AngleUnit;
  /** Active Euler sequence for the Euler panel. */
  readonly eulerOrder: EulerOrder;
  /** Active Euler frame (intrinsic/extrinsic) for the Euler panel. */
  readonly eulerFrame: EulerFrame;
  /** Significant decimals shown across all numeric displays. */
  readonly precision: number;
  /** Passive-interpretation display toggle (transposes display only, SPEC §2). */
  readonly passive: boolean;
}

/** The default state: identity rotation, robotics-friendly conventions (SPEC §2). */
export const INITIAL_STATE: AppState = {
  rotation: IDENTITY_QUATERNION,
  quatOrder: 'wxyz',
  angleUnit: 'deg',
  eulerOrder: 'ZYX',
  eulerFrame: 'intrinsic',
  precision: DEFAULT_PRECISION,
  passive: false,
};

/** All state transitions. Rotation edits from any panel funnel to `setRotation`. */
export type Action =
  | { readonly type: 'setRotation'; readonly rotation: Quaternion }
  | { readonly type: 'setQuatOrder'; readonly value: QuatOrder }
  | { readonly type: 'setAngleUnit'; readonly value: AngleUnit }
  | { readonly type: 'setEulerOrder'; readonly value: EulerOrder }
  | { readonly type: 'setEulerFrame'; readonly value: EulerFrame }
  | { readonly type: 'setPrecision'; readonly value: number }
  | { readonly type: 'setPassive'; readonly value: boolean }
  | { readonly type: 'hydrate'; readonly state: AppState };

/** Clamp precision into the supported range without throwing on bad input. */
export function clampPrecision(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PRECISION;
  const i = Math.round(n);
  return Math.min(MAX_PRECISION, Math.max(MIN_PRECISION, i));
}

/** Pure reducer over the single app-state object (DECISIONS #006). */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setRotation':
      return { ...state, rotation: action.rotation };
    case 'setQuatOrder':
      return { ...state, quatOrder: action.value };
    case 'setAngleUnit':
      return { ...state, angleUnit: action.value };
    case 'setEulerOrder':
      return { ...state, eulerOrder: action.value };
    case 'setEulerFrame':
      return { ...state, eulerFrame: action.value };
    case 'setPrecision':
      return { ...state, precision: clampPrecision(action.value) };
    case 'setPassive':
      return { ...state, passive: action.value };
    case 'hydrate':
      return action.state;
    default: {
      // Exhaustiveness guard: a new Action variant must be handled above.
      const _never: never = action;
      return _never;
    }
  }
}

/** Convenience re-export so panels can build a hub quaternion without a deep import. */
export { quat };
