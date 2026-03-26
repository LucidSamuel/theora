import { fnv1a } from '@/lib/hash';

// ── Types ──────────────────────────────────────────────────────────

export interface Claim {
  commitment: string;
  point: number;
  value: number;
}

export interface NaiveStep {
  index: number;
  claim: Claim;
  /** How many recursive verifier layers are embedded at this step */
  embeddedVerifierCount: number;
  /** Effective MSM gate cost represented inside this recursive circuit */
  msmCost: number;
  /** Circuit gates consumed by the verifier at this recursive step */
  circuitCost: number;
  /** Cumulative verifier circuit cost through this step */
  cumulativeCost: number;
  status: 'pending' | 'computing' | 'verified';
}

export interface AccumulatorState {
  combinedCommitment: string;
  combinedPoint: number;
  foldedCount: number;
  /** MSM cost that would be required if we settled now */
  deferredMsmCost: number;
}

export interface AccumulatedStep {
  index: number;
  claim: Claim;
  /** Random challenge used for folding */
  challenge: string;
  /** Cheap field operations cost at this step */
  fieldOpsCost: number;
  /** Running accumulator after this fold */
  accumulator: AccumulatorState;
  /** Cumulative cost (field ops only, deferred MSM excluded) */
  cumulativeCost: number;
  status: 'pending' | 'folding' | 'folded';
}

export interface Settlement {
  msmSize: number;
  msmCost: number;
  foldedCount: number;
  verified: boolean;
}

// ── Claim generation ───────────────────────────────────────────────

/**
 * Generate deterministic claims from step indices.
 * Each claim simulates a polynomial commitment that needs to be verified.
 */
export function generateClaims(numSteps: number): Claim[] {
  const claims: Claim[] = [];
  for (let i = 0; i < numSteps; i++) {
    const seed = `claim_${i}_v2`;
    const commitment = fnv1a(seed);
    const point = 4 + (parseInt(fnv1a(`pt_${i}`), 16) % 97);
    const value = parseInt(fnv1a(`val_${i}`), 16) % 1000;
    claims.push({ commitment, point, value });
  }
  return claims;
}

// ── Naive recursion ────────────────────────────────────────────────

/**
 * In naive recursion, every recursive step embeds a full MSM in its verifier
 * circuit. The circuit at step i must contain the MSM from step i-1 plus its
 * own MSM, so the verifier circuit size grows linearly per step.
 *
 * More precisely: the inner verifier at step i must perform an MSM of size
 * `msmBaseCost`. Because the verifier circuit *itself* is proven at step i+1,
 * step i+1's circuit must be large enough to represent that MSM. This means
 * each step's verifier circuit cost is O(msmBaseCost), and the total work
 * across n steps is O(n * msmBaseCost).
 *
 * The key problem: the *circuit size* at each step includes the full MSM,
 * which dominates and makes the per-step cost enormous.
 */
export function buildNaiveSteps(claims: Claim[], msmBaseCost: number): NaiveStep[] {
  const steps: NaiveStep[] = [];
  let cumulative = 0;

  for (let i = 0; i < claims.length; i++) {
    const embeddedVerifierCount = i + 1;
    const msmCost = embeddedVerifierCount * msmBaseCost;
    // Every extra recursive layer drags another MSM-heavy verifier into the circuit.
    const circuitCost = msmCost + embeddedVerifierCount * 12;
    cumulative += circuitCost;

    steps.push({
      index: i,
      claim: claims[i]!,
      embeddedVerifierCount,
      msmCost,
      circuitCost,
      cumulativeCost: cumulative,
      status: 'pending',
    });
  }

  return steps;
}

// ── Accumulated (Halo-style) ───────────────────────────────────────

const FIELD_OPS_PER_FOLD = 10;

/**
 * In split accumulation, each recursive step does NOT perform the MSM.
 * Instead, it samples a random challenge r and computes a random linear
 * combination of the running accumulator with the new claim. This costs
 * only ~10 field multiplications — independent of the commitment size.
 *
 * The MSM is deferred into a running accumulator. At the very end,
 * a single MSM of size `msmBaseCost` settles everything.
 */
export function buildAccumulatedSteps(claims: Claim[], msmBaseCost: number): AccumulatedStep[] {
  const steps: AccumulatedStep[] = [];
  let accumulator: AccumulatorState | null = null;
  let cumulative = 0;

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]!;
    const challenge = fnv1a(`fold_challenge_${i}_${claim.commitment}`);

    if (!accumulator) {
      accumulator = {
        combinedCommitment: claim.commitment,
        combinedPoint: claim.point,
        foldedCount: 1,
        deferredMsmCost: msmBaseCost,
      };
    } else {
      // Fold: acc' = acc + r * claim (random linear combination)
      accumulator = {
        combinedCommitment: fnv1a(`${accumulator.combinedCommitment}_${challenge}_${claim.commitment}`),
        combinedPoint: Math.round((accumulator.combinedPoint + claim.point * (parseInt(challenge, 16) % 100 + 1) / 100)),
        foldedCount: accumulator.foldedCount + 1,
        deferredMsmCost: msmBaseCost,
      };
    }

    cumulative += FIELD_OPS_PER_FOLD;

    steps.push({
      index: i,
      claim,
      challenge,
      fieldOpsCost: FIELD_OPS_PER_FOLD,
      accumulator: { ...accumulator },
      cumulativeCost: cumulative,
      status: 'pending',
    });
  }

  return steps;
}

/**
 * Settle the accumulator with a single final MSM.
 */
export function settleAccumulator(msmBaseCost: number, foldedCount: number): Settlement {
  return {
    msmSize: msmBaseCost,
    msmCost: msmBaseCost,
    foldedCount,
    verified: true,
  };
}

// ── Cost summaries ─────────────────────────────────────────────────

export function getNaiveTotalCost(steps: NaiveStep[], currentStep: number): number {
  let total = 0;
  for (let i = 0; i <= Math.min(currentStep, steps.length - 1); i++) {
    total += steps[i]!.circuitCost;
  }
  return total;
}

export function getAccumulatedTotalCost(
  steps: AccumulatedStep[],
  currentStep: number,
  settlement: Settlement | null
): number {
  let total = 0;
  for (let i = 0; i <= Math.min(currentStep, steps.length - 1); i++) {
    total += steps[i]!.fieldOpsCost;
  }
  if (settlement) {
    total += settlement.msmCost;
  }
  return total;
}

export function getSavingsRatio(naiveCost: number, accumulatedCost: number): number {
  if (accumulatedCost === 0) return 0;
  return naiveCost / accumulatedCost;
}
