import { fnv1a } from '@/lib/hash';
import { polynomialEvaluate, lagrangeInterpolation } from '@/lib/math';

// ── Types ──────────────────────────────────────────────────────────

export type PipelineStage =
  | 'witness'
  | 'constraints'
  | 'polynomial'
  | 'commit'
  | 'challenge'
  | 'open'
  | 'verify';

export const STAGES: PipelineStage[] = [
  'witness',
  'constraints',
  'polynomial',
  'commit',
  'challenge',
  'open',
  'verify',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  witness: 'Witness',
  constraints: 'Constraints',
  polynomial: 'Polynomial',
  commit: 'Commit',
  challenge: 'Challenge',
  open: 'Open',
  verify: 'Verify',
};

export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  witness: 'Assign secret input and compute all intermediate wire values',
  constraints: 'Express the computation as R1CS constraints: (A·w) ⊙ (B·w) = C·w',
  polynomial: 'Encode the wire assignment as a polynomial via Lagrange interpolation',
  commit: 'Hash the polynomial coefficients to produce a binding commitment',
  challenge: 'Fiat-Shamir: hash the commitment to derive a verifier challenge z',
  open: 'Evaluate p(z) and compute the quotient q(x) = (p(x) − p(z)) / (x − z)',
  verify: 'Reconstruct and check that the commitment, evaluation, and quotient are consistent',
};

export type FaultType =
  | 'none'
  | 'bad-witness'
  | 'bad-polynomial'
  | 'weak-fiat-shamir'
  | 'bad-opening';

export const FAULT_LABELS: Record<FaultType, string> = {
  none: 'None (honest proof)',
  'bad-witness': 'Bad witness (wrong x²)',
  'bad-polynomial': 'Corrupted polynomial',
  'weak-fiat-shamir': 'Weak Fiat-Shamir (fixed challenge)',
  'bad-opening': 'Bad opening (wrong quotient)',
};

export interface WitnessData {
  x: number;
  v1: number;    // x²
  y: number;     // x² + x + 5
  wires: number[]; // [1, x, y, v1]
}

export interface ConstraintRow {
  a: number[];
  b: number[];
  c: number[];
  lhs: number; // (A·w)(B·w)
  rhs: number; // C·w
  satisfied: boolean;
}

export interface ConstraintData {
  rows: ConstraintRow[];
  allSatisfied: boolean;
}

export interface PolynomialData {
  coefficients: number[];
  points: { x: number; y: number }[]; // interpolation points
}

export interface CommitData {
  commitment: string;
}

export interface ChallengeData {
  transcriptInputs: string[];
  challenge: number;
}

export interface OpenData {
  z: number;
  pz: number;
  quotientCoeffs: number[];
}

export interface VerifyData {
  commitmentValid: boolean;
  evaluationValid: boolean;
  quotientValid: boolean;
  passed: boolean;
  detail: string;
}

export interface PipelineResults {
  witness: WitnessData | null;
  constraints: ConstraintData | null;
  polynomial: PolynomialData | null;
  commit: CommitData | null;
  challenge: ChallengeData | null;
  open: OpenData | null;
  verify: VerifyData | null;
}

// ── Stage computations ─────────────────────────────────────────────

/**
 * The computation to prove: f(x) = x² + x + 5
 */
export function computeWitness(x: number, fault: FaultType): WitnessData {
  const v1 = fault === 'bad-witness' ? x * x + 1 : x * x; // inject fault: v1 ≠ x²
  const y = v1 + x + 5;
  return { x, v1, y, wires: [1, x, y, v1] };
}

/**
 * R1CS constraints for f(x) = x² + x + 5
 *
 * Wire vector w = [1, x, y, v₁]
 *
 * Constraint 1: x · x = v₁
 *   A₁ = [0, 1, 0, 0]  →  A₁·w = x
 *   B₁ = [0, 1, 0, 0]  →  B₁·w = x
 *   C₁ = [0, 0, 0, 1]  →  C₁·w = v₁
 *
 * Constraint 2: (v₁ + x + 5) · 1 = y
 *   A₂ = [5, 1, 0, 1]  →  A₂·w = 5 + x + v₁
 *   B₂ = [1, 0, 0, 0]  →  B₂·w = 1
 *   C₂ = [0, 0, 1, 0]  →  C₂·w = y
 */
