/**
 * Adapter-boundary tests (SPEC §4 Phase 2 acceptance: "visual matches numeric").
 * The Three.js boundary is where the two ordering/handedness traps this project
 * fights would bite: scalar-last quaternion order and Y-up vs Z-up. These pin
 * both down with known-answer geometry, mirroring the rigid-kit math tests.
 *
 * Only pure Three.js math classes are exercised here (Quaternion/Vector3/Group/
 * Matrix4) — no WebGL, no DOM — so they run in the plain node test env.
 */

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { quat } from 'rigid-kit';
import { toThreeQuaternion, applyToThreeQuaternion } from '../src/adapters/quaternion.js';
import { createWorldRoot } from '../src/adapters/scene-frame.js';

const SQRT1_2 = Math.SQRT1_2;

function expectVecClose(v: Vector3, x: number, y: number, z: number, tol = 1e-12): void {
  expect(Math.abs(v.x - x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(v.y - y)).toBeLessThanOrEqual(tol);
  expect(Math.abs(v.z - z)).toBeLessThanOrEqual(tol);
}

describe('quaternion adapter — scalar-first {w,x,y,z} → Three (x,y,z,w)', () => {
  it('reorders components onto Three positional order', () => {
    const q = quat(0.1, 0.2, 0.3, 0.4); // w,x,y,z
    const t = toThreeQuaternion(q);
    expect([t.x, t.y, t.z, t.w]).toEqual([0.2, 0.3, 0.4, 0.1]);
  });

  it('90° about Z sends X̂ to Ŷ when applied to a Three vector', () => {
    const zHalf = quat(SQRT1_2, 0, 0, SQRT1_2); // +90° about Z
    const rotated = new Vector3(1, 0, 0).applyQuaternion(toThreeQuaternion(zHalf));
    expectVecClose(rotated, 0, 1, 0);
  });

  it('applyToThreeQuaternion writes in place and matches the fresh conversion', () => {
    const q = quat(SQRT1_2, 0, SQRT1_2, 0);
    const fresh = toThreeQuaternion(q);
    const target = toThreeQuaternion(quat(1, 0, 0, 0));
    const returned = applyToThreeQuaternion(q, target);
    expect(returned).toBe(target);
    expect([target.x, target.y, target.z, target.w]).toEqual([fresh.x, fresh.y, fresh.z, fresh.w]);
  });
});

describe('scene-frame — the single Z-up correction (DECISIONS #007)', () => {
  it('maps our data +Z (up) onto Three +Y (screen up)', () => {
    const root = createWorldRoot();
    root.updateMatrixWorld(true);
    const up = new Vector3(0, 0, 1).applyMatrix4(root.matrixWorld);
    expectVecClose(up, 0, 1, 0);
  });

  it('maps our data +Y onto Three −Z (into the screen)', () => {
    const root = createWorldRoot();
    root.updateMatrixWorld(true);
    const left = new Vector3(0, 1, 0).applyMatrix4(root.matrixWorld);
    expectVecClose(left, 0, 0, -1);
  });

  it('leaves our data +X unchanged (Three +X, screen right)', () => {
    const root = createWorldRoot();
    root.updateMatrixWorld(true);
    const fwd = new Vector3(1, 0, 0).applyMatrix4(root.matrixWorld);
    expectVecClose(fwd, 1, 0, 0);
  });
});
