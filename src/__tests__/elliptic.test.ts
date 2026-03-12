import { describe, it, expect } from 'vitest';
import { DEFAULT_CURVE, enumerateCurvePoints, isOnCurve, addPoints, scalarMultiply, getDefaultGenerator } from '@/demos/elliptic/logic';

describe('elliptic logic', () => {
  it('enumerates only points that lie on the curve', () => {
    const points = enumerateCurvePoints(DEFAULT_CURVE);
    expect(points.length).toBeGreaterThan(0);
    expect(points.every((point) => isOnCurve(point, DEFAULT_CURVE))).toBe(true);
  });

  it('adds points and keeps the result on curve', () => {
    const points = enumerateCurvePoints(DEFAULT_CURVE);
    const result = addPoints(points[0]!, points[1]!, DEFAULT_CURVE);
    expect(isOnCurve(result, DEFAULT_CURVE)).toBe(true);
  });

  it('scalar multiplication matches repeated addition for 2P', () => {
    const g = getDefaultGenerator(DEFAULT_CURVE);
    const doubled = addPoints(g, g, DEFAULT_CURVE);
    const multiplied = scalarMultiply(g, 2, DEFAULT_CURVE);
    expect(multiplied.result).toEqual(doubled);
    expect(multiplied.steps.length).toBeGreaterThan(0);
  });
});
