import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  quat,
  rotMat3,
  IDENTITY_QUATERNION,
  IDENTITY_ROTMAT3,
  type Quaternion,
  type RotMat3,
} from '../src/types.js';
import { quatNorm } from '../src/quaternion.js';
import {
  quaternionToMatrix,
  matrixToQuaternion,
} from '../src/conversions/quaternion-rotation-matrix.js';
import { expectQuatClose, unitQuaternion } from './_helpers.js';

// --- local (matrix-specific) test helpers -----------------------------------

const SQRT1_2 = Math.SQRT1_2; // cos(45°) = sin(45°) = √2/2

/** Apply R to a column vector, returning [x', y', z'] (v' = R v). */
function applyMat(R: RotMat3, v: [number, number, number]): [number, number, number] {
  const [x, y, z] = v;
  return [
    R.m00 * x + R.m01 * y + R.m02 * z,
    R.m10 * x + R.m11 * y + R.m12 * z,
    R.m20 * x + R.m21 * y + R.m22 * z,
  ];
}

function expectMatClose(a: RotMat3, b: RotMat3, tol = 1e-12): void {
  const keys = ['m00', 'm01', 'm02', 'm10', 'm11', 'm12', 'm20', 'm21', 'm22'] as const;
  for (const k of keys) {
    expect(Math.abs(a[k] - b[k]), `entry ${k}`).toBeLessThanOrEqual(tol);
  }
}

/** R·Rᵀ − I max abs entry; 0 for a perfectly orthonormal matrix. */
function orthonormalityError(R: RotMat3): number {
  const rows: [number, number, number][] = [
    [R.m00, R.m01, R.m02],
    [R.m10, R.m11, R.m12],
    [R.m20, R.m21, R.m22],
  ];
  let maxErr = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const ri = rows[i]!;
      const rj = rows[j]!;
      const dot = ri[0] * rj[0] + ri[1] * rj[1] + ri[2] * rj[2];
      maxErr = Math.max(maxErr, Math.abs(dot - (i === j ? 1 : 0)));
    }
  }
  return maxErr;
}

function det(R: RotMat3): number {
  return (
    R.m00 * (R.m11 * R.m22 - R.m12 * R.m21) -
    R.m01 * (R.m10 * R.m22 - R.m12 * R.m20) +
    R.m02 * (R.m10 * R.m21 - R.m11 * R.m20)
  );
}

// --- known-answer tests -----------------------------------------------------

describe('quaternionToMatrix — known answers', () => {
  it('identity quaternion → identity matrix', () => {
    expectMatClose(quaternionToMatrix(IDENTITY_QUATERNION), IDENTITY_ROTMAT3);
  });

  it('90° about +Z sends X̂ → Ŷ (SPEC acceptance)', () => {
    const q = quat(SQRT1_2, 0, 0, SQRT1_2); // 90° about Z
    const R = quaternionToMatrix(q);
    const [x, y, z] = applyMat(R, [1, 0, 0]);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it('90° about +Z produces the expected matrix', () => {
    const q = quat(SQRT1_2, 0, 0, SQRT1_2);
    // [[0,-1,0],[1,0,0],[0,0,1]]
    expectMatClose(quaternionToMatrix(q), rotMat3(0, -1, 0, 1, 0, 0, 0, 0, 1));
  });

  it('90° about +X sends Ŷ → Ẑ', () => {
    const q = quat(SQRT1_2, SQRT1_2, 0, 0);
    const [x, y, z] = applyMat(quaternionToMatrix(q), [0, 1, 0]);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(1, 12);
  });

  it('90° about +Y sends Ẑ → X̂', () => {
    const q = quat(SQRT1_2, 0, SQRT1_2, 0);
    const [x, y, z] = applyMat(quaternionToMatrix(q), [0, 0, 1]);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);
  });
});

describe('matrixToQuaternion — known answers', () => {
  it('identity matrix → identity quaternion', () => {
    expectQuatClose(matrixToQuaternion(IDENTITY_ROTMAT3), IDENTITY_QUATERNION);
  });

  it('output is canonicalized to w ≥ 0', () => {
    // 90° about Z, but expressed with negative w — must come back with w ≥ 0.
    const R = rotMat3(0, -1, 0, 1, 0, 0, 0, 0, 1);
    const q = matrixToQuaternion(R);
    expect(q.w).toBeGreaterThanOrEqual(0);
  });
});

// --- degenerate cases: 180° rotations (w = 0) exercise the Shepperd branches -

describe('180° rotations (Shepperd branch selection)', () => {
  const cases: Array<{ name: string; R: RotMat3; q: Quaternion }> = [
    {
      name: 'about X (m00 largest)',
      R: rotMat3(1, 0, 0, 0, -1, 0, 0, 0, -1),
      q: quat(0, 1, 0, 0),
    },
    {
      name: 'about Y (m11 largest)',
      R: rotMat3(-1, 0, 0, 0, 1, 0, 0, 0, -1),
      q: quat(0, 0, 1, 0),
    },
    {
      name: 'about Z (m22 largest)',
      R: rotMat3(-1, 0, 0, 0, -1, 0, 0, 0, 1),
      q: quat(0, 0, 0, 1),
    },
  ];

  for (const { name, R, q } of cases) {
    it(`180° ${name}: matrix → quaternion`, () => {
      const got = matrixToQuaternion(R);
      expectQuatClose(got, q);
      expect(Math.abs(quatNorm(got) - 1)).toBeLessThanOrEqual(1e-12);
    });

    it(`180° ${name}: quaternion → matrix`, () => {
      expectMatClose(quaternionToMatrix(q), R);
    });
  }
});

// --- property-based round-trips (DECISIONS #005) ----------------------------

describe('property: round-trips within 1e-12', () => {
  it('quat → matrix → quat recovers the input (up to sign)', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const back = matrixToQuaternion(quaternionToMatrix(q));
        expectQuatClose(back, q, 1e-12);
      }),
      { numRuns: 10000 },
    );
  });

  it('matrix → quat → matrix recovers the input', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const R = quaternionToMatrix(q);
        const back = quaternionToMatrix(matrixToQuaternion(R));
        expectMatClose(back, R, 1e-12);
      }),
      { numRuns: 10000 },
    );
  });
});

describe('property: quaternionToMatrix output is a proper rotation', () => {
  it('is orthonormal and has determinant +1', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const R = quaternionToMatrix(q);
        expect(orthonormalityError(R)).toBeLessThanOrEqual(1e-12);
        expect(Math.abs(det(R) - 1)).toBeLessThanOrEqual(1e-12);
      }),
      { numRuns: 10000 },
    );
  });
});

describe('property: matrixToQuaternion output is unit and canonical', () => {
  it('‖q‖ = 1 and w ≥ 0', () => {
    fc.assert(
      fc.property(unitQuaternion, (q) => {
        const out = matrixToQuaternion(quaternionToMatrix(q));
        expect(Math.abs(quatNorm(out) - 1)).toBeLessThanOrEqual(1e-12);
        expect(out.w).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 10000 },
    );
  });
});
