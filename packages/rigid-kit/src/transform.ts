/**
 * Rigid-transform (SE(3)) algebra: compose, invert, apply to a point, and fold a
 * chain. See `Transform` in types.ts for the representation.
 *
 * Convention (SPEC §2): homogeneous 4×4 [R | t; 0 1]; active rotations, right-
 * handed, column vectors, p' = R p + t. Composition matches the matrix/quaternion
 * order — `composeTransform(a, b)` applies b first, then a, equalling the 4×4
 * product a·b. Every function ASSUMES unit rotations (`rotateVector`/`conjugate`
 * are only the inverse rotation for unit quaternions); nothing normalizes here
 * (CLAUDE.md rule 3) — the app repairs a non-unit rotation explicitly before use.
 */

import { transform, vec3, IDENTITY_TRANSFORM, type Transform, type Vec3 } from './types.js';
import { conjugate, multiply, rotateVector } from './quaternion.js';

/**
 * Compose two transforms: `composeTransform(a, b)` is the transform that applies
 * `b` first, then `a` (matching `multiply` for the rotation part and matrix a·b).
 * Deriving from p ↦ a(b(p)) = R_a(R_b p + t_b) + t_a = (R_a R_b) p + (R_a t_b + t_a):
 *   rotation    = R_a R_b
 *   translation = t_a + R_a · t_b
 */
export function composeTransform(a: Transform, b: Transform): Transform {
  const rotated = rotateVector(a.rotation, b.translation);
  return transform(
    multiply(a.rotation, b.rotation),
    vec3(a.translation.x + rotated.x, a.translation.y + rotated.y, a.translation.z + rotated.z),
  );
}

/**
 * Inverse transform T⁻¹ = [Rᵀ | −Rᵀ t]: the rotation is the conjugate (inverse
 * for a unit quaternion) and the translation is that inverse rotation applied to
 * −t, so that composing with T on either side yields the identity.
 */
export function invertTransform(t: Transform): Transform {
  const invRot = conjugate(t.rotation);
  const back = rotateVector(invRot, vec3(-t.translation.x, -t.translation.y, -t.translation.z));
  return transform(invRot, back);
}

/**
 * Actively map a point through the transform: p' = R p + t (SPEC §2). This is a
 * POINT map (affected by translation); rotating a free direction uses
 * `rotateVector` on the rotation part alone.
 */
export function transformPoint(t: Transform, p: Vec3): Vec3 {
  const r = rotateVector(t.rotation, p);
  return vec3(r.x + t.translation.x, r.y + t.translation.y, r.z + t.translation.z);
}

/**
 * Fold an ordered chain [T1, T2, …, Tn] into the single transform T1·T2·…·Tn,
 * i.e. the composite that applies Tn first and T1 last (matrix reading order).
 * The empty chain is the identity; a single element is returned unchanged. Pure
 * left fold — the app resolves per-element enabled/inverted flags into the list
 * before calling this, keeping the math free of UI concerns.
 */
export function composeChain(chain: readonly Transform[]): Transform {
  return chain.reduce(composeTransform, IDENTITY_TRANSFORM);
}
