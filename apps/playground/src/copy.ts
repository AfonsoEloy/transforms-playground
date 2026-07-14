/**
 * Clipboard serializers (SPEC §4 Phase 1: "Copy button per representation, with
 * format options"). Each representation offers only the target formats that
 * genuinely express it — no forced, misleading cross-products.
 *
 * Two conventions matter and are called out in the emitted comments:
 *  - Quaternion element order is fixed by the *target library*, not the app's
 *    display order: NumPy/Eigen are scalar-first (w,x,y,z); SciPy and the ROS
 *    geometry_msgs message are scalar-last (x,y,z,w). Only "Plain" follows the
 *    user's display order.
 *  - SciPy `from_euler` encodes the frame in the *case* of the sequence string:
 *    lowercase = extrinsic, uppercase = intrinsic; and takes `degrees=` to match
 *    the displayed unit. Eigen `AngleAxisd` takes the angle in radians.
 *
 * Numbers use the active display precision (WYSIWYG with the panels — bump the
 * precision control for full fidelity).
 */

import type {
  AxisAngle,
  EulerAngles,
  EulerFrame,
  EulerOrder,
  Quaternion,
  RotationVector,
  RotMat3,
} from 'rigid-kit';
import type { AngleUnit, QuatOrder } from './state/app-state.js';
import { formatNumber, radToUnit } from './format.js';

/** One selectable serialization: `id` keys the picker, `text` goes to the clipboard. */
export interface CopyFormat {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

// Explicit key union: `keyof RotMat3` would include the brand field.
type MatKey = 'm00' | 'm01' | 'm02' | 'm10' | 'm11' | 'm12' | 'm20' | 'm21' | 'm22';

const MAT_ROWS: readonly (readonly MatKey[])[] = [
  ['m00', 'm01', 'm02'],
  ['m10', 'm11', 'm12'],
  ['m20', 'm21', 'm22'],
];

export function quaternionCopyFormats(
  q: Quaternion,
  order: QuatOrder,
  precision: number,
): readonly CopyFormat[] {
  const f = (v: number): string => formatNumber(v, precision);
  const w = f(q.w);
  const x = f(q.x);
  const y = f(q.y);
  const z = f(q.z);
  const plain = (order === 'wxyz' ? [w, x, y, z] : [x, y, z, w]).join(', ');
  return [
    { id: 'plain', label: 'Plain', text: plain },
    { id: 'numpy', label: 'NumPy', text: `np.array([${w}, ${x}, ${y}, ${z}])  # w, x, y, z` },
    { id: 'scipy', label: 'SciPy', text: `R.from_quat([${x}, ${y}, ${z}, ${w}])  # scalar-last` },
    {
      id: 'eigen',
      label: 'Eigen',
      text: `Eigen::Quaterniond(${w}, ${x}, ${y}, ${z})  // (w, x, y, z)`,
    },
    {
      id: 'ros',
      label: 'ROS/YAML',
      text: `{x: ${x}, y: ${y}, z: ${z}, w: ${w}}  # geometry_msgs/Quaternion`,
    },
  ];
}

export function matrixCopyFormats(m: RotMat3, precision: number): readonly CopyFormat[] {
  const cell = (k: MatKey): string => formatNumber(m[k], precision);
  const rows = MAT_ROWS.map((row) => row.map(cell));
  const plain = rows.map((r) => r.join('  ')).join('\n');
  const npRows = rows.map((r) => `[${r.join(', ')}]`).join(', ');
  const flat = MAT_ROWS.flat().map(cell).join(', ');
  return [
    { id: 'plain', label: 'Plain', text: plain },
    { id: 'numpy', label: 'NumPy', text: `np.array([${npRows}])` },
    { id: 'scipy', label: 'SciPy', text: `R.from_matrix([${npRows}])` },
    { id: 'eigen', label: 'Eigen', text: `(Eigen::Matrix3d() << ${flat}).finished()` },
  ];
}

export function eulerCopyFormats(
  e: EulerAngles,
  order: EulerOrder,
  frame: EulerFrame,
  unit: AngleUnit,
  precision: number,
): readonly CopyFormat[] {
  const a = [e.a1, e.a2, e.a3].map((rad) => formatNumber(radToUnit(rad, unit), precision));
  const list = a.join(', ');
  // SciPy encodes the frame in the case of the sequence string.
  const seq = frame === 'intrinsic' ? order : order.toLowerCase();
  const degrees = unit === 'deg' ? 'True' : 'False';
  return [
    { id: 'plain', label: 'Plain', text: `${list} (${order}, ${frame}, ${unit})` },
    { id: 'numpy', label: 'NumPy', text: `np.array([${list}])  # ${order}, ${frame}, ${unit}` },
    {
      id: 'scipy',
      label: 'SciPy',
      text: `R.from_euler('${seq}', [${list}], degrees=${degrees})`,
    },
  ];
}

export function axisAngleCopyFormats(
  aa: AxisAngle,
  unit: AngleUnit,
  precision: number,
): readonly CopyFormat[] {
  const f = (v: number): string => formatNumber(v, precision);
  const x = f(aa.axis.x);
  const y = f(aa.axis.y);
  const z = f(aa.axis.z);
  const angleDisplay = f(radToUnit(aa.angle, unit));
  const angleRad = f(aa.angle);
  return [
    { id: 'plain', label: 'Plain', text: `[${x}, ${y}, ${z}], ${angleDisplay} ${unit}` },
    {
      id: 'numpy',
      label: 'NumPy',
      text: `np.array([${x}, ${y}, ${z}]), ${angleDisplay}  # axis, angle (${unit})`,
    },
    {
      id: 'eigen',
      label: 'Eigen',
      text: `Eigen::AngleAxisd(${angleRad}, Eigen::Vector3d(${x}, ${y}, ${z}))  // angle in rad`,
    },
  ];
}

export function rotationVectorCopyFormats(
  r: RotationVector,
  unit: AngleUnit,
  precision: number,
): readonly CopyFormat[] {
  const disp = [r.x, r.y, r.z].map((rad) => formatNumber(radToUnit(rad, unit), precision));
  const rad = [r.x, r.y, r.z].map((v) => formatNumber(v, precision));
  return [
    { id: 'plain', label: 'Plain', text: `[${disp.join(', ')}] ${unit}` },
    { id: 'numpy', label: 'NumPy', text: `np.array([${disp.join(', ')}])  # ${unit}` },
    { id: 'scipy', label: 'SciPy', text: `R.from_rotvec([${rad.join(', ')}])  # radians` },
  ];
}
