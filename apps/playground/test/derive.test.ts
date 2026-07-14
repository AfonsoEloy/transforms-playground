/**
 * Derive-engine tests: known-answer geometry plus the passive = inverse rule.
 * Convention checks (90° about Z sends X̂ → Ŷ) guard the app-layer wiring the
 * same way rigid-kit guards the math.
 */

import { describe, expect, it } from 'vitest';
import { IDENTITY_QUATERNION, IDENTITY_ROTMAT3, quat } from 'rigid-kit';
import { deriveViews } from '../src/derive.js';
import { INITIAL_STATE, type AppState } from '../src/state/app-state.js';

const SQRT1_2 = Math.SQRT1_2;
/** +90° about Z as a unit quaternion. */
const zHalf = quat(SQRT1_2, 0, 0, SQRT1_2);

function stateWith(overrides: Partial<AppState>): AppState {
  return { ...INITIAL_STATE, ...overrides };
}

function expectClose(a: number, b: number, tol = 1e-12): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
}

describe('deriveViews — known answers', () => {
  it('identity rotation yields the identity matrix and zero angles', () => {
    const v = deriveViews(stateWith({ rotation: IDENTITY_QUATERNION }));
    expect(v.matrix).toEqual(IDENTITY_ROTMAT3);
    expect(v.quaternion).toEqual(IDENTITY_QUATERNION);
    expectClose(v.axisAngle.angle, 0);
    expectClose(v.rotationVector.x, 0);
    expectClose(v.rotationVector.y, 0);
    expectClose(v.rotationVector.z, 0);
    expect(v.nearGimbalLock).toBe(false);
  });

  it('90° about Z sends X̂ to Ŷ (matrix first column is [0,1,0])', () => {
    const v = deriveViews(stateWith({ rotation: zHalf }));
    expectClose(v.matrix.m00, 0);
    expectClose(v.matrix.m10, 1);
    expectClose(v.matrix.m20, 0);
    // axis is +Z, angle is +90°
    expectClose(v.axisAngle.axis.z, 1);
    expectClose(v.axisAngle.angle, Math.PI / 2);
  });

  it('canonicalizes a negative-w hub for display (w ≥ 0)', () => {
    const v = deriveViews(stateWith({ rotation: quat(-SQRT1_2, 0, 0, -SQRT1_2) }));
    expect(v.quaternion.w).toBeGreaterThanOrEqual(0);
    expectClose(v.quaternion.w, SQRT1_2);
    expectClose(v.quaternion.z, SQRT1_2);
  });
});

describe('deriveViews — passive display is the inverse rotation', () => {
  it('passive view of +90° about Z is −90° about Z (matrix transposed)', () => {
    const active = deriveViews(stateWith({ rotation: zHalf, passive: false }));
    const passive = deriveViews(stateWith({ rotation: zHalf, passive: true }));
    // Transpose relationship: m10 ↔ m01.
    expectClose(passive.matrix.m01, active.matrix.m10);
    expectClose(passive.matrix.m10, active.matrix.m01);
    // Angle negates.
    expectClose(passive.axisAngle.axis.z * passive.axisAngle.angle, -Math.PI / 2);
  });
});

describe('deriveViews — gimbal lock flag', () => {
  it('flags pitch = 90° for an intrinsic ZYX (yaw-pitch-roll) sequence', () => {
    // 90° about Y is the singular middle rotation for ZYX.
    const yHalf = quat(SQRT1_2, 0, SQRT1_2, 0);
    const v = deriveViews(
      stateWith({ rotation: yHalf, eulerOrder: 'ZYX', eulerFrame: 'intrinsic' }),
    );
    expect(v.nearGimbalLock).toBe(true);
    expect(v.gimbalProximity).toBeGreaterThan(0.999);
  });
});
