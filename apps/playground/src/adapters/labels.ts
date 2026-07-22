/**
 * Camera-facing text labels for axis tips (SPEC §4 Phase 2: "Frame labels and
 * axis colors follow RGB=XYZ convention"). A label is a Three.js Sprite backed
 * by a canvas texture — cheap, always faces the camera, and needs no font asset
 * (keeps the build static, SPEC §7).
 *
 * Adapter layer only: this is Three.js-specific and lives out of rigid-kit.
 */

import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from 'three';

/** Canvas resolution per label. Square: the sprite is scaled uniformly. */
const PIXELS = 128;

/** Text currently baked into each label's canvas, so a redraw is skipped when unchanged. */
const currentText = new WeakMap<Sprite, string>();

/** Draw `text` centred on the label's canvas, sized to fit the square. */
function paint(canvas: HTMLCanvasElement, text: string, color: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, PIXELS, PIXELS);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Single glyphs get the full box; longer names (e.g. "T12⁻¹") shrink to fit,
  // so every label keeps the same world height regardless of its length.
  const scale = text.length <= 1 ? 0.7 : 0.7 / (text.length * 0.62);
  ctx.font = `bold ${PIXELS * scale}px system-ui, sans-serif`;
  ctx.fillText(text, PIXELS / 2, PIXELS / 2);
}

/**
 * Build a billboarded text label. `color` is any CSS color string; `size` is the
 * sprite's world height. The canvas is drawn at creation and only redrawn when
 * `setLabelText` is called with different text — never per frame.
 */
export function makeAxisLabel(text: string, color: string, size = 0.22): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = PIXELS;
  canvas.height = PIXELS;
  paint(canvas, text, color);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter; // no mipmaps for a crisp short label
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(size, size, size);
  currentText.set(sprite, text);
  return sprite;
}

/**
 * Re-letter an existing label in place (CLAUDE.md: mutate, never recreate). The
 * pooled chain-frame labels change text as the chain is edited; repainting the
 * one canvas is far cheaper than rebuilding sprite + texture + material.
 */
export function setLabelText(sprite: Sprite, text: string, color: string): void {
  if (currentText.get(sprite) === text) return;
  const texture = sprite.material.map;
  if (!(texture instanceof CanvasTexture)) return;
  paint(texture.image as HTMLCanvasElement, text, color);
  texture.needsUpdate = true;
  currentText.set(sprite, text);
}
