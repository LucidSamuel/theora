import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CURVE,
  enumerateCurvePoints,
  isOnCurve,
  addPoints,
  scalarMultiply,
  getDefaultGenerator,
  isPrime,
  isCurveValid,
} from '@/demos/elliptic/logic';

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

describe('isPrime', () => {
  it('correctly identifies primes', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(3)).toBe(true);
    expect(isPrime(5)).toBe(true);
    expect(isPrime(7)).toBe(true);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(997)).toBe(true);
  });

  it('rejects non-primes', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(4)).toBe(false);
    expect(isPrime(6)).toBe(false);
    expect(isPrime(9)).toBe(false);
    expect(isPrime(100)).toBe(false);
  });
});

describe('isCurveValid', () => {
  it('validates default curve', () => {
    expect(isCurveValid(DEFAULT_CURVE)).toBe(true);
  });

  it('validates test kit curve y² = x³ + x + 1 (mod 7)', () => {
    expect(isCurveValid({ p: 7, a: 1, b: 1 })).toBe(true);
  });

  it('rejects singular curves', () => {
    // 4(0)³ + 27(0)² = 0 mod any prime → singular
    expect(isCurveValid({ p: 7, a: 0, b: 0 })).toBe(false);
  });

  it('rejects non-prime field', () => {
    expect(isCurveValid({ p: 4, a: 1, b: 1 })).toBe(false);
  });
});

describe('configurable curves', () => {
  it('enumerates y² = x³ + x + 1 (mod 7) correctly', () => {
    const curve = { p: 7, a: 1, b: 1 };
    const points = enumerateCurvePoints(curve);
    // Expected from test kit: (0,1), (0,6), (2,2), (2,5) = 4 affine points
    expect(points.length).toBe(4);
    expect(points).toContainEqual({ x: 0, y: 1 });
    expect(points).toContainEqual({ x: 0, y: 6 });
    expect(points).toContainEqual({ x: 2, y: 2 });
    expect(points).toContainEqual({ x: 2, y: 5 });
    expect(points.every((p) => isOnCurve(p, curve))).toBe(true);
  });

  it('point addition works on small field', () => {
    const curve = { p: 7, a: 1, b: 1 };
    const p1 = { x: 0, y: 1 };
    const p2 = { x: 2, y: 2 };
    const result = addPoints(p1, p2, curve);
    expect(result).not.toBeNull();
    expect(isOnCurve(result, curve)).toBe(true);
  });

  it('point at infinity for inverse points', () => {
    const curve = { p: 7, a: 1, b: 1 };
    const p1 = { x: 0, y: 1 };
    const p2 = { x: 0, y: 6 }; // negation of p1
    const result = addPoints(p1, p2, curve);
    expect(result).toBeNull(); // point at infinity
  });
});
