/**
 * Tests for arrow-key nudge math (SPEC §4 Phase 4). Pins the modifier step scale
 * and the float-noise cleanup.
 */

import { describe, expect, it } from 'vitest';
import { computeNudge, nudgeMultiplier } from '../src/nudge.js';

const NONE = { shift: false, alt: false };

describe('nudgeMultiplier', () => {
  it('is 1 with no modifier', () => {
    expect(nudgeMultiplier(NONE)).toBe(1);
  });
  it('is 10 with Shift (coarse)', () => {
    expect(nudgeMultiplier({ shift: true, alt: false })).toBe(10);
  });
  it('is 0.1 with Alt (fine)', () => {
    expect(nudgeMultiplier({ shift: false, alt: true })).toBe(0.1);
  });
  it('prefers Shift when both are held', () => {
    expect(nudgeMultiplier({ shift: true, alt: true })).toBe(10);
  });
});

describe('computeNudge', () => {
  it('adds one step up and subtracts one step down', () => {
    expect(computeNudge(0, 1, 1, NONE)).toBe(1);
    expect(computeNudge(0, 1, -1, NONE)).toBe(-1);
  });

  it('scales the step by the modifier', () => {
    expect(computeNudge(0, 1, 1, { shift: true, alt: false })).toBe(10);
    expect(computeNudge(0, 1, 1, { shift: false, alt: true })).toBe(0.1);
  });

  it('respects a small base step', () => {
    expect(computeNudge(0.7, 0.01, 1, NONE)).toBe(0.71);
  });

  it('cleans binary-float accumulation', () => {
    // 0.1 + 0.2 would be 0.30000000000000004 without the cleanup.
    expect(computeNudge(0.1, 0.2, 1, NONE)).toBe(0.3);
  });
});
