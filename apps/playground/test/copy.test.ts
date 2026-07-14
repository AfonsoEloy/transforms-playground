/**
 * Known-answer tests for the clipboard serializers. These lock the conventions
 * that are easy to get wrong: quaternion element order per target library
 * (scalar-first vs scalar-last), SciPy's frame-in-the-case Euler sequence and
 * degrees flag, and Eigen's radian angle.
 */

import { describe, expect, it } from 'vitest';
import { axisAngle, euler, quat, rotMat3, rotationVector, vec3 } from 'rigid-kit';
import {
  axisAngleCopyFormats,
  eulerCopyFormats,
  matrixCopyFormats,
  quaternionCopyFormats,
  rotationVectorCopyFormats,
  type CopyFormat,
} from '../src/copy.js';

/** Look up a format's text by id (throws if the panel didn't offer it). */
function text(formats: readonly CopyFormat[], id: string): string {
  const f = formats.find((x) => x.id === id);
  if (f === undefined) throw new Error(`no format ${id}`);
  return f.text;
}

describe('quaternionCopyFormats', () => {
  // Distinct components so any transposition of order is visible.
  const q = quat(0.1, 0.2, 0.3, 0.4); // w, x, y, z

  it('plain follows the display order', () => {
    expect(text(quaternionCopyFormats(q, 'wxyz', 1), 'plain')).toBe('0.1, 0.2, 0.3, 0.4');
    expect(text(quaternionCopyFormats(q, 'xyzw', 1), 'plain')).toBe('0.2, 0.3, 0.4, 0.1');
  });

  it('code formats use each library’s fixed order regardless of display order', () => {
    const f = quaternionCopyFormats(q, 'xyzw', 1); // display order must NOT leak in
    expect(text(f, 'numpy')).toBe('np.array([0.1, 0.2, 0.3, 0.4])  # w, x, y, z');
    expect(text(f, 'scipy')).toBe('R.from_quat([0.2, 0.3, 0.4, 0.1])  # scalar-last');
    expect(text(f, 'eigen')).toBe('Eigen::Quaterniond(0.1, 0.2, 0.3, 0.4)  // (w, x, y, z)');
    expect(text(f, 'ros')).toBe('{x: 0.2, y: 0.3, z: 0.4, w: 0.1}  # geometry_msgs/Quaternion');
  });
});

describe('matrixCopyFormats', () => {
  const m = rotMat3(1, 2, 3, 4, 5, 6, 7, 8, 9); // row-major, distinct entries

  it('preserves row/column layout across formats', () => {
    const f = matrixCopyFormats(m, 0);
    expect(text(f, 'plain')).toBe('1  2  3\n4  5  6\n7  8  9');
    expect(text(f, 'numpy')).toBe('np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])');
    expect(text(f, 'scipy')).toBe('R.from_matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]])');
    expect(text(f, 'eigen')).toBe('(Eigen::Matrix3d() << 1, 2, 3, 4, 5, 6, 7, 8, 9).finished()');
  });
});

describe('eulerCopyFormats', () => {
  const e = euler(Math.PI / 2, 0, 0, 'ZYX', 'intrinsic');

  it('SciPy encodes the frame in the sequence case and sets degrees', () => {
    const intr = eulerCopyFormats(e, 'ZYX', 'intrinsic', 'deg', 1);
    expect(text(intr, 'scipy')).toBe("R.from_euler('ZYX', [90.0, 0.0, 0.0], degrees=True)");

    const extr = eulerCopyFormats(e, 'ZYX', 'extrinsic', 'deg', 1);
    expect(text(extr, 'scipy')).toBe("R.from_euler('zyx', [90.0, 0.0, 0.0], degrees=True)");

    const rad = eulerCopyFormats(e, 'ZYX', 'intrinsic', 'rad', 6);
    expect(text(rad, 'scipy')).toBe(
      "R.from_euler('ZYX', [1.570796, 0.000000, 0.000000], degrees=False)",
    );
  });

  it('plain and numpy annotate order/frame/unit', () => {
    const f = eulerCopyFormats(e, 'ZYX', 'intrinsic', 'deg', 1);
    expect(text(f, 'plain')).toBe('90.0, 0.0, 0.0 (ZYX, intrinsic, deg)');
    expect(text(f, 'numpy')).toBe('np.array([90.0, 0.0, 0.0])  # ZYX, intrinsic, deg');
  });
});

describe('axisAngleCopyFormats', () => {
  const aa = axisAngle(vec3(0, 0, 1), Math.PI / 2);

  it('Eigen takes the angle in radians even when the unit is degrees', () => {
    const f = axisAngleCopyFormats(aa, 'deg', 6);
    expect(text(f, 'numpy')).toBe(
      'np.array([0.000000, 0.000000, 1.000000]), 90.000000  # axis, angle (deg)',
    );
    expect(text(f, 'eigen')).toBe(
      'Eigen::AngleAxisd(1.570796, Eigen::Vector3d(0.000000, 0.000000, 1.000000))  // angle in rad',
    );
  });
});

describe('rotationVectorCopyFormats', () => {
  const r = rotationVector(0, 0, Math.PI / 2);

  it('SciPy from_rotvec is always radians; numpy follows the display unit', () => {
    const f = rotationVectorCopyFormats(r, 'deg', 6);
    expect(text(f, 'numpy')).toBe('np.array([0.000000, 0.000000, 90.000000])  # deg');
    expect(text(f, 'scipy')).toBe('R.from_rotvec([0.000000, 0.000000, 1.570796])  # radians');
  });
});
