/**
 * Typed errors for rigid-kit. Degenerate inputs throw one of these rather than
 * producing NaN or being silently repaired (CLAUDE.md rules 2 & 3).
 */

/** Base class so callers can `catch (e) { if (e instanceof RigidKitError) … }`. */
export class RigidKitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Thrown when an input that must have positive magnitude is (near) zero — e.g.
 * a zero-length rotation axis, from which no rotation can be recovered.
 */
export class ZeroMagnitudeError extends RigidKitError {}

/**
 * Thrown by `orthonormalize` when the input cannot be repaired to a nearby proper
 * rotation: its determinant is ≈ 0 (rank-deficient — no well-defined orthogonal
 * factor) or negative (a reflection, whose nearest SO(3) matrix is not a small
 * correction). Repairing those honestly needs a full SVD, out of scope here.
 */
export class SingularMatrixError extends RigidKitError {}
