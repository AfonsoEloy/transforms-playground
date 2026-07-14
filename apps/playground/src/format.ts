/**
 * Display formatting helpers. Pure, no rounding of the underlying math — these
 * only affect how numbers are *shown* (SPEC §3 numerical honesty: enough
 * decimals, user-selectable precision; angles switch deg/rad in the UI only,
 * radians stay authoritative internally).
 */

import type { AngleUnit } from './state/app-state.js';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Fixed-decimal string with `precision` places. -0 is normalized to 0 so a tiny
 * negative underflow never displays as "-0.000000". Trailing zeros are kept so
 * matrix columns line up.
 */
export function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return String(value);
  const s = value.toFixed(precision);
  // A tiny magnitude (or -0) rounds to "-0.000…"; drop the sign so zero shows once.
  return Number(s) === 0 ? s.replace('-', '') : s;
}

/** Convert an internal radian value to the active display unit. */
export function radToUnit(rad: number, unit: AngleUnit): number {
  return unit === 'deg' ? rad * RAD_TO_DEG : rad;
}

/** Convert a display-unit value back to internal radians. */
export function unitToRad(value: number, unit: AngleUnit): number {
  return unit === 'deg' ? value * DEG_TO_RAD : value;
}

/** Format an internal radian angle in the active unit, with a unit suffix. */
export function formatAngle(rad: number, unit: AngleUnit, precision: number): string {
  const shown = formatNumber(radToUnit(rad, unit), precision);
  return unit === 'deg' ? `${shown}°` : `${shown} rad`;
}
