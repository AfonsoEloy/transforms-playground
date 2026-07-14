/**
 * Arrow-key value nudging math (SPEC §4 Phase 4: "arrow-key nudging of values
 * with modifier keys for step size"). Pure and UI-free so it can be unit-tested
 * without a DOM harness; NumberField wires it to ArrowUp/ArrowDown.
 *
 * Modifier convention (matches common editors): Shift makes a coarse step (×10),
 * Alt a fine step (×0.1), no modifier the base step. Shift wins if both are held.
 */

/** Keyboard modifiers that scale the step (subset of a KeyboardEvent). */
export interface NudgeModifiers {
  readonly shift: boolean;
  readonly alt: boolean;
}

/** Step multiplier for the held modifiers: Shift ×10 (coarse), Alt ×0.1 (fine). */
export function nudgeMultiplier(mods: NudgeModifiers): number {
  if (mods.shift) return 10;
  if (mods.alt) return 0.1;
  return 1;
}

/**
 * Nudge `base` by `direction` (+1 up / -1 down) × `step` × the modifier
 * multiplier. The result is cleaned to 12 decimal places so repeated nudges do
 * not accumulate binary-float noise (e.g. 0.1 + 0.2 stays 0.3) — this is display
 * hygiene on a deliberate UI action, not a silent fix inside the math core.
 */
export function computeNudge(
  base: number,
  step: number,
  direction: 1 | -1,
  mods: NudgeModifiers,
): number {
  const delta = direction * step * nudgeMultiplier(mods);
  return Number((base + delta).toFixed(12));
}
