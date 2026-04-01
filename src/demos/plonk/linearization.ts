import type { PlonkGate } from './logic';
import { modPow, modInverse } from '../../lib/math';

const mod = (a: bigint, p: bigint): bigint => ((a % p) + p) % p;

// ── Types ──────────────────────────────────────────────────────────

export interface LinearizationStep {
  stepName: string;
  description: string;
  /** The polynomial terms at this step */
  terms: { label: string; coefficient: string; polynomial: string }[];
  totalDegree: number;
}

export interface LinearizationResult {
  challengePoint: bigint;
  /** Wire evaluations at the challenge point */
  wireEvals: { a: bigint; b: bigint; c: bigint };
  /** The full polynomial identity (before linearization) */
  fullSteps: LinearizationStep[];
  /** The linearized polynomial (after plugging in wire evaluations) */
  linearizedSteps: LinearizationStep[];
  /** The full check value: C(ζ) - t(ζ)·Z_H(ζ) — should be 0 if gates hold */
  fullCheckValue: bigint;
  /** The linearized check value: r(ζ) - t(ζ)·Z_H(ζ) — should be 0 if gates hold */
  linearizedCheckValue: bigint;
  consistent: boolean;
}

// ── Finite-field polynomial helpers ────────────────────────────────

/**
 * Evaluate a polynomial (coefficients in ascending degree order) at x over GF(p).
 * coeffs[0] + coeffs[1]·x + coeffs[2]·x² + ...
 */
function polyEvalMod(coeffs: bigint[], x: bigint, p: bigint): bigint {
  let result = 0n;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = mod(result * x + coeffs[i]!, p);
  }
  return result;
}

/**
 * Lagrange interpolation over GF(p).
 * Given points [(x0,y0), ...], returns polynomial coefficients [c0, c1, ...] in ascending order.
 */
function lagrangeInterpolateMod(
  points: { x: bigint; y: bigint }[],
  p: bigint,
): bigint[] {
  const n = points.length;
  const result: bigint[] = new Array(n).fill(0n);

  for (let i = 0; i < n; i++) {
    let basis: bigint[] = [points[i]!.y];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const denom = mod(points[i]!.x - points[j]!.x, p);
      const scale = modInverse(denom, p);
      const negXj = mod(-points[j]!.x, p);

      const newBasis: bigint[] = new Array(basis.length + 1).fill(0n);
      for (let k = 0; k < basis.length; k++) {
        newBasis[k + 1] = mod(newBasis[k + 1]! + mod(basis[k]! * scale, p), p);
        newBasis[k] = mod(newBasis[k]! + mod(basis[k]! * mod(negXj * scale, p), p), p);
      }
      basis = newBasis;
    }

    for (let k = 0; k < basis.length && k < n; k++) {
      result[k] = mod(result[k]! + basis[k]!, p);
    }
  }

  return result;
}

/** Add two polynomials over GF(p). */
function polyAddMod(a: bigint[], b: bigint[], p: bigint): bigint[] {
  const len = Math.max(a.length, b.length);
  const result: bigint[] = [];
  for (let i = 0; i < len; i++) {
    result.push(mod((a[i] ?? 0n) + (b[i] ?? 0n), p));
  }
  return result;
}

/** Scale a polynomial by a scalar over GF(p). */
function polyScaleMod(coeffs: bigint[], scalar: bigint, p: bigint): bigint[] {
  return coeffs.map((c) => mod(c * scalar, p));
}

/** Multiply two polynomials over GF(p). */
function polyMulMod(a: bigint[], b: bigint[], p: bigint): bigint[] {
  if (a.length === 0 || b.length === 0) return [];
  const result: bigint[] = new Array(a.length + b.length - 1).fill(0n);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] = mod(result[i + j]! + mod(a[i]! * b[j]!, p), p);
    }
  }
  return result;
}

/**
 * Polynomial long division over GF(p): compute quotient q and remainder r
 * such that dividend = divisor * q + r.
 * Returns { quotient, remainder } with coefficient arrays in ascending order.
 */
