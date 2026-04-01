import { describe, it, expect } from 'vitest';
import {
  createPolynomial,
  computeHonestSum,
  evaluateAtPoint,
  computeRoundPolynomial,
  evaluateUnivariate,
  runSumcheckProver,
  verifySumcheck,
} from '@/demos/sumcheck/logic';

const F = 101n; // field size for all tests

/* ── createPolynomial ────────────────────────────────────── */

describe('createPolynomial', () => {
  it('creates correct number of entries (2^n)', () => {
    const poly2 = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    expect(poly2.evaluations.size).toBe(4);
    expect(poly2.numVars).toBe(2);

    const poly3 = createPolynomial(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    expect(poly3.evaluations.size).toBe(8);
    expect(poly3.numVars).toBe(3);
  });

  it('indexes by binary strings in the correct order', () => {
    const poly = createPolynomial(2, F, [10n, 20n, 30n, 40n]);
    expect(poly.evaluations.get('00')).toBe(10n);
    expect(poly.evaluations.get('01')).toBe(20n);
    expect(poly.evaluations.get('10')).toBe(30n);
    expect(poly.evaluations.get('11')).toBe(40n);
  });

  it('reduces values mod fieldSize', () => {
    const poly = createPolynomial(1, F, [105n, 203n]);
    expect(poly.evaluations.get('0')).toBe(4n); // 105 mod 101
    expect(poly.evaluations.get('1')).toBe(1n); // 203 mod 101
  });

  it('throws if wrong number of values provided', () => {
    expect(() => createPolynomial(2, F, [1n, 2n, 3n])).toThrow();
  });

  it('generates random values when none provided', () => {
    const poly = createPolynomial(2, F);
    expect(poly.evaluations.size).toBe(4);
    for (const v of poly.evaluations.values()) {
      expect(v).toBeGreaterThanOrEqual(0n);
      expect(v).toBeLessThan(F);
    }
  });
});

/* ── computeHonestSum ────────────────────────────────────── */

describe('computeHonestSum', () => {
  it('matches manual sum for a known polynomial', () => {
    // f(00)=1, f(01)=2, f(10)=3, f(11)=4 → sum = 10 mod 101
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    expect(computeHonestSum(poly)).toBe(10n);
  });

  it('handles wrapping around the field', () => {
    // sum = 50 + 50 + 50 + 50 = 200 mod 101 = 99
    const poly = createPolynomial(2, F, [50n, 50n, 50n, 50n]);
    expect(computeHonestSum(poly)).toBe(99n);
  });

  it('works for 3 variables', () => {
    const vals = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const poly = createPolynomial(3, F, vals);
    // sum = 1+2+3+4+5+6+7+8 = 36
    expect(computeHonestSum(poly)).toBe(36n);
  });
});

/* ── evaluateAtPoint ─────────────────────────────────────── */

describe('evaluateAtPoint', () => {
  it('at a boolean point matches the stored evaluation', () => {
    const poly = createPolynomial(2, F, [10n, 20n, 30n, 40n]);
    // Point (0,0) → "00" → 10
    expect(evaluateAtPoint(poly, [0n, 0n])).toBe(10n);
    // Point (0,1) → "01" → 20
    expect(evaluateAtPoint(poly, [0n, 1n])).toBe(20n);
    // Point (1,0) → "10" → 30
    expect(evaluateAtPoint(poly, [1n, 0n])).toBe(30n);
    // Point (1,1) → "11" → 40
    expect(evaluateAtPoint(poly, [1n, 1n])).toBe(40n);
  });

  it('multilinear interpolation at non-boolean point', () => {
    // f(x1, x2) with evaluations: f(0,0)=1, f(0,1)=2, f(1,0)=3, f(1,1)=4
    // Multilinear extension:
    //   f(r1, r2) = 1*(1-r1)*(1-r2) + 2*(1-r1)*r2 + 3*r1*(1-r2) + 4*r1*r2
    // At (2, 3) mod 101:
    //   = 1*(1-2)*(1-3) + 2*(1-2)*3 + 3*2*(1-3) + 4*2*3
    //   = 1*(-1)*(-2) + 2*(-1)*3 + 3*2*(-2) + 4*2*3
    //   = 2 + (-6) + (-12) + 24 = 8
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    expect(evaluateAtPoint(poly, [2n, 3n])).toBe(8n);
  });

  it('multilinear interpolation for 3 variables', () => {
    // f(x1,x2,x3) = x1 + 2*x2 + 3*x3 over boolean cube:
    // f(0,0,0)=0, f(0,0,1)=3, f(0,1,0)=2, f(0,1,1)=5,
    // f(1,0,0)=1, f(1,0,1)=4, f(1,1,0)=3, f(1,1,1)=6
    const poly = createPolynomial(3, F, [0n, 3n, 2n, 5n, 1n, 4n, 3n, 6n]);
    // The multilinear extension of x1 + 2*x2 + 3*x3 is just r1 + 2*r2 + 3*r3.
    // At (5, 7, 11): 5 + 14 + 33 = 52
    expect(evaluateAtPoint(poly, [5n, 7n, 11n])).toBe(52n);
  });

  it('throws on dimension mismatch', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    expect(() => evaluateAtPoint(poly, [1n])).toThrow();
    expect(() => evaluateAtPoint(poly, [1n, 2n, 3n])).toThrow();
  });
});

