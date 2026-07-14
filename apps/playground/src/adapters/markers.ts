/**
 * Single-arrow markers for the 3D view (SPEC §4 Phase 2): the probe direction,
 * where the rotation sends it, and the rotation axis. Each is a Three.js
 * ArrowHelper built once and then re-pointed/re-scaled per frame via
 * `setDirection`/`setLength`/`visible` — never rebuilt (CLAUDE.md).
 *
 * Adapter layer only. Colors are chosen off the RGB=XYZ triad palette so the
 * markers read as distinct overlays rather than another axis.
 */

import { ArrowHelper, Vector3, type ColorRepresentation, type Material } from 'three';

/** Marker colors (kept clear of the red/green/blue axis triad). */
export const MARKER_COLORS = {
  /** The probe direction the user points. */
  probe: 0xf59e0b,
  /** Where the rotation sends the probe. */
  mapped: 0x8b5cf6,
  /** The rotation axis. */
  axis: 0x94a3b8,
} as const;

function setOpacity(material: Material | Material[], opacity: number): void {
  for (const m of Array.isArray(material) ? material : [material]) {
    m.transparent = true;
    m.opacity = opacity;
  }
}

/**
 * Build an arrow marker pointing +X at unit length. Re-point it with
 * `arrow.setDirection(unitVec)` and resize with `arrow.setLength(len, ...)`.
 */
export function buildArrow(color: ColorRepresentation, length: number, opacity = 1): ArrowHelper {
  const arrow = new ArrowHelper(
    new Vector3(1, 0, 0),
    new Vector3(0, 0, 0),
    length,
    color,
    length * 0.16,
    length * 0.1,
  );
  setOpacity(arrow.line.material, opacity);
  setOpacity(arrow.cone.material, opacity);
  return arrow;
}
