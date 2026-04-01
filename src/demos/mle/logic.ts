/**
 * Multilinear Extension (MLE) — pure logic.
 *
 * A multilinear extension uniquely extends a function f: {0,1}^n -> F_p
 * to a multilinear polynomial f~: F_p^n -> F_p.  The extension is defined
 * via the eq (equality) Lagrange basis:
 *
 *   f~(r) = sum_{v in {0,1}^n} f(v) * eq(r, v)
 *
 * where eq(r, v) = prod_i (v_i * r_i + (1 - v_i) * (1 - r_i)).
 *
 * This module provides pure functions for creating MLEs, evaluating them
 * at arbitrary field points, partial evaluation (fixing variables one at
 * a time, as in sumcheck), and basic arithmetic operations.
 *
 * All arithmetic is BigInt mod fieldSize.
 */

/* ── helpers ─────────────────────────────────────────────── */

/** Reduce a mod p into [0, p). */
function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/* ── types ───────────────────────────────────────────────── */

export interface HypercubePoint {
  bits: number[];   // e.g. [0, 1, 1] for point (0,1,1)
  value: bigint;    // f(0,1,1) = some value
}

export interface MLEFunction {
  numVars: number;
  fieldSize: bigint;
  evaluations: HypercubePoint[]; // 2^numVars entries
}

export interface EqBasisTerm {
  vertex: number[];   // boolean hypercube vertex
  weight: bigint;     // eq(r, vertex) value
}

export interface PartialEvalResult {
  fixedVars: bigint[];           // variables already fixed
  remainingVars: number;         // numVars - fixedVars.length
  evaluations: HypercubePoint[]; // 2^remainingVars entries
}

export interface MLEEvaluation {
  point: bigint[];           // evaluation point r = (r1, ..., rn)
  value: bigint;             // f~(r1, ..., rn)
  basisTerms: EqBasisTerm[]; // eq(r, v) for each vertex v
  // f~(r) = sum_v f(v) * eq(r, v)
}

/* ── internal helpers ────────────────────────────────────── */

/**
 * Convert an integer index to a bit array of length numVars.
 * Index 0 -> [0,0,...,0], index 1 -> [0,0,...,1], etc. (big-endian).
 */
