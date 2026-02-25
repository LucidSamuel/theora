import { describe, it, expect } from 'vitest';
import {
  evaluatePolynomial,
  computeQuotientPolynomial,
  simulateKzgCommit,
  simulateKzgChallenge,
  simulateKzgProof,
  simulateKzgVerify,
  fitLagrangePolynomial,
  generatePlotPoints,
  autoScale,
} from '@/demos/polynomial/logic';

describe('evaluatePolynomial', () => {
  it('evaluates constant polynomial', () => {
    expect(evaluatePolynomial([5], 3)).toBe(5);
  });

  it('evaluates linear polynomial', () => {
    // 2 + 3x at x=4 => 2 + 12 = 14
    expect(evaluatePolynomial([2, 3], 4)).toBe(14);
  });

  it('evaluates quadratic polynomial', () => {
    // 1 + 0x + 2x^2 at x=3 => 1 + 0 + 18 = 19
    expect(evaluatePolynomial([1, 0, 2], 3)).toBe(19);
  });
});

describe('computeQuotientPolynomial', () => {
  it('returns empty for empty coefficients', () => {
    expect(computeQuotientPolynomial([], 1)).toEqual([]);
  });

  it('satisfies p(x) = (x - z) * q(x) + p(z) identity', () => {
    const coeffs = [1, -3, 2]; // 1 - 3x + 2x^2
    const z = 2;
    const pz = evaluatePolynomial(coeffs, z);
    const quotient = computeQuotientPolynomial(coeffs, z);

    // Verify at several x values
    for (const x of [-2, 0, 1, 3, 5]) {
      const qx = evaluatePolynomial(quotient, x);
      const reconstructed = (x - z) * qx + pz;
      const original = evaluatePolynomial(coeffs, x);
      expect(reconstructed).toBeCloseTo(original, 10);
    }
  });

  it('quotient is one degree less than original', () => {
    const coeffs = [1, 2, 3, 4]; // degree 3
    const quotient = computeQuotientPolynomial(coeffs, 1);
    expect(quotient).toHaveLength(3); // degree 2
  });
});

describe('simulateKzgCommit', () => {
  it('returns a hex string', async () => {
    const commitment = await simulateKzgCommit([1, 2, 3]);
    expect(commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same coefficients', async () => {
    const a = await simulateKzgCommit([1, 2, 3]);
    const b = await simulateKzgCommit([1, 2, 3]);
    expect(a).toBe(b);
  });

  it('differs for different coefficients', async () => {
    const a = await simulateKzgCommit([1, 2, 3]);
    const b = await simulateKzgCommit([4, 5, 6]);
    expect(a).not.toBe(b);
  });
});

describe('simulateKzgChallenge', () => {
  it('returns a number in [-5, 5]', () => {
    for (let i = 0; i < 50; i++) {
      const z = simulateKzgChallenge();
      expect(z).toBeGreaterThanOrEqual(-5);
      expect(z).toBeLessThanOrEqual(5);
    }
  });

  it('rounds to 2 decimal places', () => {
    for (let i = 0; i < 50; i++) {
      const z = simulateKzgChallenge();
      const rounded = Math.round(z * 100) / 100;
      expect(z).toBe(rounded);
    }
  });
});

describe('simulateKzgProof', () => {
  it('returns correct revealedValue', async () => {
    const coeffs = [1, 2, 3];
    const z = 2;
    const result = await simulateKzgProof(coeffs, z);
    const expected = evaluatePolynomial(coeffs, z);
    expect(result.revealedValue).toBe(expected);
  });

  it('returns a valid proof hash', async () => {
    const result = await simulateKzgProof([1, 2, 3], 1);
    expect(result.proofHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('quotient polynomial has correct length', async () => {
    const coeffs = [1, 2, 3, 4];
    const result = await simulateKzgProof(coeffs, 0);
    expect(result.quotientPoly).toHaveLength(coeffs.length - 1);
  });
});

describe('simulateKzgVerify', () => {
  it('verifies a valid proof', async () => {
    const coeffs = [1, 2, 3];
    const commitment = await simulateKzgCommit(coeffs);
    const z = 2;
    const { revealedValue, proofHash } = await simulateKzgProof(coeffs, z);

    const valid = await simulateKzgVerify(commitment, z, revealedValue, proofHash, coeffs);
    expect(valid).toBe(true);
  });

  it('rejects wrong commitment', async () => {
    const coeffs = [1, 2, 3];
    const z = 2;
    const { revealedValue, proofHash } = await simulateKzgProof(coeffs, z);

    const valid = await simulateKzgVerify('badcommitment', z, revealedValue, proofHash, coeffs);
    expect(valid).toBe(false);
  });

  it('rejects wrong revealed value', async () => {
    const coeffs = [1, 2, 3];
    const commitment = await simulateKzgCommit(coeffs);
    const z = 2;
    const { proofHash } = await simulateKzgProof(coeffs, z);

    const valid = await simulateKzgVerify(commitment, z, 999999, proofHash, coeffs);
    expect(valid).toBe(false);
  });
});

describe('fitLagrangePolynomial', () => {
  it('returns empty for empty points', () => {
    expect(fitLagrangePolynomial([])).toEqual([]);
  });

  it('fits through given points', () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 7 },
    ];
    const coeffs = fitLagrangePolynomial(points);

    for (const p of points) {
      expect(evaluatePolynomial(coeffs, p.x)).toBeCloseTo(p.y, 6);
    }
  });
});

describe('generatePlotPoints', () => {
  it('returns empty for empty coefficients', () => {
    expect(generatePlotPoints([], -5, 5)).toEqual([]);
  });

  it('generates correct number of points', () => {
    const points = generatePlotPoints([1, 1], -5, 5, 100);
    expect(points).toHaveLength(100);
  });

  it('points span the x range', () => {
    const points = generatePlotPoints([0, 1], -5, 5, 50);
    expect(points[0]!.x).toBeCloseTo(-5);
    expect(points[points.length - 1]!.x).toBeCloseTo(5);
  });

  it('y values match polynomial evaluation', () => {
    const coeffs = [2, 3]; // 2 + 3x
    const points = generatePlotPoints(coeffs, 0, 10, 11);
    for (const p of points) {
      expect(p.y).toBeCloseTo(evaluatePolynomial(coeffs, p.x));
    }
  });
});

describe('autoScale', () => {
  it('returns default y range for empty coefficients', () => {
    const result = autoScale([], [-5, 5]);
    expect(result.yMin).toBe(-10);
    expect(result.yMax).toBe(10);
  });

  it('x range matches input', () => {
    const result = autoScale([1, 1], [-3, 3]);
    expect(result.xMin).toBe(-3);
    expect(result.xMax).toBe(3);
  });

  it('y range covers the polynomial', () => {
    const coeffs = [0, 0, 1]; // x^2
    const result = autoScale(coeffs, [-5, 5]);
    // x^2 at x=5 is 25, so yMax should be >= 25
    expect(result.yMax).toBeGreaterThanOrEqual(25);
    expect(result.yMin).toBeLessThanOrEqual(0);
  });

  it('enforces minimum y range', () => {
    const result = autoScale([5], [-1, 1]); // constant polynomial
    expect(result.yMax - result.yMin).toBeGreaterThanOrEqual(1);
  });
});
