/**
 * Camera-facing text labels for axis tips (SPEC §4 Phase 2: "Frame labels and
 * axis colors follow RGB=XYZ convention"). A label is a Three.js Sprite backed
 * by a canvas texture — cheap, always faces the camera, and needs no font asset
 * (keeps the build static, SPEC §7).
 *
 * Adapter layer only: this is Three.js-specific and lives out of rigid-kit.
 */

import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from 'three';

/**
 * Build a billboarded text label. `color` is any CSS color string; `size` is the
 * sprite's world height (width scales with the text). The canvas is drawn once at
 * creation — labels are static, so there is no per-frame texture work.
 */
export function makeAxisLabel(text: string, color: string, size = 0.22): Sprite {
  const pixels = 128;
  const canvas = document.createElement('canvas');
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, pixels, pixels);
    ctx.fillStyle = color;
    ctx.font = `bold ${pixels * 0.7}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pixels / 2, pixels / 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter; // no mipmaps for a crisp single-glyph label
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(size, size, size);
  return sprite;
}
