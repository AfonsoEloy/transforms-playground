/**
 * rigid-kit — pure TypeScript rotation & rigid-transform math.
 * Zero runtime dependencies. Conventions are authoritative in SPEC.md §2.
 */

export {
  vec3,
  quat,
  rotMat3,
  axisAngle,
  rotationVector,
  euler,
  EULER_ORDERS,
  IDENTITY_QUATERNION,
  IDENTITY_ROTMAT3,
  type Vec3,
  type Quaternion,
  type RotMat3,
  type AxisAngle,
  type RotationVector,
  type EulerAngles,
  type EulerOrder,
  type EulerFrame,
} from './types.js';

export { RigidKitError, ZeroMagnitudeError, SingularMatrixError } from './errors.js';

export { quatNorm, isUnit, normalize, canonicalize, conjugate, multiply } from './quaternion.js';

export { determinant, orthonormalityError, orthonormalize } from './matrix.js';

export { gimbalProximity } from './gimbal.js';

export {
  quaternionToMatrix,
  matrixToQuaternion,
} from './conversions/quaternion-rotation-matrix.js';

export {
  axisAngleToQuaternion,
  quaternionToAxisAngle,
} from './conversions/quaternion-axis-angle.js';

export {
  rotationVectorToQuaternion,
  quaternionToRotationVector,
} from './conversions/quaternion-rotation-vector.js';

export { eulerToQuaternion, quaternionToEuler } from './conversions/quaternion-euler.js';