function polyDivMod(
  dividend: bigint[],
  divisor: bigint[],
  p: bigint,
): { quotient: bigint[]; remainder: bigint[] } {
  // Work with copies, trim trailing zeros for degree calculations.
  let rem = [...dividend];
  const divDeg = polyDegree(divisor);
  if (divDeg < 0) throw new Error('Division by zero polynomial');

  const leadInv = modInverse(divisor[divDeg]!, p);
  const quotient: bigint[] = [];

  while (true) {
    const remDeg = polyDegree(rem);
    if (remDeg < divDeg) break;

    const degDiff = remDeg - divDeg;
    const coeff = mod(rem[remDeg]! * leadInv, p);

    // Ensure quotient array is large enough.
    while (quotient.length <= degDiff) quotient.push(0n);
    quotient[degDiff] = coeff;

    // Subtract coeff * x^degDiff * divisor from rem.
    for (let i = 0; i <= divDeg; i++) {
      const idx = i + degDiff;
      while (rem.length <= idx) rem.push(0n);
      rem[idx] = mod(rem[idx]! - mod(coeff * divisor[i]!, p), p);
    }
  }

  if (quotient.length === 0) quotient.push(0n);
  return { quotient, remainder: rem };
}

/** Degree of a polynomial (index of highest non-zero coefficient), or -1 for zero poly. */
function polyDegree(coeffs: bigint[]): number {
  for (let i = coeffs.length - 1; i >= 0; i--) {
    if (coeffs[i] !== 0n) return i;
  }
  return -1;
}

/** Check if a polynomial is the zero polynomial mod p. */
function polyIsZero(coeffs: bigint[]): boolean {
  return coeffs.every((c) => c === 0n);
}

// ── Evaluation domain ──────────────────────────────────────────────

/**
 * Build an evaluation domain of size n over GF(p).
 * If n-th roots of unity exist (p - 1 divisible by n), use them.
 * Otherwise, fall back to {1, 2, ..., n}.
 */
function findEvaluationDomain(n: number, p: bigint): bigint[] {
  const groupOrder = p - 1n;
  if (groupOrder % BigInt(n) === 0n) {
    const exp = groupOrder / BigInt(n);
    for (let g = 2n; g < p; g++) {
      const omega = modPow(g, exp, p);
      if (omega !== 1n && modPow(omega, BigInt(n), p) === 1n) {
        const domain: bigint[] = [];
        let w = 1n;
        const seen = new Set<bigint>();
        let valid = true;
        for (let i = 0; i < n; i++) {
          if (seen.has(w)) { valid = false; break; }
          seen.add(w);
          domain.push(w);
          w = mod(w * omega, p);
        }
        if (valid && domain.length === n) return domain;
      }
    }
  }

  const domain: bigint[] = [];
  for (let i = 1; i <= n; i++) {
    domain.push(BigInt(i));
  }
  return domain;
}

/**
 * Build the vanishing polynomial Z_H(x) = (x - d[0])(x - d[1])...(x - d[n-1])
 * over GF(p), given the evaluation domain d.
 */
function buildVanishingPoly(domain: bigint[], p: bigint): bigint[] {
  let poly: bigint[] = [1n]; // start with constant 1
  for (const d of domain) {
    // Multiply by (x - d)
    poly = polyMulMod(poly, [mod(-d, p), 1n], p);
  }
  return poly;
}

// ── Linearization ──────────────────────────────────────────────────