export function checkConstraints(witness: WitnessData): ConstraintData {
  const w = witness.wires;

  const row1: ConstraintRow = {
    a: [0, 1, 0, 0],
    b: [0, 1, 0, 0],
    c: [0, 0, 0, 1],
    lhs: dot([0, 1, 0, 0], w) * dot([0, 1, 0, 0], w), // x * x
    rhs: dot([0, 0, 0, 1], w), // v1
    satisfied: false,
  };
  row1.satisfied = Math.abs(row1.lhs - row1.rhs) < 1e-9;

  const row2: ConstraintRow = {
    a: [5, 1, 0, 1],
    b: [1, 0, 0, 0],
    c: [0, 0, 1, 0],
    lhs: dot([5, 1, 0, 1], w) * dot([1, 0, 0, 0], w), // (5+x+v1) * 1
    rhs: dot([0, 0, 1, 0], w), // y
    satisfied: false,
  };
  row2.satisfied = Math.abs(row2.lhs - row2.rhs) < 1e-9;

  const rows = [row1, row2];
  return { rows, allSatisfied: rows.every((r) => r.satisfied) };
}

/**
 * Encode the witness wire values as a polynomial using Lagrange interpolation.
 * p(0) = 1, p(1) = x, p(2) = y, p(3) = v₁
 */
export function buildPolynomial(witness: WitnessData, fault: FaultType): PolynomialData {
  const points = witness.wires.map((val, i) => ({ x: i, y: val }));
  let coefficients = lagrangeInterpolation(points);

  if (fault === 'bad-polynomial') {
    // Corrupt the leading coefficient
    coefficients = coefficients.map((c, i) => (i === coefficients.length - 1 ? c + 0.5 : c));
  }

  return { coefficients, points };
}

/**
 * Commit to the polynomial by hashing its coefficients.
 */
export function commitPolynomial(poly: PolynomialData): CommitData {
  const data = poly.coefficients.map((c) => c.toFixed(10)).join(',');
  return { commitment: fnv1a(data) };
}

/**
 * Derive a Fiat-Shamir challenge from the commitment and public input.
 */
export function deriveChallenge(
  commit: CommitData,
  publicOutput: number,
  fault: FaultType
): ChallengeData {
  if (fault === 'weak-fiat-shamir') {
    // Fixed challenge — attacker can predict it
    return {
      transcriptInputs: ['(fixed)'],
      challenge: 7,
    };
  }

  const transcriptInputs = [commit.commitment, String(publicOutput)];
  const transcript = transcriptInputs.join('|');
  const hash = fnv1a(transcript);
  // Map hash to a challenge in range [4, 20] (avoid interpolation domain 0-3)
  const raw = parseInt(hash, 16);
  const challenge = 4 + (raw % 17);

  return { transcriptInputs, challenge };
}

/**
 * Open the polynomial at the challenge point.
 * Computes p(z) and the quotient q(x) = (p(x) - p(z)) / (x - z).
 */
export function openPolynomial(
  poly: PolynomialData,
  z: number,
  fault: FaultType
): OpenData {
  const pz = polynomialEvaluate(poly.coefficients, z);

  // Synthetic division: divide (p(x) - pz) by (x - z)
  const shifted = [...poly.coefficients];
  shifted[0] = (shifted[0] ?? 0) - pz;

  const n = shifted.length;
  const quotient = new Array<number>(n - 1);
  let carry = shifted[n - 1] ?? 0;
  quotient[n - 2] = carry;
  for (let i = n - 2; i >= 1; i--) {
    carry = (shifted[i] ?? 0) + z * carry;
    quotient[i - 1] = carry;
  }

  if (fault === 'bad-opening') {
    // Corrupt the quotient
    quotient[0] = (quotient[0] ?? 0) + 1;
  }

  return { z, pz, quotientCoeffs: quotient };
}

