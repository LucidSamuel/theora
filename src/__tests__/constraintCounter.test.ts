import { describe, expect, it } from 'vitest';
import {
  buildConstraintScenario,
  formatConstraintCount,
  getConstraintProfiles,
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

  it('returns three profiles: SHA-256, Pedersen, Poseidon', () => {
    const profiles = getConstraintProfiles();
    expect(profiles).toHaveLength(3);
    expect(profiles[0]!.name).toBe('SHA-256');
    expect(profiles[1]!.name).toBe('Pedersen');
    expect(profiles[2]!.name).toBe('Poseidon');
  });

  it('shows SHA-256 > Pedersen > Poseidon on both path and full-tree costs', () => {
    const [sha256, pedersen, poseidon] = getConstraintProfiles();
    const scenario = buildConstraintScenario(16);
    const sha256Path = getPathConstraintCost(sha256!, scenario.depth, 'r1cs');
    const pedersenPath = getPathConstraintCost(pedersen!, scenario.depth, 'r1cs');
    const poseidonPath = getPathConstraintCost(poseidon!, scenario.depth, 'r1cs');

    expect(sha256Path).toBeGreaterThan(pedersenPath);
    expect(pedersenPath).toBeGreaterThan(poseidonPath);
    expect(getSavingsRatio(sha256Path, poseidonPath)).toBeGreaterThan(300);
  });

  it('formats large counts compactly for UI display', () => {
    expect(formatConstraintCount(999n)).toBe('999');
    expect(formatConstraintCount(12_500n)).toBe('12.5k');
    expect(formatConstraintCount(3_600_000_000n)).toBe('3.6B');
    expect(formatConstraintCount(5_200_000_000_000n)).toBe('5.2T');
  });
});
