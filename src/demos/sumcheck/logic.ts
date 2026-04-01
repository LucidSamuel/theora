/**
 * Sumcheck Protocol — pure logic.
 *
 * The sumcheck protocol lets a verifier check the sum of a multilinear
 * polynomial over the boolean hypercube {0,1}^n without evaluating all
 * 2^n points.  The prover sends one univariate polynomial per round;
 * the verifier checks a simple consistency condition, then sends a
 * random challenge.  After n rounds the verifier makes a single oracle
 * query to confirm the final value.
 *
 * All arithmetic is BigInt mod fieldSize.
 */

/* ── helpers ─────────────────────────────────────────────── */

/** Reduce a mod p into [0, p). */
function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/* ── types ───────────────────────────────────────────────── */

export interface MultivariatePolynomial {
  numVars: number;
  /** Evaluations indexed by binary string: "000" -> value, "001" -> value, etc. */
  evaluations: Map<string, bigint>;
  fieldSize: bigint;
}

export interface SumcheckRound {
  roundNumber: number; // 1-indexed
  /** Univariate polynomial g_i(x_i) as coefficients [c0, c1, ...] */
  univariatePoly: bigint[];
  evalAt0: bigint; // g_i(0)
  evalAt1: bigint; // g_i(1)
  expectedSum: bigint; // what eval0 + eval1 should equal
  sumCheck: boolean; // does eval0 + eval1 === expectedSum?
  challenge: bigint | null; // r_i
  evalAtChallenge: bigint | null; // g_i(r_i)
}

