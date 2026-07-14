/**
 * Single serializable app-state object and its reducer (DECISIONS #006).
 *
 * Phase 3 makes a COMPOSITION CHAIN the model (SPEC §4 Phase 3). The state holds
 * an ordered list of rigid `Transform`s; the composed product T1·T2·…·Tn is the
 * canonical rotation+translation everything derives from (the 3D view, the probe,
 * the composed-result readout). Exactly one element is `selectedId` — the five
 * representation panels edit THAT element, so `setRotation`/`setTranslation`
 * target the selection (a single-element chain therefore behaves like the old
 * single-rotation editor).
 *
 * The remaining fields are *display conventions* (they never change any transform,
 * only how it is shown, SPEC §2) plus view settings. Everything here is
 * URL-serializable (see url-hash.ts); ephemeral editing state (a half-typed
 * matrix, a non-unit quaternion draft) lives in panel-local React state and is
 * deliberately NOT part of this object (CLAUDE.md rule #6).
 */

import type { EulerFrame, EulerOrder, Quaternion, Transform, Vec3 } from 'rigid-kit';
import { IDENTITY_TRANSFORM, quat, transform, vec3 } from 'rigid-kit';

/** How the quaternion components are ordered for display (SPEC §2 toggle). */
export type QuatOrder = 'wxyz' | 'xyzw';

/** Whether angles are shown in degrees or radians (radians are internal). */
export type AngleUnit = 'deg' | 'rad';

/** Number of significant decimals shown (SPEC §4 Phase 1: 3–12, default 6). */
export const MIN_PRECISION = 3;
export const MAX_PRECISION = 12;
export const DEFAULT_PRECISION = 6;

/**
 * One link in the composition chain: a rigid transform plus its per-element view
 * flags. `enabled` drops the element from the product without deleting it;
 * `inverted` composes its inverse (SPEC §4 Phase 3 "toggle on/off; invert button
 * per element"). `id` is a stable key for React and selection — it is NOT
 * serialized (the URL carries chain ORDER, and selection as an index).
 */
export interface ChainElement {
  readonly id: string;
  readonly transform: Transform;
  readonly enabled: boolean;
  readonly inverted: boolean;
}

/**
 * Runtime-unique id source for elements the user adds in a session. The `e`
 * prefix keeps these disjoint from the plain-index ids the URL parser assigns on
 * hydrate, so ids never collide when a hydrated chain is then edited.
 */
let idCounter = 0;
export function freshElementId(): string {
  return `e${idCounter++}`;
}

/** Build a chain element, defaulting to an enabled, non-inverted identity. */
export function makeElement(
  id: string,
  t: Transform = IDENTITY_TRANSFORM,
  enabled = true,
  inverted = false,
): ChainElement {
  return { id, transform: t, enabled, inverted };
}

/**
 * The complete shareable application state. `chain`/`selectedId` are the model;
 * all other fields are display conventions or view settings. Immutable — the
 * reducer returns a new object on every change.
 */
export interface AppState {
  /** Ordered composition chain; always at least one element. */
  readonly chain: readonly ChainElement[];
  /** Id of the element the representation panels edit (always a valid element). */
  readonly selectedId: string;
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
  /**
   * The 3D "probe" vector (SPEC §4 Phase 2): a direction the user points to see
   * where the composed rotation sends it. Stored as entered (may be non-unit);
   * the view normalizes it for the arrow. Shareable, so it lives in the URL.
   */
  readonly probe: Vec3;
  /** Whether the rotation-axis arrow is shown in the 3D view (shareable toggle). */
  readonly showAxis: boolean;
  /** Whether each intermediate chain frame is drawn in the 3D scene (SPEC §4 Phase 3). */
  readonly showIntermediates: boolean;
}

/** The default state: one identity element, robotics-friendly conventions (SPEC §2). */
export const INITIAL_STATE: AppState = {
  chain: [makeElement('0')],
  selectedId: '0',
  quatOrder: 'wxyz',
  angleUnit: 'deg',
  eulerOrder: 'ZYX',
  eulerFrame: 'intrinsic',
  precision: DEFAULT_PRECISION,
  passive: false,
  probe: vec3(1, 0, 0),
  showAxis: true,
  showIntermediates: false,
};