/* ── evaluateUnivariate ──────────────────────────────────── */

describe('evaluateUnivariate', () => {
  it('evaluates c0 + c1*x correctly', () => {
    // 5 + 3*x at x=7: 5 + 21 = 26
    expect(evaluateUnivariate([5n, 3n], 7n, F)).toBe(26n);
  });

  it('evaluates at 0 and 1', () => {
    expect(evaluateUnivariate([5n, 3n], 0n, F)).toBe(5n);
    expect(evaluateUnivariate([5n, 3n], 1n, F)).toBe(8n);
  });

  it('handles mod reduction', () => {
    // 50 + 60*x at x=2: 50 + 120 = 170 mod 101 = 69
    expect(evaluateUnivariate([50n, 60n], 2n, F)).toBe(69n);
  });
});

/* ── computeRoundPolynomial ──────────────────────────────── */

describe('computeRoundPolynomial', () => {
  it('g1(0) + g1(1) equals the honest sum (round 1, 2 vars)', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly); // 10

    const coeffs = computeRoundPolynomial(poly, [], 0, F);
    const g0 = evaluateUnivariate(coeffs, 0n, F);
    const g1 = evaluateUnivariate(coeffs, 1n, F);

    expect((g0 + g1) % F).toBe(honestSum);
  });

  it('g1(0) + g1(1) equals the honest sum (round 1, 3 vars)', () => {
    const vals = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const poly = createPolynomial(3, F, vals);
    const honestSum = computeHonestSum(poly); // 36

    const coeffs = computeRoundPolynomial(poly, [], 0, F);
    const g0 = evaluateUnivariate(coeffs, 0n, F);
    const g1 = evaluateUnivariate(coeffs, 1n, F);

    expect((g0 + g1) % F).toBe(honestSum);
  });

  it('produces degree-1 polynomial for multilinear polynomial', () => {
    const poly = createPolynomial(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    const coeffs = computeRoundPolynomial(poly, [], 0, F);
    // Multilinear → g_i is at most degree 1, so exactly 2 coefficients
    expect(coeffs).toHaveLength(2);
  });

  it('round 2 polynomial sums match g1(r1)', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const r1 = 7n;

    // Round 1
    const coeffs1 = computeRoundPolynomial(poly, [], 0, F);
    const g1AtR1 = evaluateUnivariate(coeffs1, r1, F);

    // Round 2: fix x1 = r1
    const coeffs2 = computeRoundPolynomial(poly, [r1], 1, F);
    const g2_0 = evaluateUnivariate(coeffs2, 0n, F);
    const g2_1 = evaluateUnivariate(coeffs2, 1n, F);

    expect((g2_0 + g2_1) % F).toBe(g1AtR1);
  });
});

/* ── runSumcheckProver — honest ──────────────────────────── */

describe('runSumcheckProver (honest)', () => {
  it('all rounds pass for an honest prover (2 vars)', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly);
    const challenges = [7n, 13n];

    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    expect(rounds).toHaveLength(2);
    for (const round of rounds) {
      expect(round.sumCheck).toBe(true);
    }
  });

  it('all rounds pass for an honest prover (3 vars)', () => {
    const poly = createPolynomial(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    const honestSum = computeHonestSum(poly);
    const challenges = [7n, 13n, 42n];

    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    expect(rounds).toHaveLength(3);
    for (const round of rounds) {
      expect(round.sumCheck).toBe(true);
    }
  });

  it('round numbers are 1-indexed', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const rounds = runSumcheckProver(poly, computeHonestSum(poly), [5n, 9n], F);
    expect(rounds[0]!.roundNumber).toBe(1);
    expect(rounds[1]!.roundNumber).toBe(2);
  });

  it('stores challenges and evalAtChallenge', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const challenges = [7n, 13n];
    const rounds = runSumcheckProver(poly, computeHonestSum(poly), challenges, F);

    expect(rounds[0]!.challenge).toBe(7n);
    expect(rounds[1]!.challenge).toBe(13n);
    expect(rounds[0]!.evalAtChallenge).toBe(
      evaluateUnivariate(rounds[0]!.univariatePoly, 7n, F),
    );
  });
});

