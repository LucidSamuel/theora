import { sha256 } from '@/lib/hash';
import { encodeStatePlain } from '@/lib/urlState';
import type { DemoId } from '@/types';
import type { KzgState } from '@/types/polynomial';
import { STAGES, STAGE_LABELS, type FaultType, type PipelineResults, type PipelineStage } from './logic';

export interface LinkedDemoDescriptor {
  demo: DemoId;
  label: string;
  description: string;
  exact: boolean;
}

export interface LinkedDemoTarget extends LinkedDemoDescriptor {
  hash: string;
}

export interface StageDiagnostic {
  stage: PipelineStage;
  severity: 'neutral' | 'success' | 'warning' | 'error';
  summary: string;
}

export interface PipelineShareState {
  scenarioName?: string;
  x: number;
  stage: PipelineStage;
  fault: FaultType;
}

export function buildPipelineHash(state: PipelineShareState): string {
  return `pipeline|${encodeStatePlain(state)}`;
}

export function getLinkedDemoDescriptor(stage: PipelineStage): LinkedDemoDescriptor | null {
  switch (stage) {
    case 'witness':
    case 'constraints':
      return {
        demo: 'circuit',
        label: 'R1CS Circuit',
        description: 'Open the exact witness and constraint state in the circuit demo.',
        exact: true,
      };
    case 'polynomial':
    case 'commit':
    case 'open':
    case 'verify':
      return {
        demo: 'polynomial',
        label: 'Polynomial Commitments',
        description: 'Open the exact encoded polynomial and current KZG stage.',
        exact: true,
      };
    case 'challenge':
      return {
        demo: 'fiat-shamir',
        label: 'Fiat-Shamir',
        description: 'Open the exact imported transcript and challenge state for this stage.',
        exact: true,
      };
    default:
      return null;
  }
}

export function getStageDiagnostic(stage: PipelineStage, results: PipelineResults, fault: FaultType): StageDiagnostic {
  switch (stage) {
    case 'witness':
      return {
        stage,
        severity: results.witness ? 'success' : 'neutral',
        summary: results.witness ? `x = ${results.witness.x}, y = ${results.witness.y}` : 'Witness not computed yet',
      };
    case 'constraints':
      if (!results.constraints) {
        return { stage, severity: 'neutral', summary: 'Constraint system not evaluated yet' };
      }
      return results.constraints.allSatisfied
        ? { stage, severity: 'success', summary: 'All R1CS constraints hold' }
        : { stage, severity: 'error', summary: 'Witness violates the constraint system' };
    case 'polynomial': {
      if (!results.polynomial || !results.witness) {
        return { stage, severity: 'neutral', summary: 'Polynomial encoding not built yet' };
      }
      const matches = polynomialMatchesWitness(results);
      return matches
        ? { stage, severity: 'success', summary: 'Polynomial interpolates the witness wires' }
        : { stage, severity: 'error', summary: 'Encoded polynomial no longer matches the witness values' };
    }
    case 'commit':
      if (!results.commit) {
        return { stage, severity: 'neutral', summary: 'Commitment not produced yet' };
      }
      return { stage, severity: 'success', summary: `Commitment fixed as ${results.commit.commitment.slice(0, 10)}…` };
    case 'challenge':
      if (!results.challenge) {
        return { stage, severity: 'neutral', summary: 'Challenge not derived yet' };
      }
      if (fault === 'weak-fiat-shamir') {
        return { stage, severity: 'warning', summary: `Challenge z = ${results.challenge.challenge} is predictable` };
      }
      return { stage, severity: 'success', summary: `Challenge z = ${results.challenge.challenge} derived from transcript` };
    case 'open': {
      if (!results.open) {
        return { stage, severity: 'neutral', summary: 'Opening proof not computed yet' };
      }
      const integrity = getOpeningIntegrity(results);
      if (!integrity) {
        return { stage, severity: 'neutral', summary: 'Opening integrity unavailable' };
      }
      return integrity.evaluationValid && integrity.quotientValid
        ? { stage, severity: 'success', summary: `Opened at z = ${results.open.z} with consistent quotient` }
        : { stage, severity: 'error', summary: 'Opening proof does not reconstruct the committed polynomial' };
    }
    case 'verify':
      if (!results.verify) {
        return { stage, severity: 'neutral', summary: 'Verification not run yet' };
      }
      return results.verify.passed
        ? { stage, severity: 'success', summary: results.verify.detail }
        : { stage, severity: 'error', summary: results.verify.detail };
  }
}

export function getPrimaryPipelineIssue(results: PipelineResults, fault: FaultType): StageDiagnostic | null {
  for (const stage of STAGES) {
    const diagnostic = getStageDiagnostic(stage, results, fault);
    if (diagnostic.severity === 'error' || diagnostic.severity === 'warning') {
      return diagnostic;
    }
  }
  return null;
}