/**
 * Perform the PLONK linearization trick on the given gates.
 *
 * The gate constraint polynomial is:
 *   C(x) = qL(x)*a(x) + qR(x)*b(x) + qO(x)*c(x) + qM(x)*a(x)*b(x) + qC(x)
 *
 * If all gate equations hold, C(x) vanishes on the evaluation domain H, meaning
 * Z_H(x) divides C(x). The quotient polynomial t(x) = C(x) / Z_H(x) exists.
 *
 * The PLONK verifier check at a random challenge point zeta:
 *   C(zeta) - t(zeta) * Z_H(zeta) = 0
 *
 * The linearization trick: instead of evaluating the full polynomial C(x)
 * (which has degree ~2*(n-1) due to products of degree-(n-1) polynomials),
 * the prover sends wire evaluations a(zeta), b(zeta), c(zeta) as scalars, reducing:
 *   r(x) = a(zeta)*qL(x) + b(zeta)*qR(x) + c(zeta)*qO(x) + a(zeta)*b(zeta)*qM(x) + qC(x)
 *
 * r(x) has degree n-1 (not ~2*(n-1)), and r(zeta) = C(zeta).
 * The verifier checks r(zeta) - t(zeta)*Z_H(zeta) = 0.
 */
export function linearize(
  gates: PlonkGate[],
  challengePoint: bigint,
  p: bigint,
): LinearizationResult {
  const n = gates.length;
  const domain = findEvaluationDomain(n, p);

  // ── Interpolate selector polynomials ──
  const selectorNames = ['qL', 'qR', 'qO', 'qM', 'qC'] as const;
  const selectorKeys: Record<typeof selectorNames[number], keyof PlonkGate> = {
    qL: 'qL', qR: 'qR', qO: 'qO', qM: 'qM', qC: 'qC',
  };
  const selectorPolys: Record<string, bigint[]> = {};

  for (const name of selectorNames) {
    const points = gates.map((g, i) => ({
      x: domain[i]!,
      y: mod(BigInt(g[selectorKeys[name]] as number), p),
    }));
    selectorPolys[name] = lagrangeInterpolateMod(points, p);
  }

  // ── Interpolate wire polynomials ──
  const wireNames = ['a', 'b', 'c'] as const;
  const wirePolys: Record<string, bigint[]> = {};

  for (const w of wireNames) {
    const points = gates.map((g, i) => ({
      x: domain[i]!,
      y: mod(BigInt(g[w]), p),
    }));
    wirePolys[w] = lagrangeInterpolateMod(points, p);
  }

  // ── Wire evaluations at the challenge point ──
  const aEval = polyEvalMod(wirePolys['a']!, challengePoint, p);
  const bEval = polyEvalMod(wirePolys['b']!, challengePoint, p);
  const cEval = polyEvalMod(wirePolys['c']!, challengePoint, p);

  // ── Build C(x) = qL(x)*a(x) + qR(x)*b(x) + qO(x)*c(x) + qM(x)*a(x)*b(x) + qC(x) ──
  const term1 = polyMulMod(selectorPolys['qL']!, wirePolys['a']!, p);
  const term2 = polyMulMod(selectorPolys['qR']!, wirePolys['b']!, p);
  const term3 = polyMulMod(selectorPolys['qO']!, wirePolys['c']!, p);
  const ab = polyMulMod(wirePolys['a']!, wirePolys['b']!, p);
  const term4 = polyMulMod(selectorPolys['qM']!, ab, p);
  const term5 = selectorPolys['qC']!;

  let fullPoly = polyAddMod(term1, term2, p);
  fullPoly = polyAddMod(fullPoly, term3, p);
  fullPoly = polyAddMod(fullPoly, term4, p);
  fullPoly = polyAddMod(fullPoly, term5, p);

  const fullDegree = polyDegree(fullPoly);

  // ── Build vanishing polynomial Z_H(x) and compute quotient t(x) = C(x) / Z_H(x) ──
  const zH = buildVanishingPoly(domain, p);
  const { quotient: tPoly, remainder } = polyDivMod(fullPoly, zH, p);
  const divisible = polyIsZero(remainder);

  // Evaluate at challenge point
  const cOfZeta = polyEvalMod(fullPoly, challengePoint, p);
  const tOfZeta = polyEvalMod(tPoly, challengePoint, p);
  const zHOfZeta = polyEvalMod(zH, challengePoint, p);

  // Full check: C(zeta) - t(zeta) * Z_H(zeta) = 0
  const fullCheckValue = mod(cOfZeta - mod(tOfZeta * zHOfZeta, p), p);

  // ── Linearized polynomial r(x) = a(zeta)*qL(x) + b(zeta)*qR(x) + c(zeta)*qO(x) + a(zeta)*b(zeta)*qM(x) + qC(x) ──
  const lTerm1 = polyScaleMod(selectorPolys['qL']!, aEval, p);
  const lTerm2 = polyScaleMod(selectorPolys['qR']!, bEval, p);
  const lTerm3 = polyScaleMod(selectorPolys['qO']!, cEval, p);
  const lTerm4 = polyScaleMod(selectorPolys['qM']!, mod(aEval * bEval, p), p);
  const lTerm5 = selectorPolys['qC']!;

  let linearizedPoly = polyAddMod(lTerm1, lTerm2, p);
  linearizedPoly = polyAddMod(linearizedPoly, lTerm3, p);
  linearizedPoly = polyAddMod(linearizedPoly, lTerm4, p);
  linearizedPoly = polyAddMod(linearizedPoly, lTerm5, p);

  const rOfZeta = polyEvalMod(linearizedPoly, challengePoint, p);
  const linearizedDegree = polyDegree(linearizedPoly);

  // Linearized check: r(zeta) - t(zeta) * Z_H(zeta) = 0
  // Since r(zeta) = C(zeta) by construction, this equals the full check.
  const linearizedCheckValue = mod(rOfZeta - mod(tOfZeta * zHOfZeta, p), p);

  // ── Step descriptions for visualization ──
  const fullSteps: LinearizationStep[] = [
    {
      stepName: 'Full polynomial identity',
      description:
        `C(x) = qL(x)*a(x) + qR(x)*b(x) + qO(x)*c(x) + qM(x)*a(x)*b(x) + qC(x), check C(zeta) = t(zeta)*Z_H(zeta). ${divisible ? 'Z_H divides C(x).' : 'Z_H leaves a non-zero remainder.'}`,
      terms: [
        { label: 'qL*a', coefficient: 'qL(x)', polynomial: 'a(x)' },
        { label: 'qR*b', coefficient: 'qR(x)', polynomial: 'b(x)' },
        { label: 'qO*c', coefficient: 'qO(x)', polynomial: 'c(x)' },
        { label: 'qM*a*b', coefficient: 'qM(x)', polynomial: 'a(x)*b(x)' },
        { label: 'qC', coefficient: '1', polynomial: 'qC(x)' },
      ],
      totalDegree: fullDegree,
    },
  ];

  const linearizedSteps: LinearizationStep[] = [
    {
      stepName: 'Linearized polynomial',
      description:
        `r(x) = a(zeta)*qL(x) + b(zeta)*qR(x) + c(zeta)*qO(x) + a(zeta)*b(zeta)*qM(x) + qC(x), check r(zeta) = t(zeta)*Z_H(zeta) where zeta = ${challengePoint}`,
      terms: [
        { label: 'a(zeta)*qL', coefficient: String(aEval), polynomial: 'qL(x)' },
        { label: 'b(zeta)*qR', coefficient: String(bEval), polynomial: 'qR(x)' },
        { label: 'c(zeta)*qO', coefficient: String(cEval), polynomial: 'qO(x)' },
        { label: 'a(zeta)b(zeta)*qM', coefficient: String(mod(aEval * bEval, p)), polynomial: 'qM(x)' },
        { label: 'qC', coefficient: '1', polynomial: 'qC(x)' },
      ],
      totalDegree: linearizedDegree,
    },
  ];

  return {
    challengePoint,
    wireEvals: { a: aEval, b: bEval, c: cEval },
    fullSteps,
    linearizedSteps,
    fullCheckValue,
    linearizedCheckValue,
    consistent: fullCheckValue === linearizedCheckValue,
  };
}