/* ── runSumcheckProver — cheating ────────────────────────── */

describe('runSumcheckProver (cheating)', () => {
  it('at least one round fails when sum is wrong', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly); // 10
    const wrongSum = honestSum + 1n; // 11
    const challenges = [7n, 13n];

    const rounds = runSumcheckProver(poly, wrongSum, challenges, F);

    // The first round should fail because g1(0)+g1(1) = honestSum != wrongSum
    expect(rounds[0]!.sumCheck).toBe(false);
  });
});

/* ── verifySumcheck ──────────────────────────────────────── */

describe('verifySumcheck', () => {
  it('returns passed=true for honest execution (2 vars)', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly);
    const challenges = [7n, 13n];
    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    const result = verifySumcheck(poly, honestSum, rounds, challenges, F);
    expect(result.passed).toBe(true);
    expect(result.failedRound).toBeNull();
  });

  it('returns passed=true for honest execution (3 vars)', () => {
    const poly = createPolynomial(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    const honestSum = computeHonestSum(poly);
    const challenges = [7n, 13n, 42n];
    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    const result = verifySumcheck(poly, honestSum, rounds, challenges, F);
    expect(result.passed).toBe(true);
    expect(result.failedRound).toBeNull();
  });

  it('detects wrong claimed sum at round 1', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly);
    const wrongSum = honestSum + 5n;
    const challenges = [7n, 13n];

    // Prover honestly computes round polynomials, but the claim is wrong
    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    // Verify against the wrong sum — round 1 should fail
    const result = verifySumcheck(poly, wrongSum, rounds, challenges, F);
    expect(result.passed).toBe(false);
    expect(result.failedRound).toBe(1);
  });

  it('detects tampered round polynomial', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly);
    const challenges = [7n, 13n];
    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    // Tamper with round 2's polynomial
    const tampered = rounds.map((r, i) => {
      if (i === 1) {
        return { ...r, univariatePoly: [r.univariatePoly[0]! + 1n, r.univariatePoly[1]!] };
      }
      return r;
    });

    const result = verifySumcheck(poly, honestSum, tampered, challenges, F);
    expect(result.passed).toBe(false);
    // Could fail at round 2 (sum check) or final oracle check
    expect(result.failedRound).not.toBeNull();
  });

  it('different challenges produce different round polynomials', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly);

    const rounds1 = runSumcheckProver(poly, honestSum, [3n, 5n], F);
    const rounds2 = runSumcheckProver(poly, honestSum, [17n, 23n], F);

    // Round 1 polynomials are the same (no challenges fixed yet)
    expect(rounds1[0]!.univariatePoly).toEqual(rounds2[0]!.univariatePoly);

    // But evalAtChallenge differs (different challenge applied)
    expect(rounds1[0]!.evalAtChallenge).not.toBe(rounds2[0]!.evalAtChallenge);

    // Round 2 polynomials differ because different r1 was fixed
    expect(rounds1[1]!.univariatePoly).not.toEqual(rounds2[1]!.univariatePoly);
  });

  it('final oracle check catches inconsistency', () => {
    const poly = createPolynomial(2, F, [1n, 2n, 3n, 4n]);
    const honestSum = computeHonestSum(poly);
    const challenges = [7n, 13n];
    const rounds = runSumcheckProver(poly, honestSum, challenges, F);

    // Create a different polynomial with the same sum
    // but different evaluations — the final oracle check should catch this
    const fakePoly = createPolynomial(2, F, [4n, 3n, 2n, 1n]); // same sum (10)
    expect(computeHonestSum(fakePoly)).toBe(honestSum); // same sum

    // Rounds were generated from original poly, but verify against fakePoly
    const result = verifySumcheck(fakePoly, honestSum, rounds, challenges, F);
    // The round checks may pass (if the sum matches), but the final oracle
    // check should fail because f(r1,r2) differs between the two polynomials
    expect(result.passed).toBe(false);
  });
});