/**
 * Verify the proof: reconstruct p(x) from quotient and check commitment.
 *
 * Verification equation: p(x) = q(x)·(x − z) + p(z)
 * We check this at the interpolation domain points and verify the commitment.
 */
export function verifyProof(
  witness: WitnessData,
  poly: PolynomialData,
  commit: CommitData,
  open: OpenData,
  constraints: ConstraintData
): VerifyData {
  // 1. Check constraints
  if (!constraints.allSatisfied) {
    return {
      commitmentValid: false,
      evaluationValid: false,
      quotientValid: false,
      passed: false,
      detail: `Constraint check failed: witness does not satisfy R1CS`,
    };
  }

  // 2. Recompute commitment from polynomial
  const recomputedCommit = commitPolynomial(poly);
  const commitmentValid = recomputedCommit.commitment === commit.commitment;

  // 3. Check evaluation: p(z) should match
  const recomputedPz = polynomialEvaluate(poly.coefficients, open.z);
  const evaluationValid = Math.abs(recomputedPz - open.pz) < 1e-6;

  // 4. Check quotient: q(z)·(z − z) + pz should equal p(z) (trivially true)
  //    More meaningfully: q(x)·(x − z) + pz should reconstruct p(x) at domain points
  let quotientValid = true;
  for (let i = 0; i < witness.wires.length; i++) {
    const qVal = polynomialEvaluate(open.quotientCoeffs, i);
    const reconstructed = qVal * (i - open.z) + open.pz;
    const original = polynomialEvaluate(poly.coefficients, i);
    if (Math.abs(reconstructed - original) > 1e-6) {
      quotientValid = false;
      break;
    }
  }

  const passed = commitmentValid && evaluationValid && quotientValid;

  let detail: string;
  if (passed) {
    detail = 'All checks passed: commitment binds, evaluation correct, quotient consistent';
  } else {
    const failures: string[] = [];
    if (!commitmentValid) failures.push('commitment mismatch');
    if (!evaluationValid) failures.push('evaluation p(z) incorrect');
    if (!quotientValid) failures.push('quotient reconstruction failed');
    detail = `Verification failed: ${failures.join(', ')}`;
  }

  return { commitmentValid, evaluationValid, quotientValid, passed, detail };
}

/**
 * Run the full pipeline up to a given stage.
 */
export function runPipeline(
  x: number,
  upToStage: PipelineStage,
  fault: FaultType
): PipelineResults {
  const result: PipelineResults = {
    witness: null,
    constraints: null,
    polynomial: null,
    commit: null,
    challenge: null,
    open: null,
    verify: null,
  };

  const stageIdx = STAGES.indexOf(upToStage);

  // Stage 0: Witness
  if (stageIdx < 0) return result;
  const witness = computeWitness(x, fault);
  result.witness = witness;

  // Stage 1: Constraints
  if (stageIdx < 1) return result;
  const constraints = checkConstraints(witness);
  result.constraints = constraints;

  // Stage 2: Polynomial
  if (stageIdx < 2) return result;
  const poly = buildPolynomial(witness, fault);
  result.polynomial = poly;

  // Stage 3: Commit
  if (stageIdx < 3) return result;
  const commit = commitPolynomial(poly);
  result.commit = commit;

  // Stage 4: Challenge
  if (stageIdx < 4) return result;
  const challenge = deriveChallenge(commit, witness.y, fault);
  result.challenge = challenge;

  // Stage 5: Open
  if (stageIdx < 5) return result;
  const open = openPolynomial(poly, challenge.challenge, fault);
  result.open = open;

  // Stage 6: Verify
  if (stageIdx < 6) return result;
  result.verify = verifyProof(witness, poly, commit, open, constraints);

  return result;
}

// ── Helpers ────────────────────────────────────────────────────────

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}
