/**
 * Core math primitives for rigid-kit.
 *
 * Convention (SPEC.md §2, authoritative — every rotation-touching symbol assumes
 * these unless its doc comment says otherwise):
 *   - Quaternions: named fields {w,x,y,z}, scalar-first semantics, unit length,
 *     accessed by name and NEVER by index.
 *   - Rotations are ACTIVE (rotate the vector), frames are RIGHT-HANDED,
 *     vectors are COLUMN vectors, matrices premultiply: v' = R v.
 *   - Rotation matrices are stored as named fields mIJ = row I, column J
 *     (I,J in 0..2). "Row-major in code" per SPEC, but access is by name.
 *   - Angles are radians internally.
 *
 * Primitives are immutable: constructors return frozen, branded objects so a
 * Vec3 can never be passed where a Quaternion is expected, and no conversion
 * silently reinterprets one representation as another.
 */

declare const brand: unique symbol;

/** Nominal/branded wrapper: structurally T, but not assignable across brands. */
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A 3-vector (column vector) in a right-handed frame. */
export type Vec3 = Brand<
  {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  'Vec3'
>;

/**
 * Unit quaternion, scalar-first named fields.
 *
 * NOTE: the type does not enforce unit length — that is a runtime property
 * checked/repaired by the explicit `normalize`/`isUnit` helpers, never silently
 * inside conversions (CLAUDE.md rule 3).
 */
export type Quaternion = Brand<
  {
    readonly w: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  'Quaternion'
>;

/**
 * 3×3 rotation matrix. Field mIJ is the entry at row I, column J (0-indexed),
 * so a column vector v maps to R v with the usual row·column contraction.
 */
export type RotMat3 = Brand<
  {
    readonly m00: number;
    readonly m01: number;
    readonly m02: number;
    readonly m10: number;
    readonly m11: number;
    readonly m12: number;
    readonly m20: number;
    readonly m21: number;
    readonly m22: number;
  },
  'RotMat3'
>;

/** Construct an immutable Vec3. */
export function vec3(x: number, y: number, z: number): Vec3 {
  return Object.freeze({ x, y, z }) as Vec3;
}

/**
 * Construct an immutable quaternion from scalar-first components.
 * Does NOT normalize — pass a unit quaternion, or call `normalize` explicitly.
 */
export function quat(w: number, x: number, y: number, z: number): Quaternion {
  return Object.freeze({ w, x, y, z }) as Quaternion;
}

/** The identity quaternion {w:1, x:0, y:0, z:0}. */
export const IDENTITY_QUATERNION: Quaternion = quat(1, 0, 0, 0);

/**
 * Construct an immutable 3×3 matrix from entries in row-major order:
 * (m00, m01, m02, m10, m11, m12, m20, m21, m22).
 */
export function rotMat3(
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
  m20: number,
  m21: number,
  m22: number,
): RotMat3 {
  return Object.freeze({ m00, m01, m02, m10, m11, m12, m20, m21, m22 }) as RotMat3;
}

/** The 3×3 identity matrix. */
export const IDENTITY_ROTMAT3: RotMat3 = rotMat3(1, 0, 0, 0, 1, 0, 0, 0, 1);

/**
 * Axis–angle rotation: a UNIT `axis` and a rotation `angle` (radians) about it,
 * by the right-hand rule. The type does not enforce a unit axis or an angle
 * range — conversions state what they assume. At `angle` 0 the axis is arbitrary
 * (the rotation is the identity).
 */
export type AxisAngle = Brand<
  {
    readonly axis: Vec3;
    readonly angle: number;
  },
  'AxisAngle'
>;

/**
 * Rotation vector (exponential coordinates): direction is the rotation axis,
 * magnitude is the angle in radians. Unlike axis–angle it has no singularity at
 * zero — the zero vector is exactly the identity.
 */
export type RotationVector = Brand<
  {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  'RotationVector'
>;

/** Construct an immutable axis–angle. Pass a unit axis; not normalized here. */
export function axisAngle(axis: Vec3, angle: number): AxisAngle {
  return Object.freeze({ axis, angle }) as AxisAngle;
}

/** Construct an immutable rotation vector from its components (axis · angle). */
export function rotationVector(x: number, y: number, z: number): RotationVector {
  return Object.freeze({ x, y, z }) as RotationVector;
}