function indexToBits(index: number, numVars: number): number[] {
  const bits: number[] = [];
  for (let i = numVars - 1; i >= 0; i--) {
    bits.push((index >> i) & 1);
  }
  return bits;
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Create an MLE from hypercube evaluations.
 *
 * If `values` is not provided, uses small deterministic values based on
 * the point index: f(v) = (index + 1) mod fieldSize.
 * Must have exactly 2^numVars values when provided.
 */
export function createMLE(
  numVars: number,
  fieldSize: bigint,
  values?: bigint[],
): MLEFunction {
  const size = 1 << numVars; // 2^numVars

  if (values !== undefined && values.length !== size) {
    throw new Error(
      `Expected ${size} values for ${numVars} variables, got ${values.length}`,
    );
  }

  const evaluations: HypercubePoint[] = [];

  for (let i = 0; i < size; i++) {
    const bits = indexToBits(i, numVars);
    const raw = values !== undefined ? values[i]! : BigInt(i + 1);
    evaluations.push({ bits, value: mod(raw, fieldSize) });
  }

  return { numVars, fieldSize, evaluations };
}

/**
 * Compute the eq (equality) Lagrange basis at evaluation point `point`.
 *
 * For each vertex v in {0,1}^n:
 *   eq(r, v) = prod_i (v_i * r_i + (1 - v_i) * (1 - r_i))
 *
 * Returns one EqBasisTerm per hypercube vertex.
 */
export function computeEqBasis(point: bigint[], fieldSize: bigint): EqBasisTerm[] {
  const n = point.length;
  const size = 1 << n;
  const terms: EqBasisTerm[] = [];

  for (let idx = 0; idx < size; idx++) {
    const vertex = indexToBits(idx, n);
    let weight = 1n;

    for (let i = 0; i < n; i++) {
      const vi = BigInt(vertex[i]!);
      const ri = mod(point[i]!, fieldSize);
      // vi * ri + (1 - vi) * (1 - ri)
      const term = mod(
        mod(vi * ri, fieldSize) + mod(mod(1n - vi, fieldSize) * mod(1n - ri, fieldSize), fieldSize),
        fieldSize,
      );
      weight = mod(weight * term, fieldSize);
    }

    terms.push({ vertex, weight });
  }

  return terms;
}

/**
 * Evaluate the MLE at an arbitrary field point using the eq basis.
 *
 *   f~(r) = sum_{v in {0,1}^n} f(v) * eq(r, v)
 *
 * Returns the full MLEEvaluation including each basis term contribution
 * so the UI can visualize individual weights.
 */
export function evaluateMLE(mle: MLEFunction, point: bigint[]): MLEEvaluation {
  if (point.length !== mle.numVars) {
    throw new Error(
      `Point dimension ${point.length} != MLE variables ${mle.numVars}`,
    );
  }

  const p = mle.fieldSize;
  const basisTerms = computeEqBasis(point, p);

  let value = 0n;
  for (let i = 0; i < mle.evaluations.length; i++) {
    value = mod(value + mod(mle.evaluations[i]!.value * basisTerms[i]!.weight, p), p);
  }

  return { point, value, basisTerms };
}

/**
 * Partially evaluate an MLE by fixing the first k variables.
 *
 * For each remaining hypercube point (b_{k+1}, ..., b_n), compute:
 *   g(b_{k+1},...,b_n) = sum_{v1,...,vk in {0,1}^k}
 *       f(v1,...,vk, b_{k+1},...,b_n) * prod_i (v_i * r_i + (1-v_i)*(1-r_i))
 *
 * This is what happens during each round of sumcheck when a challenge
 * is applied: one variable at a time gets fixed.
 */
export function partialEvaluate(
  mle: MLEFunction,
  fixedVars: bigint[],
): PartialEvalResult {
  const k = fixedVars.length;
  const n = mle.numVars;
  const p = mle.fieldSize;

  if (k > n) {
    throw new Error(
      `Cannot fix ${k} variables in an MLE with ${n} variables`,
    );
  }

  const remainingVars = n - k;
  const remainingSize = 1 << remainingVars;
  const fixedSize = 1 << k;

  const evaluations: HypercubePoint[] = [];

  for (let rIdx = 0; rIdx < remainingSize; rIdx++) {
    const remainingBits = indexToBits(rIdx, remainingVars);
    let sum = 0n;

    // Sum over all {0,1}^k assignments for the fixed variables
    for (let fIdx = 0; fIdx < fixedSize; fIdx++) {
      const fixedBits = indexToBits(fIdx, k);

      // Compute eq weight for the fixed portion only
      let eqWeight = 1n;
      for (let i = 0; i < k; i++) {
        const vi = BigInt(fixedBits[i]!);
        const ri = mod(fixedVars[i]!, p);
        const term = mod(
          mod(vi * ri, p) + mod(mod(1n - vi, p) * mod(1n - ri, p), p),
          p,
        );
        eqWeight = mod(eqWeight * term, p);
      }

      // Look up f(fixedBits ++ remainingBits) in the original MLE
      const fullBits = [...fixedBits, ...remainingBits];
      const fullIndex = fullBits.reduce((acc, b) => acc * 2 + b, 0);
      const fVal = mle.evaluations[fullIndex]!.value;

      sum = mod(sum + mod(fVal * eqWeight, p), p);
    }

    evaluations.push({ bits: remainingBits, value: sum });
  }

  return { fixedVars, remainingVars, evaluations };
}

/**
 * Sum all evaluations of the MLE over the boolean hypercube {0,1}^n.
 *
 *   H = sum_{v in {0,1}^n} f(v) mod fieldSize
 */
export function sumOverHypercube(mle: MLEFunction): bigint {
  let sum = 0n;
  for (const pt of mle.evaluations) {
    sum = mod(sum + pt.value, mle.fieldSize);
  }
  return sum;
}

/**
 * Create an MLE from a function fn: (bits: number[]) => bigint.
 *
 * Evaluates fn at every point in {0,1}^numVars and stores the results.
 * Useful for creating MLEs with specific polynomial shapes (e.g. AND, OR).
 */
export function mleFromFunction(
  numVars: number,
  fieldSize: bigint,
  fn: (bits: number[]) => bigint,
): MLEFunction {
  const size = 1 << numVars;
  const evaluations: HypercubePoint[] = [];

  for (let i = 0; i < size; i++) {
    const bits = indexToBits(i, numVars);
    evaluations.push({ bits, value: mod(fn(bits), fieldSize) });
  }

  return { numVars, fieldSize, evaluations };
}

/**
 * Pointwise addition of two MLEs with the same numVars and fieldSize.
 *
 *   (a + b)(v) = a(v) + b(v) mod fieldSize
 */
export function addMLE(a: MLEFunction, b: MLEFunction): MLEFunction {
  if (a.numVars !== b.numVars) {
    throw new Error(
      `Cannot add MLEs with different numVars: ${a.numVars} vs ${b.numVars}`,
    );
  }
  if (a.fieldSize !== b.fieldSize) {
    throw new Error(
      `Cannot add MLEs with different fieldSize: ${a.fieldSize} vs ${b.fieldSize}`,
    );
  }

  const p = a.fieldSize;
  const evaluations: HypercubePoint[] = a.evaluations.map((pt, i) => ({
    bits: [...pt.bits],
    value: mod(pt.value + b.evaluations[i]!.value, p),
  }));

  return { numVars: a.numVars, fieldSize: p, evaluations };
}

/**
 * Multiply all evaluations by a scalar.
 *
 *   (s * f)(v) = s * f(v) mod fieldSize
 */
export function scaleMLE(mle: MLEFunction, scalar: bigint): MLEFunction {
  const p = mle.fieldSize;
  const s = mod(scalar, p);
  const evaluations: HypercubePoint[] = mle.evaluations.map((pt) => ({
    bits: [...pt.bits],
    value: mod(pt.value * s, p),
  }));

  return { numVars: mle.numVars, fieldSize: p, evaluations };
}

/**
 * Pointwise multiplication of two MLEs.
 *
 *   (a * b)(v) = a(v) * b(v) mod fieldSize
 *
 * Note: the resulting MLE extension has higher degree than multilinear,
 * but the hypercube values are correct. This stores only the hypercube
 * evaluations of the product.
 */
export function multiplyMLE(a: MLEFunction, b: MLEFunction): MLEFunction {
  if (a.numVars !== b.numVars) {
    throw new Error(
      `Cannot multiply MLEs with different numVars: ${a.numVars} vs ${b.numVars}`,
    );
  }
  if (a.fieldSize !== b.fieldSize) {
    throw new Error(
      `Cannot multiply MLEs with different fieldSize: ${a.fieldSize} vs ${b.fieldSize}`,
    );
  }

  const p = a.fieldSize;
  const evaluations: HypercubePoint[] = a.evaluations.map((pt, i) => ({
    bits: [...pt.bits],
    value: mod(pt.value * b.evaluations[i]!.value, p),
  }));

  return { numVars: a.numVars, fieldSize: p, evaluations };
}
