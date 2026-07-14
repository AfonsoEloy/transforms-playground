/**
 * URL-hash (de)serialization — the hash is the single source of truth for all
 * shareable state (DECISIONS #006, CLAUDE.md rule #6).
 *
 * Format is a compact, human-inspectable query string carried in `location.hash`.
 * The composition chain is one `c=` segment: elements separated by `;`, each a
 * comma list `w,x,y,z,tx,ty,tz,enabled,inverted` (numbers use the JS default
 * number→string form, which round-trips doubles exactly). Selection is stored as
 * an INDEX (`sel=`), not an element id — ids are ephemeral React keys, so on parse
 * we re-derive them from position. Example:
 *   #c=1,0,0,0,0,0,0,1,0&sel=0&qorder=wxyz&unit=deg&eorder=ZYX&frame=intrinsic&prec=6
 *
 * Parsing is total: unknown/malformed values fall back to INITIAL_STATE defaults
 * rather than throwing, so a hand-edited or truncated URL still loads. A legacy
 * single-rotation `q=` (pre-chain URLs) is honored as a one-element chain.
 */

import { EULER_ORDERS, quat, transform, vec3, type EulerFrame, type EulerOrder } from 'rigid-kit';
import {
  clampPrecision,
  INITIAL_STATE,
  makeElement,
  type AngleUnit,
  type AppState,
  type ChainElement,
  type QuatOrder,
} from './app-state.js';

const QUAT_ORDERS: readonly QuatOrder[] = ['wxyz', 'xyzw'];
const ANGLE_UNITS: readonly AngleUnit[] = ['deg', 'rad'];
const EULER_FRAMES: readonly EulerFrame[] = ['intrinsic', 'extrinsic'];

/** Serialize one chain element to `w,x,y,z,tx,ty,tz,enabled,inverted`. */
function serializeElement(el: ChainElement): string {
  const { rotation: r, translation: t } = el.transform;
  return [r.w, r.x, r.y, r.z, t.x, t.y, t.z, el.enabled ? 1 : 0, el.inverted ? 1 : 0].join(',');
}

/** Serialize state into a hash query string (no leading `#`). */
export function serializeState(state: AppState): string {
  const params = new URLSearchParams();
  params.set('c', state.chain.map(serializeElement).join(';'));
  const sel = Math.max(
    0,
    state.chain.findIndex((e) => e.id === state.selectedId),
  );
  params.set('sel', String(sel));
  params.set('qorder', state.quatOrder);
  params.set('unit', state.angleUnit);
  params.set('eorder', state.eulerOrder);
  params.set('frame', state.eulerFrame);
  params.set('prec', String(state.precision));
  params.set('passive', state.passive ? '1' : '0');
  const p = state.probe;
  params.set('probe', `${p.x},${p.y},${p.z}`);
  params.set('axis', state.showAxis ? '1' : '0');
  params.set('inter', state.showIntermediates ? '1' : '0');
  // URLSearchParams percent-encodes commas and semicolons; decode them back —
  // both are safe in a fragment and keep the chain legible in the address bar.
  return params.toString().replace(/%2C/gi, ',').replace(/%3B/gi, ';');
}

/** Pick `value` if it is a member of `allowed`, else `fallback`. */
function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Parse one `w,x,y,z,tx,ty,tz,en,inv` element; null if malformed. Id is its index. */
function parseElement(raw: string, index: number): ChainElement | null {
  const parts = raw.split(',');
  if (parts.length !== 9) return null;
  const nums = parts.slice(0, 7).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [w, x, y, z, tx, ty, tz] = nums as [number, number, number, number, number, number, number];
  return makeElement(
    String(index),
    transform(quat(w, x, y, z), vec3(tx, ty, tz)),
    parts[7] === '1',
    parts[8] === '1',
  );
}

/** Parse the `c=` chain; null if absent or nothing valid. */
function parseChain(raw: string | null): ChainElement[] | null {
  if (raw === null) return null;
  const els = raw
    .split(';')
    .map((s, i) => parseElement(s, i))
    .filter((e): e is ChainElement => e !== null);
  return els.length > 0 ? els : null;
}

/** Legacy pre-chain fallback: a single element from a `q=w,x,y,z`. */
function parseLegacyQuat(raw: string | null): ChainElement[] | null {
  if (raw === null) return null;
  const parts = raw.split(',');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [w, x, y, z] = nums as [number, number, number, number];
  return [makeElement('0', transform(quat(w, x, y, z), vec3(0, 0, 0)))];
}

/** Parse the three comma-separated probe components; null if malformed. */
function parseProbe(raw: string | null): AppState['probe'] | null {
  if (raw === null) return null;
  const parts = raw.split(',');
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [x, y, z] = nums as [number, number, number];
  return vec3(x, y, z);
}

/**
 * Parse a hash string (with or without a leading `#`) into an AppState.
 * Any field that is absent or malformed defaults to INITIAL_STATE.
 */
export function parseState(hash: string): AppState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);

  const chain =
    parseChain(params.get('c')) ??
    parseLegacyQuat(params.get('q')) ??
    INITIAL_STATE.chain.map((e) => e); // fresh copy of the default chain

  // Selection is an index into the chain; clamp and map back to an id.
  const selRaw = Number(params.get('sel'));
  const selIndex = Number.isInteger(selRaw) ? Math.min(chain.length - 1, Math.max(0, selRaw)) : 0;
  const selectedId = (chain[selIndex] as ChainElement).id;

  const probe = parseProbe(params.get('probe')) ?? INITIAL_STATE.probe;
  const axisRaw = params.get('axis');
  const showAxis = axisRaw === null ? INITIAL_STATE.showAxis : axisRaw === '1';
  const precRaw = params.get('prec');
  const precision =
    precRaw !== null && Number.isFinite(Number(precRaw))
      ? clampPrecision(Number(precRaw))
      : INITIAL_STATE.precision;

  return {
    chain,
    selectedId,
    quatOrder: oneOf(params.get('qorder'), QUAT_ORDERS, INITIAL_STATE.quatOrder),
    angleUnit: oneOf(params.get('unit'), ANGLE_UNITS, INITIAL_STATE.angleUnit),
    eulerOrder: oneOf<EulerOrder>(params.get('eorder'), EULER_ORDERS, INITIAL_STATE.eulerOrder),
    eulerFrame: oneOf(params.get('frame'), EULER_FRAMES, INITIAL_STATE.eulerFrame),
    precision,
    passive: params.get('passive') === '1',
    probe,
    showAxis,
    showIntermediates: params.get('inter') === '1',
  };
}
