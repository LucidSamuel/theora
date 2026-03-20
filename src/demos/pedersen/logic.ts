export interface PedersenParams {
  p: number; // prime modulus
  g: number; // generator 1
  h: number; // generator 2 (h = g^s for unknown s)
}

export interface Commitment {
  value: number;       // v
  randomness: number;  // r
  commitment: number;  // C = g^v * h^r mod p
}

export interface HomomorphicResult {
  c1: Commitment;
  c2: Commitment;
  combined: number;      // C1 * C2 mod p
  sumValue: number;      // v1 + v2
  sumRandomness: number; // r1 + r2
  valid: boolean;        // combined === commit(sumValue, sumRandomness).commitment
}

/**
 * Modular exponentiation: base^exp mod mod
 * Uses repeated squaring for efficiency and correctness on large inputs.
 */
export function modPow(base: number, exp: number, mod: number): number {
  if (mod === 1) return 0;
  let result = 1;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) {
      result = (result * b) % mod;
    }
    b = (b * b) % mod;
    e = Math.floor(e / 2);
  }
  return result;
}

/**
 * Default parameters for the small cyclic group demo.
 * p = 97 (prime), g = 5 (generator of the full group Z_97*),
 * h = 47 = 5^39 mod 97 (discrete log of h w.r.t. g is unknown to the committer).
 */
export const DEFAULT_PARAMS: PedersenParams = {
  p: 97,
  g: 5,
  h: 47,
};

/**
 * Compute a Pedersen commitment: C = g^v * h^r mod p
 */
export function commit(params: PedersenParams, value: number, randomness: number): Commitment {
  const { p, g, h } = params;
  const gv = modPow(g, value, p);
  const hr = modPow(h, randomness, p);
  const c = (gv * hr) % p;
  return { value, randomness, commitment: c };
}

/**
 * Verify a commitment by recomputing and comparing.
 */
export function verify(params: PedersenParams, commitment: Commitment): boolean {
  const recomputed = commit(params, commitment.value, commitment.randomness);
  return recomputed.commitment === commitment.commitment;
}

/**
 * Homomorphic addition of two commitments.
 * Pedersen commitments are additively homomorphic:
 *   commit(v1, r1) * commit(v2, r2) = commit(v1 + v2, r1 + r2)
 * (all modular arithmetic in the exponent mod p-1 via Fermat's little theorem)
 */
export function homomorphicAdd(params: PedersenParams, c1: Commitment, c2: Commitment): HomomorphicResult {
  const { p } = params;
  const combined = (c1.commitment * c2.commitment) % p;
  const sumValue = c1.value + c2.value;
  const sumRandomness = c1.randomness + c2.randomness;
  const expected = commit(params, sumValue, sumRandomness);
  return {
    c1,
    c2,
    combined,
    sumValue,
    sumRandomness,
    valid: combined === expected.commitment,
  };
}

/**
 * Find the order of element g in Z_p*.
 * The order divides p-1 by Lagrange's theorem.
 */
function elementOrder(g: number, p: number): number {
  for (let k = 1; k <= p - 1; k++) {
    if (modPow(g, k, p) === 1) return k;
  }
  return p - 1;
}

/**
 * Find two independent generators for a demo group.
 * Returns g (the smallest primitive root mod p) and h = g^floor(order/3) mod p,
 * ensuring h != g and h != 1.
 */
export function findGenerators(p: number): { g: number; h: number } {
  // Find a primitive root mod p
  let g = 2;
  while (g < p) {
    const ord = elementOrder(g, p);
    if (ord === p - 1) break;
    g++;
  }

  // Pick h = g^k for some k that is not 0, 1, or p-2 (so h != 1, g, g^(p-2))
  const k = Math.floor((p - 1) / 3) || 1;
  const h = modPow(g, k, p);
  return { g, h };
}
