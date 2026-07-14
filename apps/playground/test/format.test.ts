import { describe, expect, it } from 'vitest';
import { formatAngle, formatNumber, radToUnit, unitToRad } from '../src/format.js';

describe('formatNumber', () => {
  it('shows the requested number of decimal places', () => {
    expect(formatNumber(Math.PI, 6)).toBe('3.141593');
    expect(formatNumber(1, 3)).toBe('1.000');
  });

  it('normalizes -0 so it never shows a negative zero', () => {
    expect(formatNumber(-0, 4)).toBe('0.0000');
    expect(formatNumber(-1e-20, 6)).toBe('0.000000');
  });
});

describe('angle conversion', () => {
  it('converts radians to degrees and back losslessly', () => {
    expect(radToUnit(Math.PI, 'deg')).toBeCloseTo(180, 12);
    expect(radToUnit(Math.PI, 'rad')).toBe(Math.PI);
    expect(unitToRad(180, 'deg')).toBeCloseTo(Math.PI, 12);
    expect(unitToRad(1.5, 'rad')).toBe(1.5);
  });

  it('formats with the right unit suffix', () => {
    expect(formatAngle(Math.PI / 2, 'deg', 1)).toBe('90.0°');
    expect(formatAngle(Math.PI / 2, 'rad', 4)).toBe('1.5708 rad');
  });
});
