import { describe, it, expect } from 'vitest';
import {
  evaluatePolyMod,
  addPolyMod,
  scalePolyMod,
  divideByLinearMod,
  batchOpen,
} from '@/demos/polynomial/batchOpening';

const P = 101n; // GF(101)

const mod = (a: bigint, p: bigint): bigint => ((a % p) + p) % p;

describe('evaluatePolyMod', () => {
  it('evaluates a constant polynomial', () => {
    expect(evaluatePolyMod([7n], 42n, P)).toBe(7n);
  });

  it('evaluates a linear polynomial', () => {
    // 3 + 5x at x = 4 => 3 + 20 = 23
    expect(evaluatePolyMod([3n, 5n], 4n, P)).toBe(23n);
  });

  it('evaluates a quadratic polynomial', () => {
    // 1 + 0x + 2x² at x = 3 => 1 + 18 = 19
    expect(evaluatePolyMod([1n, 0n, 2n], 3n, P)).toBe(19n);
  });

  it('reduces modulo p', () => {
    // 50 + 60x at x = 2 => 50 + 120 = 170 ≡ 69 (mod 101)
    expect(evaluatePolyMod([50n, 60n], 2n, P)).toBe(69n);
  });

  it('matches known values for x² + x + 5 in GF(101)', () => {
    // f(x) = 5 + x + x²
    const coeffs = [5n, 1n, 1n];
    // f(0) = 5, f(1) = 7, f(10) = 115 ≡ 14 (mod 101)
    expect(evaluatePolyMod(coeffs, 0n, P)).toBe(5n);
    expect(evaluatePolyMod(coeffs, 1n, P)).toBe(7n);
    expect(evaluatePolyMod(coeffs, 10n, P)).toBe(14n);
  });
});

describe('addPolyMod', () => {
  it('adds polynomials of equal length', () => {
    expect(addPolyMod([1n, 2n], [3n, 4n], P)).toEqual([4n, 6n]);
  });

  it('pads shorter polynomial with zeros', () => {
    expect(addPolyMod([1n], [0n, 0n, 5n], P)).toEqual([1n, 0n, 5n]);
  });

  it('reduces mod p', () => {
    expect(addPolyMod([60n], [50n], P)).toEqual([9n]);
  });
});

describe('scalePolyMod', () => {
  it('scales each coefficient', () => {
    expect(scalePolyMod([2n, 3n], 5n, P)).toEqual([10n, 15n]);
  });

  it('reduces mod p', () => {
    expect(scalePolyMod([51n], 2n, P)).toEqual([1n]);
  });
});

describe('divideByLinearMod', () => {
  it('correctly divides (x² - 1) by (x - 1) to get (x + 1)', () => {
    // x² - 1 in GF(101) = [-1, 0, 1] = [100, 0, 1]
    const poly = [mod(-1n, P), 0n, 1n]; // coeffs: [100, 0, 1]
    const root = 1n;
    const q = divideByLinearMod(poly, root, P);

    // Expected: x + 1 = [1, 1]
    expect(q).toEqual([1n, 1n]);

    // Verify: (x - 1)(x + 1) = x² - 1
    // Evaluate both sides at x = 5:
    // (5 - 1)(5 + 1) = 24
    // 5² - 1 = 24
    const x = 5n;
    const qAtX = evaluatePolyMod(q, x, P);
    const linearAtX = mod(x - root, P);
    const productAtX = mod(qAtX * linearAtX, P);
    const originalAtX = evaluatePolyMod(poly, x, P);
    expect(productAtX).toBe(originalAtX);
  });

  it('correctly divides (x² + 2x + 1) by (x + 1) i.e. root = -1', () => {
    // x² + 2x + 1 = (x + 1)², root of (x - (-1)) is -1 ≡ 100 (mod 101)
    const poly = [1n, 2n, 1n];
    const root = mod(-1n, P); // 100
    const q = divideByLinearMod(poly, root, P);

    // Expected: x + 1 = [1, 1]
    expect(q).toEqual([1n, 1n]);
  });

  it('returns empty for constant polynomial', () => {
    expect(divideByLinearMod([42n], 3n, P)).toEqual([]);
  });

  it('returns empty for empty polynomial', () => {
    expect(divideByLinearMod([], 3n, P)).toEqual([]);
  });
});

