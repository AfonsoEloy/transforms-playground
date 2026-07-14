/**
 * URL-hash (de)serialization — the hash is the single source of truth for all
 * shareable state (DECISIONS #006, CLAUDE.md rule #6).
 *
 * Format is a compact, human-inspectable query string carried in `location.hash`,
 * e.g. `#q=1,0,0,0&qorder=wxyz&unit=deg&eorder=ZYX&frame=intrinsic&prec=6&passive=0`.
 * Quaternion components use the JS default number→string form, which round-trips
 * doubles exactly, so `parse(serialize(state))` reproduces the state bit-for-bit.
 *
 * Parsing is total: unknown/malformed values fall back to INITIAL_STATE defaults
 * rather than throwing, so a hand-edited or truncated URL still loads.
 */

import { EULER_ORDERS, quat, type EulerFrame, type EulerOrder } from 'rigid-kit';
import {
  clampPrecision,
  INITIAL_STATE,
  type AngleUnit,
  type AppState,
  type QuatOrder,
} from './app-state.js';

const QUAT_ORDERS: readonly QuatOrder[] = ['wxyz', 'xyzw'];
const ANGLE_UNITS: readonly AngleUnit[] = ['deg', 'rad'];
const EULER_FRAMES: readonly EulerFrame[] = ['intrinsic', 'extrinsic'];

/** Serialize state into a hash query string (no leading `#`). */
export function serializeState(state: AppState): string {
  const q = state.rotation;
  const params = new URLSearchParams();
  params.set('q', `${q.w},${q.x},${q.y},${q.z}`);
  params.set('qorder', state.quatOrder);
  params.set('unit', state.angleUnit);
  params.set('eorder', state.eulerOrder);
  params.set('frame', state.eulerFrame);
  params.set('prec', String(state.precision));
  params.set('passive', state.passive ? '1' : '0');
  // URLSearchParams percent-encodes commas; decode them back for readability —
  // commas are safe in a fragment and keep the quaternion legible in the bar.
  return params.toString().replace(/%2C/gi, ',');
}

/** Pick `value` if it is a member of `allowed`, else `fallback`. */
function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Parse the four comma-separated quaternion components; null if malformed. */
function parseQuat(raw: string | null): AppState['rotation'] | null {
  if (raw === null) return null;
  const parts = raw.split(',');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [w, x, y, z] = nums as [number, number, number, number];
  return quat(w, x, y, z);
}

/**
 * Parse a hash string (with or without a leading `#`) into an AppState.
 * Any field that is absent or malformed defaults to INITIAL_STATE.
 */
export function parseState(hash: string): AppState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);

  const rotation = parseQuat(params.get('q')) ?? INITIAL_STATE.rotation;
  const precRaw = params.get('prec');
  const precision =
    precRaw !== null && Number.isFinite(Number(precRaw))
      ? clampPrecision(Number(precRaw))
      : INITIAL_STATE.precision;

  return {
    rotation,
    quatOrder: oneOf(params.get('qorder'), QUAT_ORDERS, INITIAL_STATE.quatOrder),
    angleUnit: oneOf(params.get('unit'), ANGLE_UNITS, INITIAL_STATE.angleUnit),
    eulerOrder: oneOf<EulerOrder>(params.get('eorder'), EULER_ORDERS, INITIAL_STATE.eulerOrder),
    eulerFrame: oneOf(params.get('frame'), EULER_FRAMES, INITIAL_STATE.eulerFrame),
    precision,
    passive: params.get('passive') === '1',
  };
}