export interface SumcheckState {
  polynomial: MultivariatePolynomial;
  numVariables: number;
  fieldSize: bigint;
  claimedSum: bigint;
  currentRound: number; // 0 to n
  rounds: SumcheckRound[];
  challenges: bigint[];
  phase: 'setup' | 'proving' | 'verifying' | 'complete';
  verdict: 'honest' | 'cheating_caught' | null;
  cheatMode: boolean;
  cheatSum: bigint | null;
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Create a multilinear polynomial over {0,1}^numVars.
 *
 * If `values` is provided it must have exactly 2^numVars entries
 * (one per boolean-hypercube point, indexed in binary order).
 * Otherwise random values in [0, fieldSize) are generated.
 */
export function createPolynomial(
  numVars: number,
  fieldSize: bigint,
  values?: bigint[],
): MultivariatePolynomial {
  const size = 1 << numVars; // 2^numVars

  if (values !== undefined) {
    if (values.length !== size) {
      throw new Error(`Expected ${size} values for ${numVars} variables, got ${values.length}`);
    }
  }

  const evaluations = new Map<string, bigint>();

  for (let i = 0; i < size; i++) {
    const key = i.toString(2).padStart(numVars, '0');
    if (values !== undefined) {
      evaluations.set(key, mod(values[i]!, fieldSize));
    } else {
      // Deterministic-ish random for reproducibility in non-test usage:
      // callers that need determinism should pass explicit values.
      const v = BigInt(Math.floor(Math.random() * Number(fieldSize)));
      evaluations.set(key, v);
    }
  }

  return { numVars, evaluations, fieldSize };
}

/**
 * Sum all evaluations of the polynomial over {0,1}^n, mod fieldSize.
 */
export function computeHonestSum(poly: MultivariatePolynomial): bigint {
  let sum = 0n;
  for (const v of poly.evaluations.values()) {
    sum = mod(sum + v, poly.fieldSize);
  }
  return sum;
}

/**
 * Evaluate the multilinear extension at an arbitrary point (r1,...,rn).
 *
 * Uses the multilinear interpolation formula:
 *   f(r1,...,rn) = sum_{x in {0,1}^n} f(x) * prod_i (x_i*r_i + (1-x_i)*(1-r_i))
 *
 * All arithmetic mod fieldSize.
 */
export function evaluateAtPoint(poly: MultivariatePolynomial, point: bigint[]): bigint {
  if (point.length !== poly.numVars) {
    throw new Error(`Point dimension ${point.length} != polynomial variables ${poly.numVars}`);
  }

  const p = poly.fieldSize;
  let result = 0n;

  for (const [key, val] of poly.evaluations) {
    let product = 1n;
    for (let i = 0; i < poly.numVars; i++) {
      const xi = BigInt(key[i] === '1' ? 1 : 0);
      const ri = mod(point[i]!, p);
      // xi * ri + (1 - xi) * (1 - ri)
      const term = mod(xi * ri + mod(1n - xi, p) * mod(1n - ri, p), p);
      product = mod(product * term, p);
    }
    result = mod(result + mod(val * product, p), p);
  }

  return result;
}

/**
 * Compute the univariate round polynomial g_i(x_i) for the given round.
 *
 * g_i(x_i) = sum_{x_{i+1},...,x_n in {0,1}} f(r_1,...,r_{i-1}, x_i, x_{i+1},...,x_n)
 *
 * For a multilinear polynomial, g_i is degree-1: g_i(x_i) = c0 + c1*x_i.
 * We compute g_i(0) and g_i(1) directly, then derive the coefficients.
 *
 * @param poly         The original polynomial
 * @param fixedVars    Challenges r_1,...,r_{i-1} already fixed (length = roundIndex)
 * @param roundIndex   0-indexed round (which variable we're summing over)
 * @param fieldSize    Field modulus
 * @returns [c0, c1] coefficients of the univariate polynomial
 */
export function computeRoundPolynomial(
  poly: MultivariatePolynomial,
  fixedVars: bigint[],
  roundIndex: number,
  fieldSize: bigint,
): bigint[] {
  const n = poly.numVars;
  const freeVars = n - roundIndex - 1; // number of variables still free (after x_i)

  // Compute g_i(target) for target in {0, 1}
  // by summing over all {0,1}^freeVars assignments for variables after roundIndex
  function computeGiAt(target: bigint): bigint {
    const numFree = 1 << freeVars;
    let sum = 0n;

    for (let mask = 0; mask < numFree; mask++) {
      // Build the full point: [r_0, ..., r_{i-1}, target, free bits...]
      const point: bigint[] = [];
      for (let j = 0; j < roundIndex; j++) {
        point.push(fixedVars[j]!);
      }
      point.push(target);
      for (let j = 0; j < freeVars; j++) {
        point.push(BigInt((mask >> (freeVars - 1 - j)) & 1));
      }

      sum = mod(sum + evaluateAtPoint(poly, point), fieldSize);
    }

    return sum;
  }

  const g0 = computeGiAt(0n);
  const g1 = computeGiAt(1n);

  // g_i(x) = c0 + c1*x, where c0 = g_i(0), c1 = g_i(1) - g_i(0)
  const c0 = g0;
  const c1 = mod(g1 - g0, fieldSize);

  return [c0, c1];
}

/**
 * Evaluate a univariate polynomial (given as coefficients) at point x.
 * coeffs = [c0, c1, c2, ...] represents c0 + c1*x + c2*x^2 + ...
 */
export function evaluateUnivariate(coeffs: bigint[], x: bigint, fieldSize: bigint): bigint {
  let result = 0n;
  let xPow = 1n;
  for (const c of coeffs) {
    result = mod(result + mod(c * xPow, fieldSize), fieldSize);
    xPow = mod(xPow * x, fieldSize);
  }
  return result;
}

/**
 * Run all n rounds of the sumcheck prover.
 *
 * For each round i (1-indexed):
 *   1. Compute the univariate g_i(x_i)
 *   2. Check g_i(0) + g_i(1) against the expected sum
 *   3. Apply the verifier's challenge r_i
 *
 * The expected sum for round 1 is claimedSum.
 * The expected sum for round i > 1 is g_{i-1}(r_{i-1}).
 */
export function runSumcheckProver(
  poly: MultivariatePolynomial,
  claimedSum: bigint,
  challenges: bigint[],
  fieldSize: bigint,
): SumcheckRound[] {
  const n = poly.numVars;
  if (challenges.length !== n) {
    throw new Error(`Need ${n} challenges, got ${challenges.length}`);
  }

  const rounds: SumcheckRound[] = [];
  const fixedVars: bigint[] = [];
  let expectedSum = mod(claimedSum, fieldSize);

  for (let i = 0; i < n; i++) {
    const coeffs = computeRoundPolynomial(poly, fixedVars, i, fieldSize);

    const evalAt0 = evaluateUnivariate(coeffs, 0n, fieldSize);
    const evalAt1 = evaluateUnivariate(coeffs, 1n, fieldSize);
    const sumCheck = mod(evalAt0 + evalAt1, fieldSize) === expectedSum;

    const challenge = challenges[i]!;
    const evalAtChallenge = evaluateUnivariate(coeffs, challenge, fieldSize);

    rounds.push({
      roundNumber: i + 1,
      univariatePoly: coeffs,
      evalAt0,
      evalAt1,
      expectedSum,
      sumCheck,
      challenge,
      evalAtChallenge,
    });

    fixedVars.push(challenge);
    expectedSum = evalAtChallenge;
  }

  return rounds;
}

/**
 * Verify all round checks plus the final oracle query.
 *
 * Checks:
 *   1. For each round i: g_i(0) + g_i(1) === expectedSum_i
 *   2. Final oracle: f(r_1,...,r_n) === g_n(r_n)
 *
 * Returns which round failed (if any). failedRound is 1-indexed,
 * or n+1 if the final oracle check failed.
 */
export function verifySumcheck(
  poly: MultivariatePolynomial,
  claimedSum: bigint,
  rounds: SumcheckRound[],
  challenges: bigint[],
  fieldSize: bigint,
): { passed: boolean; failedRound: number | null } {
  const n = poly.numVars;

  // Check each round
  let expectedSum = mod(claimedSum, fieldSize);
  for (let i = 0; i < n; i++) {
    const round = rounds[i]!;
    const sum = mod(round.evalAt0 + round.evalAt1, fieldSize);
    if (sum !== expectedSum) {
      return { passed: false, failedRound: i + 1 };
    }
    // Next round's expected sum is g_i(r_i)
    expectedSum = evaluateUnivariate(round.univariatePoly, challenges[i]!, fieldSize);
  }

  // Final oracle check: f(r_1,...,r_n) === g_n(r_n)
  const lastRound = rounds[n - 1]!;
  const lastEval = evaluateUnivariate(
    lastRound.univariatePoly,
    challenges[n - 1]!,
    fieldSize,
  );
  const oracleEval = evaluateAtPoint(poly, challenges);

  if (lastEval !== oracleEval) {
    return { passed: false, failedRound: n + 1 };
  }

  return { passed: true, failedRound: null };
}
