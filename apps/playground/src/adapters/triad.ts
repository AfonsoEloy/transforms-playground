/**
 * An RGB=XYZ coordinate triad as a Three.js Group of three arrows (SPEC §4
 * Phase 2). Authored in our Z-up world coordinates (+X red, +Y green, +Z blue);
 * the world root's fixed correction (adapters/scene-frame.ts) makes +Z render up.
 *
 * Adapter layer only. A triad is created once and then reoriented per frame by
 * setting the returned group's quaternion — never rebuilt (CLAUDE.md: mutate,
 * don't recreate).
 */

import { ArrowHelper, Group, Vector3, type Material } from 'three';
import { makeAxisLabel } from './labels.js';

/** RGB = XYZ: X red, Y green, Z blue (SPEC §4 Phase 2). Hex for Three materials. */
export const AXIS_COLORS = {
  x: 0xe5484d,
  y: 0x2fb865,
  z: 0x3b82f6,
} as const;

/** CSS-string equivalents for the canvas labels. */
const AXIS_LABEL_COLORS = {
  x: '#e5484d',
  y: '#2fb865',
  z: '#3b82f6',
} as const;

const ORIGIN = new Vector3(0, 0, 0);
const DIR_X = new Vector3(1, 0, 0);
const DIR_Y = new Vector3(0, 1, 0);
const DIR_Z = new Vector3(0, 0, 1);

export interface TriadOptions {
  /** Arrow length in world units. */
  readonly length: number;
  /** 0..1 opacity; the static world frame is drawn dimmer than the rotated one. */
  readonly opacity: number;
  /** Whether to attach X/Y/Z tip labels (only the reference frame needs them). */
  readonly labels: boolean;
}

/** Set opacity on a Three material (or material array), enabling transparency. */
function setOpacity(material: Material | Material[], opacity: number): void {
  for (const m of Array.isArray(material) ? material : [material]) {
    m.transparent = true;
    m.opacity = opacity;
  }
}

function makeArrow(dir: Vector3, length: number, color: number, opacity: number): ArrowHelper {
  const headLength = length * 0.18;
  const headWidth = length * 0.11;
  const arrow = new ArrowHelper(dir, ORIGIN, length, color, headLength, headWidth);
  // ArrowHelper exposes its shaft (line) and head (cone) materials separately.
  setOpacity(arrow.line.material, opacity);
  setOpacity(arrow.cone.material, opacity);
  return arrow;
}

/** Build a triad Group. Add it under the world root and set its quaternion to orient it. */
export function buildTriad(options: TriadOptions): Group {
  const { length, opacity, labels } = options;
  const group = new Group();
  group.add(makeArrow(DIR_X, length, AXIS_COLORS.x, opacity));
  group.add(makeArrow(DIR_Y, length, AXIS_COLORS.y, opacity));
  group.add(makeArrow(DIR_Z, length, AXIS_COLORS.z, opacity));

  if (labels) {
    const tip = length * 1.12;
    const lx = makeAxisLabel('X', AXIS_LABEL_COLORS.x);
    lx.position.set(tip, 0, 0);
    const ly = makeAxisLabel('Y', AXIS_LABEL_COLORS.y);
    ly.position.set(0, tip, 0);
    const lz = makeAxisLabel('Z', AXIS_LABEL_COLORS.z);
    lz.position.set(0, 0, tip);
    group.add(lx, ly, lz);
  }

  return group;
}
