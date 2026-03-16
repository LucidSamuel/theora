import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fnv1a } from "../lib/hash.js";
import { polynomialEvaluate, lagrangeInterpolation } from "../lib/math.js";
import type { PipelineStage, FaultType, WitnessData, ConstraintRow, ConstraintData, PolynomialData, CommitData, ChallengeData, OpenData, VerifyData, PipelineResults } from "../lib/types.js";

const STAGES: PipelineStage[] = ['witness', 'constraints', 'polynomial', 'commit', 'challenge', 'open', 'verify'];

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

function computeWitness(x: number, fault: FaultType): WitnessData {
  const v1 = fault === 'bad-witness' ? x * x + 1 : x * x;
  const y = v1 + x + 5;
  return { x, v1, y, wires: [1, x, y, v1] };
}

function checkConstraints(witness: WitnessData): ConstraintData {
  const w = witness.wires;
  const row1: ConstraintRow = { a: [0, 1, 0, 0], b: [0, 1, 0, 0], c: [0, 0, 0, 1], lhs: dot([0, 1, 0, 0], w) * dot([0, 1, 0, 0], w), rhs: dot([0, 0, 0, 1], w), satisfied: false };
  row1.satisfied = Math.abs(row1.lhs - row1.rhs) < 1e-9;
  const row2: ConstraintRow = { a: [5, 1, 0, 1], b: [1, 0, 0, 0], c: [0, 0, 1, 0], lhs: dot([5, 1, 0, 1], w) * dot([1, 0, 0, 0], w), rhs: dot([0, 0, 1, 0], w), satisfied: false };
  row2.satisfied = Math.abs(row2.lhs - row2.rhs) < 1e-9;
  return { rows: [row1, row2], allSatisfied: row1.satisfied && row2.satisfied };
}

function buildPolynomial(witness: WitnessData, fault: FaultType): PolynomialData {
  const points = witness.wires.map((val, i) => ({ x: i, y: val }));
  let coefficients = lagrangeInterpolation(points);
  if (fault === 'bad-polynomial') coefficients = coefficients.map((c, i) => i === coefficients.length - 1 ? c + 0.5 : c);
  return { coefficients, points };
}

function commitPolynomial(poly: PolynomialData): CommitData {
  return { commitment: fnv1a(poly.coefficients.map(c => c.toFixed(10)).join(',')) };
}

function deriveChallenge(commit: CommitData, publicOutput: number, fault: FaultType): ChallengeData {
  if (fault === 'weak-fiat-shamir') return { transcriptInputs: ['(fixed)'], challenge: 7 };
  const transcriptInputs = [commit.commitment, String(publicOutput)];
  const hash = fnv1a(transcriptInputs.join('|'));
  return { transcriptInputs, challenge: 4 + (parseInt(hash, 16) % 17) };
}

function openPolynomial(poly: PolynomialData, zVal: number, fault: FaultType): OpenData {
  const pz = polynomialEvaluate(poly.coefficients, zVal);
  const shifted = [...poly.coefficients];
  shifted[0] = (shifted[0] ?? 0) - pz;
  const n = shifted.length;
  const quotient = new Array<number>(n - 1);
  let carry = shifted[n - 1] ?? 0;
  quotient[n - 2] = carry;
  for (let i = n - 2; i >= 1; i--) { carry = (shifted[i] ?? 0) + zVal * carry; quotient[i - 1] = carry; }
  if (fault === 'bad-opening') quotient[0] = (quotient[0] ?? 0) + 1;
  return { z: zVal, pz, quotientCoeffs: quotient };
}

