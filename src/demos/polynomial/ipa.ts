/**
 * Inner Product Argument (IPA) polynomial commitment scheme.
 *
 * A transparent (no trusted setup) polynomial commitment used by
 * Bulletproofs, Halo, and Ragu.  The proof is O(log n) elements.
 *
 * This implementation works over a toy finite field GF(p) rather than
 * elliptic curves.  "Generators" are random field elements and "inner
 * product" is a dot product mod p.  This simplifies the math while
 * preserving the full protocol structure.
 */

import { modPow, modInverse } from '@/lib/math';

/* ── helpers ─────────────────────────────────────────────── */

const mod = (a: bigint, p: bigint): bigint => ((a % p) + p) % p;

/* ── types ───────────────────────────────────────────────── */

export interface IPARound {
  roundNumber: number;
  aLeft: bigint[];
  aRight: bigint[];
  gLeft: bigint[];
  gRight: bigint[];
  L: bigint;
  R: bigint;
  challenge: bigint;
  newCommitment: bigint;
  newCoefficients: bigint[];
  newGenerators: bigint[];
}

export interface IPAState {
  coefficients: bigint[];
  generators: bigint[];
  commitment: bigint;
  fieldSize: bigint;
  evalPoint: bigint;
  evalValue: bigint;
  rounds: IPARound[];
  currentRound: number;
  phase: 'committed' | 'proving' | 'verified' | 'failed';
}

export function buildIpaChallenges(vectorLength: number): bigint[] {
  const rounds = Math.log2(vectorLength);
  if (!Number.isInteger(rounds) || rounds < 0) {
    throw new Error('Coefficient length must be a positive power of 2');
  }

  return Array.from({ length: rounds }, (_, i) => BigInt(i + 2));
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Generate n deterministic "generator" values in GF(p).
 * Each g[i] = (i + 2)^3 mod p, shifted to avoid collisions.
 * All values are guaranteed nonzero and distinct for reasonable n < p.
 */
export function generateGenerators(n: number, p: bigint): bigint[] {
  const generators: bigint[] = [];
  const seen = new Set<bigint>();
  for (let i = 0; i < n; i++) {
    let g = modPow(BigInt(i + 2), 3n, p);
    // In the unlikely event of a collision or zero, probe forward
    while (g === 0n || seen.has(g)) {
      g = mod(g + 1n, p);
      if (g === 0n) g = 1n;
    }
    seen.add(g);
    generators.push(g);
  }
  return generators;
}

/**
 * Compute the inner-product commitment C = sum(a[i] * G[i]) mod p.
 */
export function ipaCommit(
  coeffs: bigint[],
  generators: bigint[],
  p: bigint,
): bigint {
  let c = 0n;
  for (let i = 0; i < coeffs.length; i++) {
    c = mod(c + mod(coeffs[i]! * generators[i]!, p), p);
  }
  return c;
}

/**
 * Evaluate a polynomial at z using Horner's method in GF(p).
 * coeffs[0] is the constant term.
 */
export function evaluatePolyForIPA(
  coeffs: bigint[],
  z: bigint,
  p: bigint,
): bigint {
  let result = 0n;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = mod(result * z + coeffs[i]!, p);
  }
  return result;
}

/**
 * Run the IPA halving protocol for log2(n) rounds.
 *
 * At each round the coefficient vector `a` and generator vector `G` are
 * folded in half using a verifier challenge `u`:
 *
 *   L = <aL, gR>     (cross inner product)
 *   R = <aR, gL>
 *   a' = aL * u^{-1} + aR * u
 *   G' = gL * u     + gR * u^{-1}
 *   C' = <a', G'>    (recomputed for the toy field version)
 *
 * After log2(n) rounds, a' and G' are length 1.
 */
export function ipaProve(
  coeffs: bigint[],
  generators: bigint[],
  _commitment: bigint,
  _evalPoint: bigint,
  _evalValue: bigint,
  challenges: bigint[],
  p: bigint,
): IPARound[] {
  const rounds: IPARound[] = [];
  let a = [...coeffs];
  let g = [...generators];

  const numRounds = Math.log2(a.length);
  if (!Number.isInteger(numRounds)) {
    throw new Error('Coefficient length must be a power of 2');
  }

  for (let r = 0; r < numRounds; r++) {
    const half = a.length / 2;

    const aL = a.slice(0, half);
    const aR = a.slice(half);
    const gL = g.slice(0, half);
    const gR = g.slice(half);

    // Cross inner products
    const L = ipaCommit(aL, gR, p);
    const R = ipaCommit(aR, gL, p);

    const u = challenges[r]!;
    const uInv = modInverse(u, p);

    // Fold coefficients: a'[i] = aL[i] * u^{-1} + aR[i] * u
    const newA: bigint[] = [];
    for (let i = 0; i < half; i++) {
      newA.push(mod(mod(aL[i]! * uInv, p) + mod(aR[i]! * u, p), p));
    }

    // Fold generators: G'[i] = gL[i] * u + gR[i] * u^{-1}
    const newG: bigint[] = [];
    for (let i = 0; i < half; i++) {
      newG.push(mod(mod(gL[i]! * u, p) + mod(gR[i]! * uInv, p), p));
    }

    // Recompute commitment from folded vectors (toy field shortcut)
    const newC = ipaCommit(newA, newG, p);

    rounds.push({
      roundNumber: r,
      aLeft: aL,
      aRight: aR,
      gLeft: gL,
      gRight: gR,
      L,
      R,
      challenge: u,
      newCommitment: newC,
      newCoefficients: newA,
      newGenerators: newG,
    });

    a = newA;
    g = newG;
  }

  return rounds;
}

/**
 * Verify an IPA proof by replaying the folding from the verifier side.
 *
 * Starting from the original generators and the verifier's challenges,
 * fold the generators down to a single element.  Then check that the
 * prover's final scalar times the folded generator equals the folded
 * commitment.
 */
export function ipaVerify(
  commitment: bigint,
  _evalPoint: bigint,
  _evalValue: bigint,
  rounds: IPARound[],
  generators: bigint[],
  p: bigint,
): boolean {
  if (rounds.length === 0) return false;

  // Replay generator folding using the challenges from each round
  let g = [...generators];
  let C = commitment;

  for (const round of rounds) {
    const half = g.length / 2;
    const gL = g.slice(0, half);
    const gR = g.slice(half);

    const u = round.challenge;
    const uInv = modInverse(u, p);

    // Fold generators: same rule as prover
    const newG: bigint[] = [];
    for (let i = 0; i < half; i++) {
      newG.push(mod(mod(gL[i]! * u, p) + mod(gR[i]! * uInv, p), p));
    }

    // Fold commitment using L, R cross-terms
    const uSq = mod(u * u, p);
    const uInvSq = mod(uInv * uInv, p);
    C = mod(mod(round.L * uInvSq, p) + C + mod(round.R * uSq, p), p);

    g = newG;
  }

  // After all rounds, g and the prover's final a should be length 1
  const lastRound = rounds[rounds.length - 1]!;
  const finalA = lastRound.newCoefficients;
  const finalG = lastRound.newGenerators;

  if (finalA.length !== 1 || finalG.length !== 1) return false;

  // The folded generators from the verifier should match the prover's
  if (g.length !== 1 || g[0] !== finalG[0]) return false;

  // Final check: a[0] * G[0] ≡ C (mod p)
  const expected = mod(finalA[0]! * g[0]!, p);
  return expected === C;
}
