/**
 * Derive-engine tests: known-answer geometry plus the passive = inverse rule.
 * Convention checks (90° about Z sends X̂ → Ŷ) guard the app-layer wiring the
 * same way rigid-kit guards the math.
 */

import { describe, expect, it } from 'vitest';
import {
  IDENTITY_QUATERNION,
  IDENTITY_ROTMAT3,
  quat,
  transform,
  vec3,
  type Quaternion,
} from 'rigid-kit';
import { deriveViews } from '../src/derive.js';
import { INITIAL_STATE, makeElement, type AppState } from '../src/state/app-state.js';

const SQRT1_2 = Math.SQRT1_2;
/** +90° about Z as a unit quaternion. */
const zHalf = quat(SQRT1_2, 0, 0, SQRT1_2);

type Overrides = Partial<Omit<AppState, 'chain' | 'selectedId'>> & { rotation?: Quaternion };

/** Build a state whose single selected element carries `rotation` (identity translation). */
function stateWith(overrides: Overrides): AppState {
  const { rotation, ...rest } = overrides;
  const chain = rotation
    ? [makeElement('0', transform(rotation, vec3(0, 0, 0)))]
    : INITIAL_STATE.chain;
  return { ...INITIAL_STATE, ...rest, chain, selectedId: '0' };
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

describe('deriveViews — non-unit hub', () => {
  it('normalizes for the geometric views but reports the raw norm', () => {
    // 2·(90° about Z): same rotation, norm 2.
    const scaled = quat(2 * SQRT1_2, 0, 0, 2 * SQRT1_2);
    const unitViews = deriveViews(stateWith({ rotation: zHalf }));
    const v = deriveViews(stateWith({ rotation: scaled }));
    expectClose(v.quaternionNorm, 2);
    expect(v.quaternionIsUnit).toBe(false);
    // Matrix (and every geometric view) matches the normalized rotation.
    expect(v.matrix).toEqual(unitViews.matrix);
    expectClose(v.axisAngle.angle, Math.PI / 2);
  });

  it('does not throw on a zero-norm hub (falls back to identity views)', () => {
    const v = deriveViews(stateWith({ rotation: quat(0, 0, 0, 0) }));
    expect(v.quaternionNorm).toBe(0);
    expect(v.quaternionIsUnit).toBe(false);
    expect(v.matrix).toEqual(IDENTITY_ROTMAT3);
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

describe('deriveViews — probe mapping', () => {
  it('normalizes the probe and maps X̂ to Ŷ under 90° about Z', () => {
    const v = deriveViews(stateWith({ rotation: zHalf, probe: vec3(3, 0, 0) }));
    expectClose(v.probeUnit.x, 1);
    expectClose(v.probeUnit.y, 0);
    expectClose(v.probeMapped.x, 0);
    expectClose(v.probeMapped.y, 1);
    expectClose(v.probeMapped.z, 0);
  });

  it('falls back to +X for a zero probe (no direction)', () => {
    const v = deriveViews(stateWith({ rotation: IDENTITY_QUATERNION, probe: vec3(0, 0, 0) }));
    expectClose(v.probeUnit.x, 1);
    expectClose(v.probeUnit.y, 0);
    expectClose(v.probeUnit.z, 0);
  });

  it('maps the probe by the passive rotation when passive is set', () => {
    // Active 90° about Z sends Ŷ → −X̂; the passive (inverse) sends Ŷ → +X̂.
    const v = deriveViews(stateWith({ rotation: zHalf, probe: vec3(0, 1, 0), passive: true }));
    expectClose(v.probeMapped.x, 1);
    expectClose(v.probeMapped.y, 0);
    expectClose(v.probeMapped.z, 0);
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

describe('deriveViews — composed chain result', () => {
  const chainState = (
    els: readonly {
      rotation?: Quaternion;
      t?: [number, number, number];
      enabled?: boolean;
      inverted?: boolean;
    }[],
    overrides: Partial<AppState> = {},
  ): AppState => ({
    ...INITIAL_STATE,
    ...overrides,
    chain: els.map((e, i) =>
      makeElement(
        String(i),
        transform(e.rotation ?? IDENTITY_QUATERNION, vec3(...(e.t ?? [0, 0, 0]))),
        e.enabled ?? true,
        e.inverted ?? false,
      ),
    ),
    selectedId: '0',
  });

  it('composes two 90°-about-Z rotations into 180° about Z', () => {
    const v = deriveViews(chainState([{ rotation: zHalf }, { rotation: zHalf }]));
    // z-component of a 180° about Z is 1, w is 0.
    expectClose(v.composed.quaternion.w, 0);
    expectClose(Math.abs(v.composed.quaternion.z), 1);
    // Selected element is still just T1 (90° about Z).
    expectClose(v.axisAngle.angle, Math.PI / 2);
  });

  it('accumulates translation through rotation: T(rot90Z)·T(shift+X) shifts by +Y', () => {
    // T1 = rot 90° about Z, T2 = translate +X. Apply T2 first, then T1.
    const v = deriveViews(chainState([{ rotation: zHalf }, { t: [1, 0, 0] }]));
    expectClose(v.composed.translation.x, 0);
    expectClose(v.composed.translation.y, 1);
    expectClose(v.composed.translation.z, 0);
  });

  it('a disabled element drops out of the product', () => {
    const withBoth = deriveViews(chainState([{ rotation: zHalf }, { rotation: zHalf }]));
    const withOne = deriveViews(
      chainState([{ rotation: zHalf }, { rotation: zHalf, enabled: false }]),
    );
    expectClose(withBoth.composed.axisAngle.angle, Math.PI); // 180°
    expectClose(withOne.composed.axisAngle.angle, Math.PI / 2); // 90°
  });

  it('an inverted element cancels its twin', () => {
    const v = deriveViews(chainState([{ rotation: zHalf }, { rotation: zHalf, inverted: true }]));
    expectClose(v.composed.axisAngle.angle, 0); // 90° · (90°)⁻¹ = identity
  });

  it('exposes one cumulative frame per enabled element', () => {
    const v = deriveViews(
      chainState([{ rotation: zHalf }, { rotation: zHalf, enabled: false }, { t: [2, 0, 0] }]),
    );
    expect(v.frames.length).toBe(2); // two enabled elements
  });

  it('names each drawn frame by its CHAIN position, skipping disabled elements', () => {
    // T2 is off, so the second drawn frame is T3 — never renumbered to "T2".
    const v = deriveViews(
      chainState([{ rotation: zHalf }, { rotation: zHalf, enabled: false }, { t: [2, 0, 0] }]),
    );
    expect(v.frameLabels).toEqual(['T1', 'T3']);
    expect(v.frameLabels.length).toBe(v.frames.length);
  });

  it('marks an inverted element in its frame name', () => {
    const v = deriveViews(chainState([{ rotation: zHalf }, { rotation: zHalf, inverted: true }]));
    expect(v.frameLabels).toEqual(['T1', 'T2⁻¹']);
  });
});
