/**
 * Gimbal-lock proximity for an Euler-angle representation.
 *
 * Convention (SPEC.md §2): angles in radians. Euler extraction becomes singular
 * (the outer two angles stop being separable — "gimbal lock") when the MIDDLE
 * angle hits its degenerate value: ±π/2 for Tait–Bryan sequences (three distinct
 * axes) and 0 or π for proper Euler sequences (first axis repeated). The
 * extraction's conditioning degrades like 1/margin, where
 *   margin = |cos(a2)|  (Tait–Bryan)   or   |sin(a2)|  (proper),
 * so `margin` is exactly the quantity that vanishes at lock.
 */

import { type EulerAngles } from './types.js';

/**
 * Proximity to gimbal lock for `e`, in [0, 1]: 0 well away from any singularity,
 * 1 exactly at it. Returns `1 − margin` (see module doc), so it rises smoothly as
 * the middle angle nears its degenerate value. Diagnostic only — nothing repairs
 * automatically; the UI uses it to warn near-singular Euler output.
 */
export function gimbalProximity(e: EulerAngles): number {
  const proper = e.order[0] === e.order[2];
  const margin = proper ? Math.abs(Math.sin(e.a2)) : Math.abs(Math.cos(e.a2));
  // Clamp guards against tiny floating-point overshoot outside [0, 1].
  return 1 - Math.min(1, Math.max(0, margin));
}
