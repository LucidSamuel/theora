import { describe, expect, it } from 'vitest';
import {
  buildAccumulatedSteps,
  buildNaiveSteps,
  generateClaims,
  getAccumulatedTotalCost,
  getNaiveTotalCost,
  getSavingsRatio,
  settleAccumulator,
} from '@/demos/split-accumulation/logic';

describe('split accumulation logic', () => {
  it('generates deterministic claims for the requested step count', () => {
    const claims = generateClaims(3);

    expect(claims).toHaveLength(3);
    expect(claims[0]).toEqual(generateClaims(3)[0]);
    expect(claims[0]?.commitment).not.toBe(claims[1]?.commitment);
  });

  it('makes naive recursive verifier cost grow with each embedded layer', () => {
    const claims = generateClaims(4);
    const steps = buildNaiveSteps(claims, 200);

    expect(steps[0]?.embeddedVerifierCount).toBe(1);
    expect(steps[1]?.embeddedVerifierCount).toBe(2);
    expect(steps[2]?.embeddedVerifierCount).toBe(3);
    expect(steps[2]!.circuitCost).toBeGreaterThan(steps[1]!.circuitCost);
    expect(steps[3]!.cumulativeCost).toBeGreaterThan(steps[3]!.circuitCost);
  });

  it('keeps each accumulated fold cheap while growing the accumulator state', () => {
    const claims = generateClaims(4);
    const steps = buildAccumulatedSteps(claims, 200);

    expect(steps[0]?.fieldOpsCost).toBe(10);
    expect(steps[1]?.fieldOpsCost).toBe(10);
    expect(steps[3]?.accumulator.foldedCount).toBe(4);
    expect(steps[3]?.accumulator.deferredMsmCost).toBe(200);
  });

  it('settles all folded claims with one final MSM', () => {
    const settlement = settleAccumulator(240, 6);

    expect(settlement.msmSize).toBe(240);
    expect(settlement.msmCost).toBe(240);
    expect(settlement.foldedCount).toBe(6);
    expect(settlement.verified).toBe(true);
  });

  it('shows accumulation cheaper than naive recursion after several steps', () => {
    const claims = generateClaims(5);
    const naiveSteps = buildNaiveSteps(claims, 200);
    const accumulatedSteps = buildAccumulatedSteps(claims, 200);
    const settlement = settleAccumulator(200, 5);

    const naiveCost = getNaiveTotalCost(naiveSteps, 4);
    const accumulatedCost = getAccumulatedTotalCost(accumulatedSteps, 4, settlement);

    expect(naiveCost).toBeGreaterThan(accumulatedCost);
    expect(getSavingsRatio(naiveCost, accumulatedCost)).toBeGreaterThan(1);
  });
});
