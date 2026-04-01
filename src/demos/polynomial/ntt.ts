/**
 * Number Theoretic Transform (NTT) — finite-field FFT.
 *
 * Converts between coefficient form and evaluation form of a polynomial
 * over the n-th roots of unity in GF(p).  All arithmetic is BigInt mod p.
 */

import { modPow, modInverse } from '@/lib/math';

/* ── helpers ─────────────────────────────────────────────── */

/** Reduce a mod p into [0, p). */
function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/* ── root of unity ───────────────────────────────────────── */

/**
 * Find a primitive n-th root of unity in GF(p).
 * Requires n | (p − 1).  Returns null if none exists.
 */
export function findPrimitiveRoot(p: bigint, n: number): bigint | null {
  const N = BigInt(n);
  if ((p - 1n) % N !== 0n) return null;

  // Find a generator of GF(p)* by trial.
  // g is a generator iff g^((p-1)/q) ≠ 1 for every prime factor q of p-1.
  const pm1 = p - 1n;
  const factors = primeFactors(pm1);

  outer:
  for (let g = 2n; g < p; g++) {
    for (const q of factors) {
      if (modPow(g, pm1 / q, p) === 1n) continue outer;
    }
    // g is a generator — derive the n-th root
    const omega = modPow(g, pm1 / N, p);
    // Verify order is exactly n
    if (modPow(omega, N, p) !== 1n) continue;
    if (n > 1 && modPow(omega, N / 2n, p) === 1n) continue;
    return omega;
  }
  return null;
}

/** Distinct prime factors of n (small numbers only). */
function primeFactors(n: bigint): bigint[] {
  const out: bigint[] = [];
  let d = 2n;
  while (d * d <= n) {
    if (n % d === 0n) {
      out.push(d);
      while (n % d === 0n) n /= d;
    }
    d++;
  }
  if (n > 1n) out.push(n);
  return out;
}

/* ── types ───────────────────────────────────────────────── */

export interface ButterflyOp {
  inputIndices: [number, number];
  twiddleFactor: bigint;
  outputValues: [bigint, bigint];
}

export interface ButterflyLayer {
  layerIndex: number;
  operations: ButterflyOp[];
}

export interface NTTResult {
  output: bigint[];
  layers: ButterflyLayer[];
}

/* ── bit-reversal permutation ────────────────────────────── */

function bitReverse(x: number, bits: number): number {
  let r = 0;
  for (let i = 0; i < bits; i++) {
    r = (r << 1) | (x & 1);
    x >>= 1;
  }
  return r;
}

function bitReversalPermutation(a: bigint[]): bigint[] {
  const n = a.length;
  const bits = Math.log2(n);
  const out = new Array<bigint>(n);
  for (let i = 0; i < n; i++) {
    out[bitReverse(i, bits)] = a[i]!;
  }
  return out;
}

/* ── forward NTT ─────────────────────────────────────────── */

/**
 * Cooley-Tukey radix-2 DIT NTT.
 * coeffs.length must be a power of 2.
 * omega must be a primitive n-th root of unity mod p.
 */
export function nttForward(
  coeffs: bigint[],
  omega: bigint,
  p: bigint,
): NTTResult {
  const n = coeffs.length;
  const layers: ButterflyLayer[] = [];

  // bit-reversal permutation
  const a = bitReversalPermutation(coeffs);

  const logn = Math.log2(n);
  for (let s = 0; s < logn; s++) {
    const m = 1 << (s + 1);          // butterfly group size
    const half = m >> 1;
    // twiddle base: ω^(n / m)
    const wBase = modPow(omega, BigInt(n / m), p);

    const ops: ButterflyOp[] = [];
    for (let k = 0; k < n; k += m) {
      let w = 1n;
      for (let j = 0; j < half; j++) {
        const u = a[k + j]!;
        const v = mod(w * a[k + j + half]!, p);
        a[k + j] = mod(u + v, p);
        a[k + j + half] = mod(u - v, p);

        ops.push({
          inputIndices: [k + j, k + j + half],
          twiddleFactor: w,
          outputValues: [a[k + j]!, a[k + j + half]!],
        });
        w = mod(w * wBase, p);
      }
    }
    layers.push({ layerIndex: s, operations: ops });
  }

  return { output: a, layers };
}

/* ── inverse NTT ─────────────────────────────────────────── */

/**
 * Inverse NTT: same algorithm with ω⁻¹, then scale by 1/n.
 */
export function nttInverse(
  evals: bigint[],
  omega: bigint,
  p: bigint,
): NTTResult {
  const n = evals.length;
  const omegaInv = modInverse(omega, p);
  const { output, layers } = nttForward(evals, omegaInv, p);
  const nInv = modInverse(BigInt(n), p);
  const scaled = output.map((v) => mod(v * nInv, p));
  return { output: scaled, layers };
}

/* ── direct evaluation (for verification) ────────────────── */

/**
 * Evaluate polynomial at a point using Horner's method in GF(p).
 */
export function evaluatePolyFp(coeffs: bigint[], x: bigint, p: bigint): bigint {
  let result = 0n;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = mod(result * x + coeffs[i]!, p);
  }
  return result;
}

/**
 * Multiply two polynomials mod p (schoolbook, for small n).
 */
export function polyMultiplyFp(a: bigint[], b: bigint[], p: bigint): bigint[] {
  if (a.length === 0 || b.length === 0) return [];
  const out = new Array<bigint>(a.length + b.length - 1).fill(0n);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] = mod(out[i + j]! + a[i]! * b[j]!, p);
    }
  }
  return out;
}

/* ── presets ──────────────────────────────────────────────── */

export interface NTTPreset {
  p: bigint;
  n: number;
  omega: bigint;
  label: string;
}

/**
 * Build verified presets at module load.
 * Each preset's root of unity is computed and verified, not hardcoded.
 */
export function buildPresets(): NTTPreset[] {
  const candidates: { p: bigint; n: number }[] = [
    { p: 257n, n: 4 },
    { p: 257n, n: 8 },
    { p: 257n, n: 16 },
  ];

  const out: NTTPreset[] = [];
  for (const { p: prime, n } of candidates) {
    const omega = findPrimitiveRoot(prime, n);
    if (omega !== null) {
      out.push({ p: prime, n, omega, label: `GF(${prime}), n=${n}` });
    }
  }
  return out;
}

export const NTT_PRESETS: NTTPreset[] = buildPresets();