export async function buildLinkedDemoTarget(
  stage: PipelineStage,
  results: PipelineResults,
  fault: FaultType,
  pipelineState: PipelineShareState
): Promise<LinkedDemoTarget | null> {
  const descriptor = getLinkedDemoDescriptor(stage);
  if (!descriptor) return null;
  const pipelineHash = buildPipelineHash(pipelineState);

  switch (descriptor.demo) {
    case 'circuit':
      if (!results.witness) return null;
      return {
        ...descriptor,
        hash: `circuit|${encodeStatePlain({
          x: results.witness.x,
          y: results.witness.x + 5,
          z: results.witness.y,
          t: results.witness.v1,
          broken: false,
          pipelineHash,
        })}`,
      };
    case 'polynomial':
      if (!results.polynomial) return null;
      return {
        ...descriptor,
        hash: `polynomial|${encodeStatePlain({
          mode: 'coefficients',
          coefficients: results.polynomial.coefficients,
          compareEnabled: false,
          compareCoefficients: [],
          kzg: await buildPolynomialKzgState(stage, results),
          pipelineHash,
        })}`,
      };
    case 'fiat-shamir':
      if (!results.witness || !results.challenge || !results.commit) return null;
      return {
        ...descriptor,
        hash: `fiat-shamir|${encodeStatePlain({
          mode: fault === 'weak-fiat-shamir' ? 'fs-broken' : 'fs-correct',
          trace: {
            source: 'pipeline',
            commitment: results.commit.commitment,
            publicOutput: results.witness.y,
            transcriptInputs: results.challenge.transcriptInputs,
            challenge: results.challenge.challenge,
            detail: fault === 'weak-fiat-shamir'
              ? 'The pipeline used a predictable challenge instead of hashing the full transcript.'
              : 'The pipeline hashed the commitment and public output to derive this verifier challenge.',
            predictable: fault === 'weak-fiat-shamir',
          },
          pipelineHash,
        })}`,
      };
    default:
      return null;
  }
}

function polynomialMatchesWitness(results: PipelineResults): boolean {
  if (!results.polynomial || !results.witness) return false;
  return results.polynomial.points.every((point) => {
    const value = evaluatePolynomial(results.polynomial!.coefficients, point.x);
    return Math.abs(value - point.y) < 1e-6;
  });
}

function getOpeningIntegrity(results: PipelineResults): { evaluationValid: boolean; quotientValid: boolean } | null {
  if (!results.polynomial || !results.open || !results.witness) return null;

  const evaluationValid = Math.abs(evaluatePolynomial(results.polynomial.coefficients, results.open.z) - results.open.pz) < 1e-6;

  let quotientValid = true;
  for (let i = 0; i < results.witness.wires.length; i++) {
    const qValue = evaluatePolynomial(results.open.quotientCoeffs, i);
    const reconstructed = qValue * (i - results.open.z) + results.open.pz;
    const original = evaluatePolynomial(results.polynomial.coefficients, i);
    if (Math.abs(reconstructed - original) > 1e-6) {
      quotientValid = false;
      break;
    }
  }

  return { evaluationValid, quotientValid };
}

async function buildPolynomialKzgState(stage: PipelineStage, results: PipelineResults): Promise<KzgState | null> {
  if (!results.polynomial) return null;

  const base: KzgState = {
    commitment: null,
    challengeZ: null,
    revealedValue: null,
    quotientPoly: null,
    proofHash: null,
    verified: null,
    currentStep: 0,
  };

  if (STAGES.indexOf(stage) < STAGES.indexOf('commit') || !results.commit) {
    return base;
  }

  base.commitment = results.commit.commitment;
  base.currentStep = 1;

  if (STAGES.indexOf(stage) < STAGES.indexOf('challenge') || !results.challenge) {
    return base;
  }

  base.challengeZ = results.challenge.challenge;
  base.currentStep = 2;

  if (STAGES.indexOf(stage) < STAGES.indexOf('open') || !results.open) {
    return base;
  }

  base.revealedValue = results.open.pz;
  base.quotientPoly = results.open.quotientCoeffs;
  base.proofHash = await sha256(JSON.stringify(results.open.quotientCoeffs));
  base.currentStep = 3;

  if (STAGES.indexOf(stage) >= STAGES.indexOf('verify') && results.verify) {
    base.verified = results.verify.passed;
    base.currentStep = 4;
  }

  return base;
}

function evaluatePolynomial(coefficients: number[], x: number): number {
  let acc = 0;
  let power = 1;
  for (const coefficient of coefficients) {
    acc += coefficient * power;
    power *= x;
  }
  return acc;
}

export function getIssueLabel(issue: StageDiagnostic): string {
  return `${STAGE_LABELS[issue.stage]}: ${issue.summary}`;
}
