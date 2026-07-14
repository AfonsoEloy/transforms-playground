/**
 * Known-answer tests for the chain code-export serializers (SPEC §4 Phase 4:
 * "Export chain as code snippet: NumPy/SciPy Rotation, Eigen, ROS TF2 static
 * transform publisher command"). Each format pins the library-specific
 * quaternion order and the composed 4×4 it must emit.
 *
 * Numbers are WYSIWYG with the panels: formatNumber uses toFixed(precision), so a
 * value of 1 at precision 6 prints "1.000000" (trailing zeros kept for column
 * alignment). Expectations below reflect that on purpose.
 */

import { describe, expect, it } from 'vitest';
import { quat, quaternionToMatrix, vec3 } from 'rigid-kit';
import { chainExportFormats } from '../src/export-chain.js';

/** Look up one format's emitted text by id. */
function fmt(formats: ReturnType<typeof chainExportFormats>, id: string): string {
  const f = formats.find((x) => x.id === id);
  if (!f) throw new Error(`no export format '${id}'`);
  return f.text;
}

describe('chainExportFormats — identity', () => {
  const q = quat(1, 0, 0, 0);
  const t = vec3(0, 0, 0);
  const formats = chainExportFormats(q, t, quaternionToMatrix(q), 6);

  it('offers all four target formats', () => {
    expect(formats.map((f) => f.id).sort()).toEqual(['eigen', 'numpy', 'ros2', 'scipy']);
  });

  it('SciPy uses scalar-last from_quat', () => {
    expect(fmt(formats, 'scipy')).toContain(
      'R.from_quat([0.000000, 0.000000, 0.000000, 1.000000])',
    );
  });

  it('Eigen uses scalar-first Quaterniond ctor', () => {
    expect(fmt(formats, 'eigen')).toContain(
      'Eigen::Quaterniond q(1.000000, 0.000000, 0.000000, 0.000000)',
    );
  });

  it('ROS2 command carries qw=1 and frame placeholders', () => {
    const ros = fmt(formats, 'ros2');
    expect(ros).toContain('static_transform_publisher');
    expect(ros).toContain('--qw 1.000000');
    expect(ros).toContain('--frame-id parent');
    expect(ros).toContain('--child-frame-id child');
  });
});

describe('chainExportFormats — 90° about Z with translation', () => {
  // w = z = 0.707107; translation (1, 2, 3).
  const q = quat(0.707107, 0, 0, 0.707107);
  const t = vec3(1, 2, 3);
  const formats = chainExportFormats(q, t, quaternionToMatrix(q), 6);

  it('NumPy emits the homogeneous 4×4 with translation in the last column', () => {
    const np = fmt(formats, 'numpy');
    expect(np).toContain('np.array([');
    // Hardcoded bottom row of a homogeneous transform.
    expect(np).toContain('[0, 0, 0, 1]');
    // Translation column values appear in their rows.
    expect(np).toContain('1.000000],');
    expect(np).toContain('2.000000],');
    expect(np).toContain('3.000000],');
  });

  it('SciPy from_quat is scalar-last (x, y, z, w)', () => {
    expect(fmt(formats, 'scipy')).toContain(
      'R.from_quat([0.000000, 0.000000, 0.707107, 0.707107])',
    );
  });

  it('ROS2 command uses scalar components qx/qy/qz/qw and xyz translation', () => {
    const ros = fmt(formats, 'ros2');
    expect(ros).toContain('--x 1.000000');
    expect(ros).toContain('--y 2.000000');
    expect(ros).toContain('--z 3.000000');
    expect(ros).toContain('--qz 0.707107');
    expect(ros).toContain('--qw 0.707107');
  });
});
