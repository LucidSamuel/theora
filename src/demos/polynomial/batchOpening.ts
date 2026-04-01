/**
 * Batch Polynomial Opening over GF(p).
 *
 * Given k polynomials f₁(x),...,fₖ(x) and an evaluation point z,
 * the verifier sends a random challenge γ. The prover forms a
 * combined polynomial h(x) = Σᵢ γⁱ · fᵢ(x) and opens h at z
 * using a standard KZG-style quotient argument.
 *
 * The verifier checks: h(z) = Σᵢ γⁱ · fᵢ(z).
 *
 * All arithmetic is over GF(fieldSize) using BigInt.
 */

/* ── helpers ─────────────────────────────────────────────── */

const mod = (a: bigint, p: bigint): bigint => ((a % p) + p) % p;

/* ── types ───────────────────────────────────────────────── */

export interface BatchOpeningInput {
  polynomials: bigint[][]; // k polynomials as coefficient arrays
  evalPoint: bigint; // z
  gamma: bigint; // random combination challenge
  fieldSize: bigint;
}

export interface BatchOpeningStep {
  stepName: string;
  description: string;
  values: Record<string, string>;
}

export interface BatchOpeningResult {
  individualEvals: bigint[]; // fᵢ(z) for each polynomial
  combinedPoly: bigint[]; // h(x) = Σ γⁱ·fᵢ(x)
  combinedEval: bigint; // h(z)
  combinedEvalCheck: bigint; // Σ γⁱ·fᵢ(z) — should equal combinedEval
  quotientPoly: bigint[]; // q(x) = (h(x) - h(z)) / (x - z)
  consistent: boolean; // does h(z) === Σ γⁱ·fᵢ(z)?
  steps: BatchOpeningStep[]; // step-by-step for visualization
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Evaluate polynomial at x in GF(p) using Horner's method.
 * coeffs[0] is the constant term.
 */
export function evaluatePolyMod(
  coeffs: bigint[],
  x: bigint,
  p: bigint,
): bigint {
  let result = 0n;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = mod(result * x + coeffs[i]!, p);
  }
  return result;
}

/**
 * Add two polynomials coefficient-wise in GF(p).
 * Result length = max(a.length, b.length).
 */
export function addPolyMod(
  a: bigint[],
  b: bigint[],
  p: bigint,
): bigint[] {
  const len = Math.max(a.length, b.length);
  const result: bigint[] = [];
  for (let i = 0; i < len; i++) {
    result.push(mod((a[i] ?? 0n) + (b[i] ?? 0n), p));
  }
  return result;
}

/**
 * Scale a polynomial by a scalar in GF(p).
 */
export function scalePolyMod(
  coeffs: bigint[],
  scalar: bigint,
  p: bigint,
): bigint[] {
  return coeffs.map((c) => mod(c * scalar, p));
}

/**
 * Synthetic division of poly(x) by (x - root) in GF(p).
 *
 * Given poly(x) = (x - root) · q(x) + poly(root),
 * returns q(x) as a coefficient array one degree shorter.
 *
 * Precondition: poly must evaluate to 0 at root (i.e. (x - root)
 * divides poly evenly). If there is a nonzero remainder this
 * function still returns the quotient, but the caller should
 * verify that poly(root) === 0 before trusting the result.
 */
export function divideByLinearMod(
  poly: bigint[],
  root: bigint,
  p: bigint,
): bigint[] {
  if (poly.length <= 1) return [];

  const n = poly.length;
  const quotient: bigint[] = new Array(n - 1);

  // Process from highest degree to lowest
  let carry = poly[n - 1]!;
  quotient[n - 2] = mod(carry, p);

  for (let i = n - 2; i >= 1; i--) {
    carry = mod(poly[i]! + root * carry, p);
    quotient[i - 1] = mod(carry, p);
  }

  return quotient;
}

/**
 * Batch open k polynomials at a single point z.
 *
 * 1. Evaluate each fᵢ(z)
 * 2. Form combined polynomial h(x) = Σᵢ γⁱ · fᵢ(x)
 * 3. Compute h(z) directly and via Σᵢ γⁱ · fᵢ(z) (must match)
 * 4. Compute quotient q(x) = (h(x) - h(z)) / (x - z)
 */
export function batchOpen(input: BatchOpeningInput): BatchOpeningResult {
  const { polynomials, evalPoint, gamma, fieldSize: p } = input;
  const steps: BatchOpeningStep[] = [];

  // ── Step 1: individual evaluations ──
  const individualEvals: bigint[] = polynomials.map((poly) =>
    evaluatePolyMod(poly, evalPoint, p),
  );

  steps.push({
    stepName: 'Evaluate polynomials',
    description: `Evaluate each fᵢ at z = ${evalPoint}`,
    values: Object.fromEntries(
      individualEvals.map((v, i) => [`f${i + 1}(z)`, v.toString()]),
    ),
  });

  // ── Step 2: combined polynomial h(x) = Σ γⁱ · fᵢ(x) ──
  let combinedPoly: bigint[] = [];
  let gammaPower = 1n; // γ⁰ = 1

  for (let i = 0; i < polynomials.length; i++) {
    const scaled = scalePolyMod(polynomials[i]!, gammaPower, p);
    combinedPoly = addPolyMod(combinedPoly, scaled, p);
    gammaPower = mod(gammaPower * gamma, p);
  }

  steps.push({
    stepName: 'Combine polynomials',
    description: `h(x) = Σᵢ γⁱ · fᵢ(x) with γ = ${gamma}`,
    values: {
      'h(x) coefficients': `[${combinedPoly.join(', ')}]`,
      degree: (combinedPoly.length - 1).toString(),
    },
  });

  // ── Step 3: verify consistency ──
  const combinedEval = evaluatePolyMod(combinedPoly, evalPoint, p);

  let combinedEvalCheck = 0n;
  gammaPower = 1n;
  for (let i = 0; i < individualEvals.length; i++) {
    combinedEvalCheck = mod(
      combinedEvalCheck + mod(gammaPower * individualEvals[i]!, p),
      p,
    );
    gammaPower = mod(gammaPower * gamma, p);
  }

  const consistent = combinedEval === combinedEvalCheck;

  steps.push({
    stepName: 'Consistency check',
    description: 'Verify h(z) = Σᵢ γⁱ · fᵢ(z)',
    values: {
      'h(z)': combinedEval.toString(),
      'Σ γⁱ·fᵢ(z)': combinedEvalCheck.toString(),
      consistent: consistent.toString(),
    },
  });

  // ── Step 4: quotient polynomial q(x) = (h(x) - h(z)) / (x - z) ──
  // Subtract h(z) from constant term to form h(x) - h(z)
  const shifted = [...combinedPoly];
  shifted[0] = mod((shifted[0] ?? 0n) - combinedEval, p);

  const quotientPoly = divideByLinearMod(shifted, evalPoint, p);

  steps.push({
    stepName: 'Quotient polynomial',
    description: 'q(x) = (h(x) − h(z)) / (x − z)',
    values: {
      'q(x) coefficients': `[${quotientPoly.join(', ')}]`,
      degree: (quotientPoly.length - 1).toString(),
    },
  });

  return {
    individualEvals,
    combinedPoly,
    combinedEval,
    combinedEvalCheck,
    quotientPoly,
    consistent,
    steps,
  };
}
