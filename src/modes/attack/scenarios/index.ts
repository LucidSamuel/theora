import type { DemoId } from '@/types';
import type { AttackScenario } from './types';
import { FROZEN_HEART } from './fiat-shamir';
import { UNDERCONSTRAINED_CIRCUIT } from './circuit';
import { BREAK_THE_PIPELINE } from './pipeline';
import { MERKLE_FORGERY } from './merkle';
import { POLYNOMIAL_SUBSTITUTION } from './polynomial';
import { ECDLP_TOY_FIELD } from './elliptic';
import { FORGE_MEMBERSHIP } from './accumulator';
import { LOOKUP_SMUGGLE } from './lookup';
import { RECURSIVE_FORGERY } from './recursive';
import { PLONK_PERMUTATION_BREAK } from './plonk';
import { GROTH16_CORRUPT_PROOF } from './groth16';
import { SUMCHECK_CHEAT } from './sumcheck';
import { FRI_DEGREE_FRAUD } from './fri';
import { MLE_FORGERY } from './mle';
import { NOVA_INVALID_WITNESS } from './nova';
import { GKR_FALSE_OUTPUT } from './gkr';
import { SPLIT_ACC_BAD_FOLD } from './split-accumulation';
import { OSYNC_DEANONYMIZE } from './oblivious-sync';
import { RERAND_LINKABILITY } from './rerandomization';

export const ALL_SCENARIOS: AttackScenario[] = [
  FROZEN_HEART,
  UNDERCONSTRAINED_CIRCUIT,
  BREAK_THE_PIPELINE,
  MERKLE_FORGERY,
  POLYNOMIAL_SUBSTITUTION,
  ECDLP_TOY_FIELD,
  FORGE_MEMBERSHIP,
  LOOKUP_SMUGGLE,
  RECURSIVE_FORGERY,
  PLONK_PERMUTATION_BREAK,
  GROTH16_CORRUPT_PROOF,
  SUMCHECK_CHEAT,
  FRI_DEGREE_FRAUD,
  MLE_FORGERY,
  NOVA_INVALID_WITNESS,
  GKR_FALSE_OUTPUT,
  SPLIT_ACC_BAD_FOLD,
  OSYNC_DEANONYMIZE,
  RERAND_LINKABILITY,
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

export const ATTACK_DEMO_IDS: DemoId[] = [...new Set(ALL_SCENARIOS.map((s) => s.demoId))];
