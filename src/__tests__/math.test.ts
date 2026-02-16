import { describe, it, expect } from 'vitest';
import {
  modPow,
  isPrime,
  nextPrime,
  generatePrimes,
  gcd,
  extendedGcd,
  modInverse,
  polynomialEvaluate,
  lagrangeInterpolation,
  polynomialMultiply,
  polynomialAdd,
  polynomialScale,
} from '@/lib/math';

describe('modPow', () => {
  it('computes 2^10 mod 1000 = 24', () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n);
  });

  it('handles mod 1 → 0', () => {
    expect(modPow(5n, 3n, 1n)).toBe(0n);
  });

  it('handles exponent 0 → 1', () => {
    expect(modPow(7n, 0n, 13n)).toBe(1n);
  });

  it('handles large exponent', () => {
    expect(modPow(65537n, 7n, 1000000007n * 1000000009n)).toBeTypeOf('bigint');
  });
});

describe('isPrime', () => {
  it('identifies small primes', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(3)).toBe(true);
    expect(isPrime(5)).toBe(true);
    expect(isPrime(7)).toBe(true);
    expect(isPrime(11)).toBe(true);
    expect(isPrime(13)).toBe(true);
  });

  it('rejects non-primes', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(4)).toBe(false);
    expect(isPrime(9)).toBe(false);
    expect(isPrime(15)).toBe(false);
    expect(isPrime(100)).toBe(false);
  });

  it('identifies larger primes', () => {
    expect(isPrime(97)).toBe(true);
    expect(isPrime(997)).toBe(true);
    expect(isPrime(7919)).toBe(true);
  });

  it('rejects negative numbers', () => {
    expect(isPrime(-5)).toBe(false);
  });
});

describe('nextPrime', () => {
  it('finds next prime after 4', () => {
    expect(nextPrime(4)).toBe(5);
  });

  it('finds next prime after 7', () => {
    expect(nextPrime(7)).toBe(11);
  });

  it('returns 2 for inputs < 2', () => {
    expect(nextPrime(0)).toBe(2);
    expect(nextPrime(1)).toBe(2);
  });
});

describe('generatePrimes', () => {
  it('generates first 5 primes', () => {
    expect(generatePrimes(5)).toEqual([2, 3, 5, 7, 11]);
  });

  it('generates 0 primes', () => {
    expect(generatePrimes(0)).toEqual([]);
  });
});

describe('gcd', () => {
  it('computes gcd(12, 8) = 4', () => {
    expect(gcd(12n, 8n)).toBe(4n);
  });

  it('computes gcd of coprimes', () => {
    expect(gcd(7n, 13n)).toBe(1n);
  });

  it('handles negative values', () => {
    expect(gcd(-12n, 8n)).toBe(4n);
  });
});

describe('extendedGcd', () => {
  it('finds Bezout coefficients', () => {
    const { gcd: g, x, y } = extendedGcd(35n, 15n);
    expect(g).toBe(5n);
    expect(35n * x + 15n * y).toBe(g);
  });

  it('works for coprimes', () => {
    const { gcd: g, x, y } = extendedGcd(7n, 11n);
    expect(g).toBe(1n);
    expect(7n * x + 11n * y).toBe(1n);
  });
});

describe('modInverse', () => {
  it('computes inverse of 3 mod 7', () => {
    const inv = modInverse(3n, 7n);
    expect((3n * inv) % 7n).toBe(1n);
  });

  it('throws for non-invertible', () => {
    expect(() => modInverse(4n, 8n)).toThrow();
  });
});

describe('polynomialEvaluate', () => {
  it('evaluates constant polynomial', () => {
    expect(polynomialEvaluate([5], 10)).toBe(5);
  });

  it('evaluates x^2 at x=3', () => {
    // [0, 0, 1] = x^2
    expect(polynomialEvaluate([0, 0, 1], 3)).toBe(9);
  });

  it('evaluates 2x + 1 at x=5', () => {
    expect(polynomialEvaluate([1, 2], 5)).toBe(11);
  });

  it('evaluates empty coefficients as 0', () => {
    expect(polynomialEvaluate([], 5)).toBe(0);
  });
});

describe('lagrangeInterpolation', () => {
  it('fits a line through 2 points', () => {
    const coeffs = lagrangeInterpolation([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
    ]);
    // y = 2x + 1
    expect(coeffs[0]).toBeCloseTo(1, 5);
    expect(coeffs[1]).toBeCloseTo(2, 5);
  });

  it('fits a quadratic through 3 points', () => {
    const coeffs = lagrangeInterpolation([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ]);
    // y = x^2
    expect(coeffs[0]).toBeCloseTo(0, 5);
    expect(coeffs[1]).toBeCloseTo(0, 5);
    expect(coeffs[2]).toBeCloseTo(1, 5);
  });
});

describe('polynomialMultiply', () => {
  it('multiplies (x+1)(x+1) = x^2 + 2x + 1', () => {
    const result = polynomialMultiply([1, 1], [1, 1]);
    expect(result).toEqual([1, 2, 1]);
  });

  it('handles empty arrays', () => {
    expect(polynomialMultiply([], [1, 2])).toEqual([]);
  });
});

describe('polynomialAdd', () => {
  it('adds [1,2] + [3,4] = [4,6]', () => {
    expect(polynomialAdd([1, 2], [3, 4])).toEqual([4, 6]);
  });

  it('handles different lengths', () => {
    expect(polynomialAdd([1], [1, 2, 3])).toEqual([2, 2, 3]);
  });
});

describe('polynomialScale', () => {
  it('scales [1,2,3] by 2', () => {
    expect(polynomialScale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });
});
