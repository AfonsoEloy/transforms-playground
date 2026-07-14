/**
 * The one place the Z-up ↔ Y-up world correction lives (DECISIONS #007,
 * CLAUDE.md gotchas: "Do not 'fix' axes anywhere else").
 *
 * Our world is right-handed Z-up (robotics convention): +Z is up, and every
 * rotation, triad, probe and grid line is authored in those coordinates.
 * Three.js renders Y-up by default. Rather than sprinkle axis swaps through the
 * scene, ALL displayed content lives under a single root group carrying one
 * fixed corrective rotation; the rest of the scene is then authored directly in
 * our Z-up coordinates and simply reads correctly.
 *
 * The correction is a −90° rotation about Three's world X axis, which maps our
 * data axes onto Three's screen axes:
 *   data +Z (up)      → Three +Y (screen up)
 *   data +X (forward) → Three +X (screen right)
 *   data +Y (left)    → Three −Z (out of screen)
 * i.e. a standard robotics view with X toward the viewer's right-forward and Z up.
 */

import { Group, MathUtils } from 'three';

/** The fixed tilt applied to the world root so our +Z points up on screen. */
export const WORLD_TILT_X_RAD = -Math.PI / 2;

/**
 * Create the scene root group carrying the fixed Z-up correction. Add every
 * piece of displayed geometry (triads, grid, probe, axis arrow) as a child of
 * the returned group and author it in our Z-up coordinates; the group makes it
 * render with Z up. This is the only rotation in the app that is NOT the user's
 * rotation data.
 */
export function createWorldRoot(): Group {
  const root = new Group();
  root.name = 'world-root';
  // Rotate about Three's X so our Z becomes screen-up. Set on the Euler directly;
  // this group is never re-oriented after creation.
  root.rotation.x = WORLD_TILT_X_RAD;
  return root;
}

/** Degrees→radians pass-through kept local so scene code needn't import three's MathUtils. */
export const degToRad = MathUtils.degToRad;
