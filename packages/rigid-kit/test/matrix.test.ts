import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { quat, rotMat3, IDENTITY_ROTMAT3, type RotMat3 } from '../src/types.js';
import { SingularMatrixError } from '../src/errors.js';
import { determinant, orthonormalityError, orthonormalize } from '../src/matrix.js';
import {
  quaternionToMatrix,
  matrixToQuaternion,
} from '../src/conversions/quaternion-rotation-matrix.js';
import { expectMat3Close, unitQuaternion } from './_helpers.js';

const MAT3_KEYS = ['m00', 'm01', 'm02', 'm10', 'm11', 'm12', 'm20', 'm21', 'm22'] as const;

/** Add per-entry noise `eps` to a matrix (breaks orthonormality). */
function perturb(m: RotMat3, noise: readonly number[]): RotMat3 {
  const v = MAT3_KEYS.map((k, i) => m[k] + noise[i]!);
  return rotMat3(v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]!, v[6]!, v[7]!, v[8]!);
}

const smallNoise = fc.array(
  fc.double({ min: -1e-3, max: 1e-3, noNaN: true, noDefaultInfinity: true }),
  { minLength: 9, maxLength: 9 },
);

describe('determinant — known answers', () => {
  it('identity has determinant 1', () => {
    expect(determinant(IDENTITY_ROTMAT3)).toBeCloseTo(1, 15);
  });

  it('a reflection has determinant -1', () => {
    const reflect = rotMat3(1, 0, 0, 0, 1, 0, 0, 0, -1);
    expect(determinant(reflect)).toBeCloseTo(-1, 15);
  });

  it('a scaling has the product of the scales', () => {
    expect(determinant(rotMat3(2, 0, 0, 0, 3, 0, 0, 0, 4))).toBeCloseTo(24, 12);
  });
});

describe('property: proper rotations have determinant +1', () => {
  it('det(R(q)) = 1 for unit q', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        expect(Math.abs(determinant(quaternionToMatrix(q)) - 1)).toBeLessThanOrEqual(1e-12);
      }),
      { numRuns: 2000 },
    );
  });
});

describe('orthonormalityError — known answers', () => {
  it('is 0 for the identity', () => {
    expect(orthonormalityError(IDENTITY_ROTMAT3)).toBeCloseTo(0, 15);
  });

  it('is 0 for a genuine rotation (from a unit quaternion)', () => {
    const R = quaternionToMatrix(quat(Math.SQRT1_2, 0, 0, Math.SQRT1_2));
    expect(orthonormalityError(R)).toBeLessThanOrEqual(1e-12);
  });

  it('is > 0 when columns are not unit / not orthogonal', () => {
    expect(orthonormalityError(rotMat3(1.1, 0, 0, 0, 1, 0, 0, 0, 1))).toBeGreaterThan(0.1);
    expect(orthonormalityError(rotMat3(1, 0.2, 0, 0, 1, 0, 0, 0, 1))).toBeGreaterThan(0.1);
  });

  it('is ≈ 0 for a reflection (orthonormal but improper — caught by determinant)', () => {
    const reflect = rotMat3(1, 0, 0, 0, 1, 0, 0, 0, -1);
    expect(orthonormalityError(reflect)).toBeLessThanOrEqual(1e-12);
    expect(determinant(reflect)).toBeLessThan(0);
  });
});

describe('property: orthonormalityError vanishes exactly on rotations', () => {
  it('error(R(q)) ≈ 0 for unit q', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        expect(orthonormalityError(quaternionToMatrix(q))).toBeLessThanOrEqual(1e-12);
      }),
      { numRuns: 2000 },
    );
  });
});

describe('orthonormalize — known answers', () => {
  it('leaves the identity unchanged', () => {
    expectMat3Close(orthonormalize(IDENTITY_ROTMAT3), IDENTITY_ROTMAT3, 1e-12);
  });

  it('leaves an already-orthonormal rotation unchanged', () => {
    const R = quaternionToMatrix(quat(Math.SQRT1_2, 0, 0, Math.SQRT1_2));
    expectMat3Close(orthonormalize(R), R, 1e-12);
  });
});

describe('orthonormalize — properties', () => {
  it('output is orthonormal (error ≈ 0) and a proper rotation (det ≈ 1)', () => {
    fc.assert(
      fc.property(unitQuaternion, smallNoise, (q, noise) => {
        const repaired = orthonormalize(perturb(quaternionToMatrix(q), noise));
        expect(orthonormalityError(repaired)).toBeLessThanOrEqual(1e-12);
        expect(Math.abs(determinant(repaired) - 1)).toBeLessThanOrEqual(1e-12);
      }),
      { numRuns: 2000 },
    );
  });

  it('recovers the underlying rotation from a small perturbation', () => {
    fc.assert(
      fc.property(unitQuaternion, smallNoise, (q, noise) => {
        const R = quaternionToMatrix(q);
        const repaired = orthonormalize(perturb(R, noise));
        // Nearest rotation to R + O(1e-3) stays within O(1e-3) of R.
        expectMat3Close(repaired, R, 1e-2);
      }),
      { numRuns: 2000 },
    );
  });

  it('is idempotent: orthonormalize∘orthonormalize = orthonormalize', () => {
    fc.assert(
      fc.property(unitQuaternion, smallNoise, (q, noise) => {
        const once = orthonormalize(perturb(quaternionToMatrix(q), noise));
        expectMat3Close(orthonormalize(once), once, 1e-12);
      }),
      { numRuns: 1000 },
    );
  });

  it('produces a matrix that round-trips through the quaternion', () => {
    fc.assert(
      fc.property(unitQuaternion, smallNoise, (q, noise) => {
        const repaired = orthonormalize(perturb(quaternionToMatrix(q), noise));
        expectMat3Close(quaternionToMatrix(matrixToQuaternion(repaired)), repaired, 1e-12);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('orthonormalize — degenerate inputs throw (never NaN)', () => {
  it('throws on a rank-deficient (near-singular) matrix', () => {
    const zero = rotMat3(0, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(() => orthonormalize(zero)).toThrow(SingularMatrixError);
    const rankTwo = rotMat3(1, 0, 0, 0, 1, 0, 0, 0, 0);
    expect(() => orthonormalize(rankTwo)).toThrow(SingularMatrixError);
  });

  it('throws on a reflection (negative determinant)', () => {
    const reflect = rotMat3(1, 0, 0, 0, 1, 0, 0, 0, -1);
    expect(() => orthonormalize(reflect)).toThrow(SingularMatrixError);
  });
});
