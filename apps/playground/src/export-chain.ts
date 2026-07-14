/**
 * Code-snippet export of the composed chain result (SPEC §4 Phase 4: "Export
 * chain as code snippet: NumPy/SciPy Rotation, Eigen, ROS TF2 static transform
 * publisher command"). The composed product T1·…·Tn is emitted as a ready-to-run
 * 4×4 homogeneous transform in each target's idiom.
 *
 * The same quaternion-order discipline as copy.ts applies (the source of the
 * bug this tool fights): each snippet uses the TARGET library's order, not the
 * app's display order — SciPy `from_quat` and ROS are scalar-last (x,y,z,w),
 * NumPy/Eigen constructors are scalar-first (w,x,y,z). Numbers use the active
 * display precision (WYSIWYG with the readout).
 */

import type { Quaternion, RotMat3, Vec3 } from 'rigid-kit';
import type { CopyFormat } from './copy.js';
import { formatNumber } from './format.js';

/** Placeholder frame names in the ROS command; users rename to their frames. */
const PARENT_FRAME = 'parent';
const CHILD_FRAME = 'child';

type MatKey = 'm00' | 'm01' | 'm02' | 'm10' | 'm11' | 'm12' | 'm20' | 'm21' | 'm22';

const MAT_ROWS: readonly (readonly MatKey[])[] = [
  ['m00', 'm01', 'm02'],
  ['m10', 'm11', 'm12'],
  ['m20', 'm21', 'm22'],
];

/**
 * Serializations of the composed transform (rotation `q`, matrix `m`, translation
 * `t`) for NumPy, SciPy, Eigen, and the ROS 2 static_transform_publisher CLI.
 */
export function chainExportFormats(
  q: Quaternion,
  t: Vec3,
  m: RotMat3,
  precision: number,
): readonly CopyFormat[] {
  const f = (v: number): string => formatNumber(v, precision);
  const w = f(q.w);
  const x = f(q.x);
  const y = f(q.y);
  const z = f(q.z);
  const tx = f(t.x);
  const ty = f(t.y);
  const tz = f(t.z);

  // Homogeneous 4×4 rows: [R | t] over [0 0 0 1], as a NumPy nested list.
  const trans = [tx, ty, tz];
  const npRows = MAT_ROWS.map(
    (row, i) => `    [${row.map((k) => f(m[k])).join(', ')}, ${trans[i]}],`,
  );
  const numpy = [
    'import numpy as np',
    '',
    'T = np.array([',
    ...npRows,
    '    [0, 0, 0, 1],',
    '])',
  ].join('\n');

  const scipy = [
    'from scipy.spatial.transform import Rotation as R',
    'import numpy as np',
    '',
    `rot = R.from_quat([${x}, ${y}, ${z}, ${w}])  # scalar-last (x, y, z, w)`,
    `t = np.array([${tx}, ${ty}, ${tz}])`,
    'T = np.eye(4)',
    'T[:3, :3] = rot.as_matrix()',
    'T[:3, 3] = t',
  ].join('\n');

  const eigen = [
    `Eigen::Quaterniond q(${w}, ${x}, ${y}, ${z});  // (w, x, y, z)`,
    `Eigen::Vector3d t(${tx}, ${ty}, ${tz});`,
    'Eigen::Affine3d T = Eigen::Translation3d(t) * q;',
  ].join('\n');

  const ros2 =
    'ros2 run tf2_ros static_transform_publisher ' +
    `--x ${tx} --y ${ty} --z ${tz} ` +
    `--qx ${x} --qy ${y} --qz ${z} --qw ${w} ` +
    `--frame-id ${PARENT_FRAME} --child-frame-id ${CHILD_FRAME}`;

  return [
    { id: 'numpy', label: 'NumPy', text: numpy },
    { id: 'scipy', label: 'SciPy', text: scipy },
    { id: 'eigen', label: 'Eigen', text: eigen },
    { id: 'ros2', label: 'ROS 2 CLI', text: ros2 },
  ];
}
