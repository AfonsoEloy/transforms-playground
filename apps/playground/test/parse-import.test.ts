/**
 * Known-answer tests for the paste/import parser (SPEC §4 Phase 4: "accept raw
 * output of tf2_echo, tf_echo, a NumPy matrix print, or a Python list —
 * auto-detect and import"). Each case pins a real-world paste to the transform
 * it must yield and the format it must self-report.
 */

import { describe, expect, it } from 'vitest';
import { quaternionToMatrix } from 'rigid-kit';
import { parseImport } from '../src/parse-import.js';

const TOL = 1e-3;

/** Assert a successful parse and return it narrowed (fails loudly otherwise). */
function ok(text: string, order: 'wxyz' | 'xyzw' = 'wxyz') {
  const r = parseImport(text, order);
  if (!r.ok) throw new Error(`expected success, got error: ${r.error}`);
  return r;
}

describe('parseImport — ROS tf/tf2 echo', () => {
  it('parses ros2 tf2_echo output (translation + xyzw quaternion)', () => {
    const text = `At time 0.0
- Translation: [0.100, 0.200, 0.300]
- Rotation: in Quaternion [0.000, 0.000, 0.707, 0.707]
- Rotation: in RPY (radian) [0.000, -0.000, 1.571]
- Rotation: in RPY (degree) [0.000, -0.000, 90.000]`;
    const r = ok(text);
    expect(r.detected).toBe('ros-tf');
    expect(r.transform.translation.x).toBeCloseTo(0.1, 6);
    expect(r.transform.translation.y).toBeCloseTo(0.2, 6);
    expect(r.transform.translation.z).toBeCloseTo(0.3, 6);
    // xyzw [0,0,0.707,0.707] → w≈0.707, z≈0.707 (≈90° about Z)
    expect(r.transform.rotation.w).toBeCloseTo(0.707, TOL);
    expect(r.transform.rotation.x).toBeCloseTo(0, TOL);
    expect(r.transform.rotation.y).toBeCloseTo(0, TOL);
    expect(r.transform.rotation.z).toBeCloseTo(0.707, TOL);
  });

  it('parses ros1 tf_echo output (multi-line Rotation block)', () => {
    const text = `- Translation: [1.000, 0.000, 0.000]
- Rotation: in Quaternion [0.000, 0.000, 0.000, 1.000]
            in RPY (radian) [0.000, -0.000, 0.000]
            in RPY (degree) [0.000, -0.000, 0.000]`;
    const r = ok(text);
    expect(r.detected).toBe('ros-tf');
    expect(r.transform.translation.x).toBeCloseTo(1, 6);
    expect(r.transform.rotation.w).toBeCloseTo(1, TOL);
  });
});

describe('parseImport — matrices', () => {
  it('parses a NumPy 3x3 print as rotation-only', () => {
    const text = `[[ 1.  0.  0.]
 [ 0.  1.  0.]
 [ 0.  0.  1.]]`;
    const r = ok(text);
    expect(r.detected).toBe('matrix-3x3');
    expect(r.transform.rotation.w).toBeCloseTo(1, TOL);
    expect(r.transform.translation.x).toBe(0);
    expect(r.transform.translation.y).toBe(0);
    expect(r.transform.translation.z).toBe(0);
  });

  it('parses a 4x4 homogeneous matrix (90° about Z + translation)', () => {
    const text = `[[ 0. -1.  0.  1.]
 [ 1.  0.  0.  2.]
 [ 0.  0.  1.  3.]
 [ 0.  0.  0.  1.]]`;
    const r = ok(text);
    expect(r.detected).toBe('matrix-4x4');
    // R_z(90°): the rotation carries X̂ → Ŷ.
    const m = quaternionToMatrix(r.transform.rotation);
    expect(m.m00).toBeCloseTo(0, TOL);
    expect(m.m10).toBeCloseTo(1, TOL);
    expect(r.transform.translation.x).toBeCloseTo(1, 6);
    expect(r.transform.translation.y).toBeCloseTo(2, 6);
    expect(r.transform.translation.z).toBeCloseTo(3, 6);
  });

  it('parses a 3x4 matrix (rotation + translation, no bottom row)', () => {
    const text = `[[1, 0, 0, 5],
 [0, 1, 0, 6],
 [0, 0, 1, 7]]`;
    const r = ok(text);
    expect(r.detected).toBe('matrix-3x4');
    expect(r.transform.rotation.w).toBeCloseTo(1, TOL);
    expect(r.transform.translation.z).toBeCloseTo(7, 6);
  });

  it('parses a Python nested-list matrix with commas', () => {
    const text = `np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])`;
    const r = ok(text);
    expect(r.detected).toBe('matrix-3x3');
    // 90° about X: carries Ŷ → Ẑ.
    const m = quaternionToMatrix(r.transform.rotation);
    expect(m.m21).toBeCloseTo(1, TOL);
  });
});

describe('parseImport — bare quaternion list', () => {
  it('reads a flat 4-list in wxyz display order', () => {
    const r = ok('[0.0, 0.0, 0.707, 0.707]', 'wxyz');
    expect(r.detected).toBe('quaternion');
    expect(r.transform.rotation.w).toBeCloseTo(0, TOL);
    expect(r.transform.rotation.z).toBeCloseTo(0.707, TOL);
  });

  it('reads a flat 4-list in xyzw display order', () => {
    const r = ok('0.0, 0.0, 0.707, 0.707', 'xyzw');
    expect(r.detected).toBe('quaternion');
    expect(r.transform.rotation.w).toBeCloseTo(0.707, TOL);
    expect(r.transform.rotation.z).toBeCloseTo(0.707, TOL);
  });
});

describe('parseImport — errors', () => {
  it('rejects empty input', () => {
    expect(parseImport('   ', 'wxyz').ok).toBe(false);
  });

  it('rejects text with no numbers', () => {
    expect(parseImport('hello world', 'wxyz').ok).toBe(false);
  });

  it('rejects an ambiguous 3-number list', () => {
    const r = parseImport('[1, 2, 3]', 'wxyz');
    expect(r.ok).toBe(false);
  });

  it('rejects a non-square, non-homogeneous matrix', () => {
    const r = parseImport('[[1, 2], [3, 4]]', 'wxyz');
    expect(r.ok).toBe(false);
  });
});
