/**
 * FRI (Fast Reed-Solomon Interactive Oracle Proof of Proximity).
 *
 * Proves that a committed function is close to a low-degree polynomial
 * by repeatedly folding the evaluation domain.  Each round halves the
 * degree and domain size; after log2(n) rounds a constant remains.
 *
 * All arithmetic is BigInt mod p, using GF(257) by default since
 * 256 = 2^8 gives convenient roots of unity for power-of-two domains.
 */

import { modPow, modInverse } from '@/lib/math';

/* ── helpers ─────────────────────────────────────────────── */

/** Reduce a mod p into [0, p). */
function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/* ── types ───────────────────────────────────────────────── */

export interface FRILayer {
  evaluations: bigint[];     // values at each domain point
  domain: bigint[];          // domain points (powers of omega)
  degree: number;            // maximum degree of polynomial in this layer
  challenge: bigint | null;  // alpha sent by verifier (null for first layer)
}

export interface FRICommitPhase {
  layers: FRILayer[];
  fieldSize: bigint;
  originalDomain: bigint[];
  originalEvaluations: bigint[];
  finalConstant: bigint;
}

export interface FRIQueryRound {
  queryIndex: number;
  layerValues: {
    value: bigint;
    siblingValue: bigint;
    foldedValue: bigint;
    consistent: boolean;
  }[];
}

export interface FRIResult {
  commitPhase: FRICommitPhase;
  queries: FRIQueryRound[];
  accepted: boolean;
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Evaluate a polynomial (coefficient form) at a single point using
 * Horner's method in GF(p).  coeffs[0] is the constant term.
 */
export function evaluatePoly(coeffs: bigint[], x: bigint, p: bigint): bigint {
  let result = 0n;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = mod(result * x + coeffs[i]!, p);
  }
  return result;
}

/**
 * Evaluate a polynomial on every point of a domain.
 * Returns an array where out[i] = poly(domain[i]).
 */
export function evaluateOnDomain(
  coeffs: bigint[],
  domain: bigint[],
  p: bigint,
): bigint[] {
  return domain.map((x) => evaluatePoly(coeffs, x, p));
}

/**
 * Split a coefficient-form polynomial into even and odd components:
 *
 *   f(x) = f_even(x^2) + x * f_odd(x^2)
 *
 * where f_even holds coefficients at even indices and f_odd holds
 * coefficients at odd indices.
 */
export function splitEvenOdd(coeffs: bigint[]): { even: bigint[]; odd: bigint[] } {
  const even: bigint[] = [];
  const odd: bigint[] = [];
  for (let i = 0; i < coeffs.length; i++) {
    if (i % 2 === 0) {
      even.push(coeffs[i]!);
    } else {
      odd.push(coeffs[i]!);
    }
  }
  return { even, odd };
}

/**
 * Fold a polynomial with verifier challenge alpha:
 *
 *   f'(x) = f_even(x) + alpha * f_odd(x)
 *
 * The result has half the degree of the input.
 */
export function foldPolynomial(
  coeffs: bigint[],
  alpha: bigint,
  p: bigint,
): bigint[] {
  const { even, odd } = splitEvenOdd(coeffs);
  const len = Math.max(even.length, odd.length);
  const folded: bigint[] = [];
  for (let i = 0; i < len; i++) {
    const e = i < even.length ? even[i]! : 0n;
    const o = i < odd.length ? odd[i]! : 0n;
    folded.push(mod(e + mod(alpha * o, p), p));
  }
  return folded;
}

/**
 * Square every element of a domain to produce the half-sized domain
 * for the next FRI layer.
 *
 * If the domain is the n-th roots of unity {1, w, w^2, ..., w^(n-1)},
 * squaring maps each pair (w^i, w^{i+n/2}) to the same point w^{2i},
 * yielding the (n/2)-th roots of unity.
 */
export function halveDomain(domain: bigint[], p: bigint): bigint[] {
  const half = domain.length / 2;
  const newDomain: bigint[] = [];
  for (let i = 0; i < half; i++) {
    newDomain.push(mod(domain[i]! * domain[i]!, p));
  }
  return newDomain;
}

/**
 * Build the full FRI commit phase.
 *
 * Starting from polynomial `coeffs` evaluated over the domain generated
 * by `omega` (a primitive n-th root of unity mod p), perform log2(n)
 * folding rounds using the supplied verifier challenges.
 *
 * Returns all layers including the initial evaluation and the final
 * constant value.
 */
