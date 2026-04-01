import { describe, it, expect } from 'vitest';
import {
  findPrimitiveRoot,
  nttForward,
  nttInverse,
  evaluatePolyFp,
  polyMultiplyFp,
  NTT_PRESETS,
} from '../demos/polynomial/ntt';
import { modPow } from '../lib/math';

describe('findPrimitiveRoot', () => {
  it('finds a valid 8th root of unity in GF(257)', () => {
    const omega = findPrimitiveRoot(257n, 8);
    expect(omega).not.toBeNull();
    // ω^8 ≡ 1 mod 257
    expect(modPow(omega!, 8n, 257n)).toBe(1n);
    // ω^4 ≢ 1 mod 257 (primitive, not a 4th root)
    expect(modPow(omega!, 4n, 257n)).not.toBe(1n);
  });

  it('finds a valid 4th root of unity in GF(257)', () => {
    const omega = findPrimitiveRoot(257n, 4);
    expect(omega).not.toBeNull();
    expect(modPow(omega!, 4n, 257n)).toBe(1n);
    expect(modPow(omega!, 2n, 257n)).not.toBe(1n);
  });

  it('finds a valid 16th root of unity in GF(257)', () => {
    const omega = findPrimitiveRoot(257n, 16);
    expect(omega).not.toBeNull();
    expect(modPow(omega!, 16n, 257n)).toBe(1n);
    expect(modPow(omega!, 8n, 257n)).not.toBe(1n);
  });

  it('returns null when n does not divide p-1', () => {
    // 101 - 1 = 100 = 2^2 * 5^2, so 8 does not divide 100
    expect(findPrimitiveRoot(101n, 8)).toBeNull();
  });
});

describe('NTT_PRESETS', () => {
  it('has at least 3 presets', () => {
    expect(NTT_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('all presets have verified roots of unity', () => {
    for (const preset of NTT_PRESETS) {
      const N = BigInt(preset.n);
      expect(modPow(preset.omega, N, preset.p)).toBe(1n);
      if (preset.n > 1) {
        expect(modPow(preset.omega, N / 2n, preset.p)).not.toBe(1n);
      }
    }
  });
});

describe('nttForward', () => {
  const p = 257n;

  it('matches direct polynomial evaluation at roots of unity', () => {
    const omega = findPrimitiveRoot(p, 8)!;
    const coeffs = [3n, 1n, 4n, 1n, 5n, 9n, 2n, 6n];
    const { output } = nttForward(coeffs, omega, p);

    for (let i = 0; i < 8; i++) {
      const x = modPow(omega, BigInt(i), p);
      const expected = evaluatePolyFp(coeffs, x, p);
      expect(output[i]).toBe(expected);
    }
  });

  it('produces correct number of butterfly layers', () => {
    const omega = findPrimitiveRoot(p, 8)!;
    const coeffs = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const { layers } = nttForward(coeffs, omega, p);
    expect(layers.length).toBe(3); // log2(8) = 3
  });

  it('works for n=4', () => {
    const omega = findPrimitiveRoot(p, 4)!;
    const coeffs = [10n, 20n, 30n, 40n];
    const { output } = nttForward(coeffs, omega, p);

    for (let i = 0; i < 4; i++) {
      const x = modPow(omega, BigInt(i), p);
      expect(output[i]).toBe(evaluatePolyFp(coeffs, x, p));
    }
  });
});

describe('nttInverse', () => {
  const p = 257n;

  it('recovers original coefficients (round-trip)', () => {
    const omega = findPrimitiveRoot(p, 8)!;
    const original = [3n, 1n, 4n, 1n, 5n, 9n, 2n, 6n];
    const { output: evals } = nttForward(original, omega, p);
    const { output: recovered } = nttInverse(evals, omega, p);
    expect(recovered).toEqual(original);
  });

  it('round-trips for n=4', () => {
    const omega = findPrimitiveRoot(p, 4)!;
    const original = [7n, 13n, 42n, 99n];
    const { output: evals } = nttForward(original, omega, p);
    const { output: recovered } = nttInverse(evals, omega, p);
    expect(recovered).toEqual(original);
  });

  it('round-trips for n=16', () => {
    const omega = findPrimitiveRoot(p, 16)!;
    const original = Array.from({ length: 16 }, (_, i) => BigInt(i + 1));
    const { output: evals } = nttForward(original, omega, p);
    const { output: recovered } = nttInverse(evals, omega, p);
    expect(recovered).toEqual(original);
  });
});

describe('pointwise multiplication equivalence', () => {
  const p = 257n;

  it('pointwise mul in eval form equals polynomial mul in coeff form', () => {
    const omega = findPrimitiveRoot(p, 8)!;
    // Two polynomials of degree 3 each (padded to 8 for multiplication result)
    const a = [2n, 3n, 1n, 0n, 0n, 0n, 0n, 0n]; // 2 + 3x + x²
    const b = [1n, 1n, 0n, 0n, 0n, 0n, 0n, 0n]; // 1 + x

    // NTT approach: transform, pointwise multiply, inverse transform
    const { output: aEvals } = nttForward(a, omega, p);
    const { output: bEvals } = nttForward(b, omega, p);
    const cEvals = aEvals.map((v, i) => (v * bEvals[i]!) % p);
    const { output: cCoeffs } = nttInverse(cEvals, omega, p);

    // Direct approach: schoolbook multiply then pad
    const directProduct = polyMultiplyFp([2n, 3n, 1n], [1n, 1n], p);
    const padded = [...directProduct, ...new Array(8 - directProduct.length).fill(0n)];

    expect(cCoeffs).toEqual(padded);
  });
});

describe('evaluatePolyFp', () => {
  it('evaluates constant polynomial', () => {
    expect(evaluatePolyFp([42n], 7n, 101n)).toBe(42n);
  });

  it('evaluates x^2 + x + 5 at x=7 in GF(101)', () => {
    // 49 + 7 + 5 = 61
    expect(evaluatePolyFp([5n, 1n, 1n], 7n, 101n)).toBe(61n);
  });
});
