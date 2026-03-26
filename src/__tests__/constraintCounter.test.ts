import { describe, expect, it } from 'vitest';
import {
  buildConstraintScenario,
  formatConstraintCount,
  getConstraintProfiles,
  getFullTreeConstraintCost,
  getPathConstraintCost,
  getSavingsRatio,
} from '@/demos/constraint-counter/logic';

describe('constraint counter logic', () => {
  it('builds a bounded Merkle-depth scenario', () => {
    const scenario = buildConstraintScenario(40);

    expect(scenario.depth).toBe(32);
    expect(scenario.pathHashes).toBe(32n);
    expect(scenario.internalHashes).toBe((2n ** 32n) - 1n);
  });

  it('shows Poseidon cheaper than Pedersen on both path and full-tree costs', () => {
    const [pedersen, poseidon] = getConstraintProfiles();
    const scenario = buildConstraintScenario(16);
    const pedersenPath = getPathConstraintCost(pedersen!, scenario.depth, 'r1cs');
    const poseidonPath = getPathConstraintCost(poseidon!, scenario.depth, 'r1cs');
    const pedersenTree = getFullTreeConstraintCost(pedersen!, scenario.internalHashes, 'bootle16');
    const poseidonTree = getFullTreeConstraintCost(poseidon!, scenario.internalHashes, 'bootle16');

    expect(pedersenPath).toBeGreaterThan(poseidonPath);
    expect(pedersenTree).toBeGreaterThan(poseidonTree);
    expect(getSavingsRatio(pedersenPath, poseidonPath)).toBeGreaterThan(1);
  });

  it('formats large counts compactly for UI display', () => {
    expect(formatConstraintCount(999n)).toBe('999');
    expect(formatConstraintCount(12_500n)).toBe('12.5k');
    expect(formatConstraintCount(3_600_000_000n)).toBe('3.6b');
  });
});