describe('batchOpen — 2 polynomials', () => {
  it('produces a consistent result', () => {
    // f1(x) = 1 + 2x, f2(x) = 3 + 4x
    const result = batchOpen({
      polynomials: [[1n, 2n], [3n, 4n]],
      evalPoint: 5n,
      gamma: 7n,
      fieldSize: P,
    });

    expect(result.consistent).toBe(true);
    expect(result.combinedEval).toBe(result.combinedEvalCheck);

    // f1(5) = 1 + 10 = 11
    expect(result.individualEvals[0]).toBe(11n);
    // f2(5) = 3 + 20 = 23
    expect(result.individualEvals[1]).toBe(23n);
  });

  it('combinedEval matches weighted sum of individual evals', () => {
    const gamma = 7n;
    const result = batchOpen({
      polynomials: [[1n, 2n], [3n, 4n]],
      evalPoint: 5n,
      gamma,
      fieldSize: P,
    });

    // h(z) should equal γ⁰·f1(z) + γ¹·f2(z)
    const expected = mod(
      1n * result.individualEvals[0]! + gamma * result.individualEvals[1]!,
      P,
    );
    expect(result.combinedEval).toBe(expected);
  });

  it('generates visualization steps', () => {
    const result = batchOpen({
      polynomials: [[1n, 2n], [3n, 4n]],
      evalPoint: 5n,
      gamma: 7n,
      fieldSize: P,
    });

    expect(result.steps.length).toBe(4);
    expect(result.steps[0]!.stepName).toBe('Evaluate polynomials');
    expect(result.steps[1]!.stepName).toBe('Combine polynomials');
    expect(result.steps[2]!.stepName).toBe('Consistency check');
    expect(result.steps[3]!.stepName).toBe('Quotient polynomial');
  });
});

describe('batchOpen — 3 polynomials', () => {
  it('produces a consistent result', () => {
    // f1(x) = 2, f2(x) = x, f3(x) = x²
    const result = batchOpen({
      polynomials: [[2n], [0n, 1n], [0n, 0n, 1n]],
      evalPoint: 3n,
      gamma: 11n,
      fieldSize: P,
    });

    expect(result.consistent).toBe(true);
    expect(result.individualEvals).toEqual([2n, 3n, 9n]);
  });

  it('combinedEval matches sum of γⁱ·fᵢ(z) for 3 polys', () => {
    const gamma = 11n;
    const z = 3n;
    const result = batchOpen({
      polynomials: [[2n], [0n, 1n], [0n, 0n, 1n]],
      evalPoint: z,
      gamma,
      fieldSize: P,
    });

    // h(z) = γ⁰·2 + γ¹·3 + γ²·9 = 2 + 33 + 121·9
    // = 2 + 33 + 1089 = 1124 ≡ 1124 mod 101 = 1124 - 11*101 = 1124 - 1111 = 13
    const g0 = 1n;
    const g1 = gamma;
    const g2 = mod(gamma * gamma, P);
    const expected = mod(
      g0 * result.individualEvals[0]! +
        g1 * result.individualEvals[1]! +
        g2 * result.individualEvals[2]!,
      P,
    );
    expect(result.combinedEval).toBe(expected);
  });
});

describe('batchOpen — quotient verification', () => {
  it('quotient satisfies h(x) - h(z) = (x - z) · q(x)', () => {
    const result = batchOpen({
      polynomials: [[1n, 2n, 3n], [4n, 5n]],
      evalPoint: 6n,
      gamma: 13n,
      fieldSize: P,
    });

    expect(result.consistent).toBe(true);

    // Verify the quotient identity at multiple test points
    for (const x of [1n, 2n, 7n, 10n, 50n]) {
      const hx = evaluatePolyMod(result.combinedPoly, x, P);
      const hz = result.combinedEval;
      const qx = evaluatePolyMod(result.quotientPoly, x, P);
      const lhs = mod(hx - hz, P);
      const rhs = mod(mod(x - 6n, P) * qx, P);
      expect(lhs).toBe(rhs);
    }
  });
});