function pipelineVerifyProof(witness: WitnessData, poly: PolynomialData, commit: CommitData, open: OpenData, constraints: ConstraintData): VerifyData {
  if (!constraints.allSatisfied) return { commitmentValid: false, evaluationValid: false, quotientValid: false, passed: false, detail: 'Constraint check failed' };
  const commitmentValid = commitPolynomial(poly).commitment === commit.commitment;
  const evaluationValid = Math.abs(polynomialEvaluate(poly.coefficients, open.z) - open.pz) < 1e-6;
  let quotientValid = true;
  for (let i = 0; i < witness.wires.length; i++) {
    const reconstructed = polynomialEvaluate(open.quotientCoeffs, i) * (i - open.z) + open.pz;
    if (Math.abs(reconstructed - polynomialEvaluate(poly.coefficients, i)) > 1e-6) { quotientValid = false; break; }
  }
  const passed = commitmentValid && evaluationValid && quotientValid;
  const detail = passed ? 'All checks passed' : [!commitmentValid && 'commitment mismatch', !evaluationValid && 'evaluation incorrect', !quotientValid && 'quotient failed'].filter(Boolean).join(', ');
  return { commitmentValid, evaluationValid, quotientValid, passed, detail };
}

function runPipeline(x: number, upToStage: PipelineStage, fault: FaultType): PipelineResults {
  const result: PipelineResults = { witness: null, constraints: null, polynomial: null, commit: null, challenge: null, open: null, verify: null };
  const stageIdx = STAGES.indexOf(upToStage);
  if (stageIdx < 0) return result;
  const witness = computeWitness(x, fault); result.witness = witness;
  if (stageIdx < 1) return result;
  const constraints = checkConstraints(witness); result.constraints = constraints;
  if (stageIdx < 2) return result;
  const poly = buildPolynomial(witness, fault); result.polynomial = poly;
  if (stageIdx < 3) return result;
  const commit = commitPolynomial(poly); result.commit = commit;
  if (stageIdx < 4) return result;
  const challenge = deriveChallenge(commit, witness.y, fault); result.challenge = challenge;
  if (stageIdx < 5) return result;
  const open = openPolynomial(poly, challenge.challenge, fault); result.open = open;
  if (stageIdx < 6) return result;
  result.verify = pipelineVerifyProof(witness, poly, commit, open, constraints);
  return result;
}

export function registerPipelineTools(server: McpServer) {
  server.tool(
    "pipeline_run",
    "Run the full proof pipeline (f(x) = x² + x + 5) with optional fault injection. Returns all 7 stages: witness → constraints → polynomial → commit → challenge → open → verify",
    {
      secretInput: z.number().int().describe("The secret input x"),
      fault: z.enum(["none", "bad-witness", "bad-polynomial", "weak-fiat-shamir", "bad-opening"]).default("none").describe("Fault to inject"),
      upToStage: z.enum(["witness", "constraints", "polynomial", "commit", "challenge", "open", "verify"]).default("verify").describe("Run pipeline up to this stage"),
    },
    async ({ secretInput, fault, upToStage }) => {
      const results = runPipeline(secretInput, upToStage, fault as FaultType);
      const stagesCompleted = STAGES.slice(0, STAGES.indexOf(upToStage) + 1);
      let firstDivergence: string | undefined;
      if (fault !== 'none') {
        if (fault === 'bad-witness' && results.constraints && !results.constraints.allSatisfied) firstDivergence = 'constraints';
        else if (fault === 'bad-polynomial' && results.verify && !results.verify.commitmentValid) firstDivergence = 'verify (commitment)';
        else if (fault === 'weak-fiat-shamir' && results.challenge) firstDivergence = 'challenge (fixed)';
        else if (fault === 'bad-opening' && results.verify && !results.verify.quotientValid) firstDivergence = 'verify (quotient)';
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            secretInput,
            computation: `f(${secretInput}) = ${secretInput}² + ${secretInput} + 5 = ${secretInput * secretInput + secretInput + 5}`,
            fault,
            stagesCompleted,
            firstDivergence,
            finalVerdict: results.verify?.passed ?? null,
            stages: results,
          }, null, 2),
        }],
      };
    }
  );
}