/** All state transitions. Rotation/translation edits target the SELECTED element. */
export type Action =
  | { readonly type: 'setRotation'; readonly rotation: Quaternion }
  | { readonly type: 'setTranslation'; readonly translation: Vec3 }
  | { readonly type: 'resetSelected' }
  | { readonly type: 'addElement' }
  | { readonly type: 'removeElement'; readonly id: string }
  | { readonly type: 'selectElement'; readonly id: string }
  | { readonly type: 'moveElement'; readonly id: string; readonly toIndex: number }
  | { readonly type: 'toggleEnabled'; readonly id: string }
  | { readonly type: 'toggleInverted'; readonly id: string }
  | { readonly type: 'setShowIntermediates'; readonly value: boolean }
  | { readonly type: 'setQuatOrder'; readonly value: QuatOrder }
  | { readonly type: 'setAngleUnit'; readonly value: AngleUnit }
  | { readonly type: 'setEulerOrder'; readonly value: EulerOrder }
  | { readonly type: 'setEulerFrame'; readonly value: EulerFrame }
  | { readonly type: 'setPrecision'; readonly value: number }
  | { readonly type: 'setPassive'; readonly value: boolean }
  | { readonly type: 'setProbe'; readonly value: Vec3 }
  | { readonly type: 'setShowAxis'; readonly value: boolean }
  | { readonly type: 'hydrate'; readonly state: AppState };

/** Clamp precision into the supported range without throwing on bad input. */
export function clampPrecision(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PRECISION;
  const i = Math.round(n);
  return Math.min(MAX_PRECISION, Math.max(MIN_PRECISION, i));
}

/** The currently-selected element (falls back to the first — the chain is never empty). */
export function selectedElement(state: AppState): ChainElement {
  return state.chain.find((e) => e.id === state.selectedId) ?? state.chain[0]!;
}

/** Replace the selected element's transform via `fn`, keeping every other field. */
function updateSelected(state: AppState, fn: (t: Transform) => Transform): AppState {
  return {
    ...state,
    chain: state.chain.map((el) =>
      el.id === state.selectedId ? { ...el, transform: fn(el.transform) } : el,
    ),
  };
}

/** Map the element with `id` through `fn`; leave the rest untouched. */
function mapElement(state: AppState, id: string, fn: (el: ChainElement) => ChainElement): AppState {
  return { ...state, chain: state.chain.map((el) => (el.id === id ? fn(el) : el)) };
}

/** Pure reducer over the single app-state object (DECISIONS #006). */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setRotation':
      return updateSelected(state, (t) => transform(action.rotation, t.translation));
    case 'setTranslation':
      return updateSelected(state, (t) => transform(t.rotation, action.translation));
    case 'resetSelected':
      return updateSelected(state, () => IDENTITY_TRANSFORM);
    case 'addElement': {
      const el = makeElement(freshElementId());
      return { ...state, chain: [...state.chain, el], selectedId: el.id };
    }
    case 'removeElement': {
      const idx = state.chain.findIndex((e) => e.id === action.id);
      if (idx === -1) return state;
      const rest = state.chain.filter((e) => e.id !== action.id);
      // Never leave the chain empty: a bare identity element takes its place.
      const chain = rest.length > 0 ? rest : [makeElement(freshElementId())];
      const selectedId =
        state.selectedId === action.id
          ? (chain[Math.min(idx, chain.length - 1)] as ChainElement).id
          : state.selectedId;
      return { ...state, chain, selectedId };
    }
    case 'selectElement':
      return state.chain.some((e) => e.id === action.id)
        ? { ...state, selectedId: action.id }
        : state;
    case 'moveElement': {
      const from = state.chain.findIndex((e) => e.id === action.id);
      if (from === -1) return state;
      const to = Math.min(state.chain.length - 1, Math.max(0, action.toIndex));
      if (to === from) return state;
      const chain = [...state.chain];
      const [moved] = chain.splice(from, 1);
      chain.splice(to, 0, moved as ChainElement);
      return { ...state, chain };
    }
    case 'toggleEnabled':
      return mapElement(state, action.id, (el) => ({ ...el, enabled: !el.enabled }));
    case 'toggleInverted':
      return mapElement(state, action.id, (el) => ({ ...el, inverted: !el.inverted }));
    case 'setShowIntermediates':
      return { ...state, showIntermediates: action.value };
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
    case 'setProbe':
      return { ...state, probe: action.value };
    case 'setShowAxis':
      return { ...state, showAxis: action.value };
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