export function friCommit(
  coeffs: bigint[],
  omega: bigint,
  p: bigint,
  challenges: bigint[],
): FRICommitPhase {
  const n = coeffs.length;
  if (!Number.isInteger(Math.log2(n)) || n < 2) {
    throw new Error('Coefficient length must be a power of 2 and >= 2');
  }

  const numRounds = Math.log2(n);
  if (challenges.length < numRounds) {
    throw new Error(
      `Need ${numRounds} challenges for ${n} coefficients, got ${challenges.length}`,
    );
  }

  // Build initial domain: {omega^0, omega^1, ..., omega^(n-1)}
  let domain: bigint[] = [];
  for (let i = 0; i < n; i++) {
    domain.push(modPow(omega, BigInt(i), p));
  }

  const originalDomain = [...domain];
  const originalEvaluations = evaluateOnDomain(coeffs, domain, p);

  const layers: FRILayer[] = [];

  // Layer 0: original evaluations
  layers.push({
    evaluations: [...originalEvaluations],
    domain: [...domain],
    degree: n - 1,
    challenge: null,
  });

  let currentCoeffs = [...coeffs];

  // Folding rounds
  for (let round = 0; round < numRounds; round++) {
    const alpha = challenges[round]!;

    // Fold the polynomial coefficients
    currentCoeffs = foldPolynomial(currentCoeffs, alpha, p);

    // Halve the domain
    domain = halveDomain(domain, p);

    // Evaluate folded polynomial on new domain
    const evals = evaluateOnDomain(currentCoeffs, domain, p);

    layers.push({
      evaluations: evals,
      domain: [...domain],
      degree: currentCoeffs.length - 1,
      challenge: alpha,
    });
  }

  // The final layer should be a constant polynomial
  const finalLayer = layers[layers.length - 1]!;
  const finalConstant = finalLayer.evaluations[0]!;

  return {
    layers,
    fieldSize: p,
    originalDomain,
    originalEvaluations,
    finalConstant,
  };
}

/**
 * Run consistency queries against a FRI commit phase.
 *
 * For each query index, walk through consecutive layers and verify that
 * the folding relation holds:
 *
 *   f_{i+1}(x^2) = (f_i(x) + f_i(-x)) / 2  +  alpha * (f_i(x) - f_i(-x)) / (2x)
 *
 * In practice, for a domain of n-th roots of unity with index `idx`,
 * the "sibling" index is `idx + n/2` (mod n), because
 * omega^{idx + n/2} = -omega^idx.
 */
export function friQuery(
  commitPhase: FRICommitPhase,
  queryIndices: number[],
  p: bigint,
): FRIQueryRound[] {
  const queries: FRIQueryRound[] = [];

  for (const qi of queryIndices) {
    const layerValues: FRIQueryRound['layerValues'] = [];

    let idx = qi;

    for (let l = 0; l < commitPhase.layers.length - 1; l++) {
      const layer = commitPhase.layers[l]!;
      const nextLayer = commitPhase.layers[l + 1]!;
      const n = layer.evaluations.length;
      const half = n / 2;

      // Wrap index into current layer size
      const currentIdx = ((idx % n) + n) % n;
      // Sibling: omega^{idx + n/2} = -omega^idx
      const siblingIdx = (currentIdx + half) % n;

      const x = layer.domain[currentIdx]!;
      const fx = layer.evaluations[currentIdx]!;
      const fNegx = layer.evaluations[siblingIdx]!;

      const alpha = nextLayer.challenge!;

      // Compute expected folded value:
      // f_even(x^2) = (f(x) + f(-x)) / 2
      // f_odd(x^2)  = (f(x) - f(-x)) / (2 * x)
      // folded      = f_even(x^2) + alpha * f_odd(x^2)
      const two = 2n;
      const twoInv = modInverse(two, p);
      const xInv = modInverse(x, p);

      const fEven = mod(mod(fx + fNegx, p) * twoInv, p);
      const fOdd = mod(mod(fx - fNegx + p, p) * twoInv % p * xInv, p);
      const expectedFolded = mod(fEven + mod(alpha * fOdd, p), p);

      // The folded value in the next layer at the corresponding index
      const foldedIdx = currentIdx % half;
      const actualFolded = nextLayer.evaluations[foldedIdx]!;

      const consistent = expectedFolded === actualFolded;

      layerValues.push({
        value: fx,
        siblingValue: fNegx,
        foldedValue: actualFolded,
        consistent,
      });

      // For the next layer, the index maps to the first half
      idx = foldedIdx;
    }

    queries.push({ queryIndex: qi, layerValues });
  }

  return queries;
}

/**
 * Run the full FRI protocol: commit phase followed by query phase.
 *
 * Returns the commit layers, query results, and an overall accept/reject
 * decision.  The protocol accepts iff:
 *   1. The final layer is a constant (all evaluations equal).
 *   2. All query consistency checks pass.
 */
export function friProtocol(
  coeffs: bigint[],
  omega: bigint,
  p: bigint,
  challenges: bigint[],
  queryIndices: number[],
): FRIResult {
  const commitPhase = friCommit(coeffs, omega, p, challenges);

  // Check that the final layer is constant
  const finalLayer = commitPhase.layers[commitPhase.layers.length - 1]!;
  const finalConstant = finalLayer.evaluations[0]!;
  const isConstant = finalLayer.evaluations.every((v) => v === finalConstant);

  // Run queries
  const queries = friQuery(commitPhase, queryIndices, p);

  // All query checks must pass
  const allConsistent = queries.every((q) =>
    q.layerValues.every((lv) => lv.consistent),
  );

  return {
    commitPhase,
    queries,
    accepted: isConstant && allConsistent,
  };
}
