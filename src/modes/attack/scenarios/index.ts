import type { DemoId } from '@/types';
import type { AttackScenario } from './types';
import { FROZEN_HEART } from './fiat-shamir';
import { UNDERCONSTRAINED_CIRCUIT } from './circuit';
import { BREAK_THE_PIPELINE } from './pipeline';
import { MERKLE_FORGERY } from './merkle';
import { POLYNOMIAL_SUBSTITUTION } from './polynomial';

export const ALL_SCENARIOS: AttackScenario[] = [
  FROZEN_HEART,
  UNDERCONSTRAINED_CIRCUIT,
  BREAK_THE_PIPELINE,
  MERKLE_FORGERY,
  POLYNOMIAL_SUBSTITUTION,
];

const BY_DEMO = new Map<DemoId, AttackScenario>();
for (const s of ALL_SCENARIOS) BY_DEMO.set(s.demoId, s);

const BY_ID = new Map<string, AttackScenario>();
for (const s of ALL_SCENARIOS) BY_ID.set(s.id, s);

export function getScenarioForDemo(demoId: DemoId): AttackScenario | null {
  return BY_DEMO.get(demoId) ?? null;
}

export function getScenarioById(id: string): AttackScenario | null {
  return BY_ID.get(id) ?? null;
}

export function hasAttackScenario(demoId: DemoId): boolean {
  return BY_DEMO.has(demoId);
}

export const ATTACK_DEMO_IDS: DemoId[] = ALL_SCENARIOS.map((s) => s.demoId);
