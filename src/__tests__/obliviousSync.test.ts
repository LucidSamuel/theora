import { describe, expect, it } from 'vitest';
import { buildSyncScenario, getSyncRoundDetails } from '@/demos/oblivious-sync/logic';

describe('oblivious sync logic', () => {
  it('builds a clean scenario with no spent-note overlap by default', () => {
    const scenario = buildSyncScenario(3, 8, false);

    expect(scenario.walletQueries).toHaveLength(3);
    expect(scenario.serviceSpentSet).toHaveLength(8);
    expect(scenario.overlapCount).toBe(0);
    expect(scenario.verified).toBe(true);
  });

  it('injects a spent-note collision when requested', () => {
    const scenario = buildSyncScenario(4, 10, true);

    expect(scenario.overlapCount).toBeGreaterThan(0);
    expect(scenario.verified).toBe(false);
  });

  it('describes each round with party-specific knowledge', () => {
    const scenario = buildSyncScenario(2, 6, false);
    const round = getSyncRoundDetails(scenario, 2);

    expect(round.title).toContain('Service');
    expect(round.walletLearns.length).toBeGreaterThan(0);
    expect(round.serviceLearns.length).toBeGreaterThan(0);
    expect(round.visibleMessages.length).toBeGreaterThan(0);
  });
});
