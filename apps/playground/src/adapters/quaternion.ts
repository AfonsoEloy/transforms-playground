/**
 * The single boundary between rigid-kit's rotation types and Three.js.
 *
 * rigid-kit stores quaternions scalar-first with named fields `{w,x,y,z}`
 * (SPEC §2, DECISIONS #003). Three.js's `Quaternion` constructor takes
 * `(x, y, z, w)` — scalar-LAST — which is the single most common ordering trap
 * this whole project exists to fight (CLAUDE.md gotchas). That reordering is
 * performed here, in the adapter layer, and NOWHERE else (DECISIONS #002): no
 * component or scene file ever touches `.w/.x/.y/.z` against a THREE object.
 *
 * These helpers do NOT normalize or canonicalize; callers pass a rotation that
 * has already been validated/repaired by the derive layer (CLAUDE.md rule 3).
 */

import { Quaternion as ThreeQuaternion, Vector3 as ThreeVector3 } from 'three';
import type { Quaternion, Vec3 } from 'rigid-kit';

/**
 * Build a fresh Three.js quaternion from a rigid-kit quaternion, reordering
 * scalar-first `{w,x,y,z}` to Three's positional `(x, y, z, w)`.
 */
export function toThreeQuaternion(q: Quaternion): ThreeQuaternion {
  return new ThreeQuaternion(q.x, q.y, q.z, q.w);
}

/**
 * Write a rigid-kit quaternion into an EXISTING Three.js quaternion, reordering
 * to `(x, y, z, w)`. Preferred in the render/update path: mutating in place keeps
 * object churn out of the frame loop (CLAUDE.md: mutate per frame, never
 * recreate). Returns the same target for chaining.
 */
export function applyToThreeQuaternion(q: Quaternion, target: ThreeQuaternion): ThreeQuaternion {
  return target.set(q.x, q.y, q.z, q.w);
}

/** Build a fresh Three.js vector from a rigid-kit vector (field order is identical). */
export function toThreeVec3(v: Vec3): ThreeVector3 {
  return new ThreeVector3(v.x, v.y, v.z);
}

/** Write a rigid-kit vector into an existing Three.js vector (in-place, no allocation). */
export function applyToThreeVec3(v: Vec3, target: ThreeVector3): ThreeVector3 {
  return target.set(v.x, v.y, v.z);
}
