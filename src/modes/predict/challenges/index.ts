import type { PredictChallenge, PredictDifficulty } from '../types';
import type { DemoId } from '@/types';
import { MERKLE_CHALLENGES } from './merkle';
import { CIRCUIT_CHALLENGES } from './circuit';
import { FIAT_SHAMIR_CHALLENGES } from './fiat-shamir';
import { POLYNOMIAL_CHALLENGES } from './polynomial';
import { PIPELINE_CHALLENGES } from './pipeline';
import { ELLIPTIC_CHALLENGES } from './elliptic';
import { ACCUMULATOR_CHALLENGES } from './accumulator';
import { LOOKUP_CHALLENGES } from './lookup';
import { RECURSIVE_CHALLENGES } from './recursive';
import { PLONK_CHALLENGES } from './plonk';
import { GROTH16_CHALLENGES } from './groth16';
import { SUMCHECK_CHALLENGES } from './sumcheck';
import { FRI_CHALLENGES } from './fri';

export const ALL_CHALLENGES: PredictChallenge[] = [
  ...MERKLE_CHALLENGES,
  ...CIRCUIT_CHALLENGES,
  ...FIAT_SHAMIR_CHALLENGES,
  ...POLYNOMIAL_CHALLENGES,
  ...PIPELINE_CHALLENGES,
  ...ELLIPTIC_CHALLENGES,
  ...ACCUMULATOR_CHALLENGES,
  ...LOOKUP_CHALLENGES,
  ...RECURSIVE_CHALLENGES,
  ...PLONK_CHALLENGES,
  ...GROTH16_CHALLENGES,
  ...SUMCHECK_CHALLENGES,
  ...FRI_CHALLENGES,
];

const CHALLENGE_MAP = new Map<string, PredictChallenge>();
for (const c of ALL_CHALLENGES) {
  CHALLENGE_MAP.set(c.id, c);
}

/** Get all challenges for a specific demo. */
export function getChallengesForDemo(demoId: DemoId): PredictChallenge[] {
  return ALL_CHALLENGES.filter((c) => c.demoId === demoId);
}

/** Get challenges for a demo filtered by difficulty. */
export function getChallengesForDemoDifficulty(
  demoId: DemoId,
  difficulty: PredictDifficulty,
): PredictChallenge[] {
  return ALL_CHALLENGES.filter((c) => c.demoId === demoId && c.difficulty === difficulty);
}

/** Get a random challenge for a demo, optionally filtered by difficulty. */
export function getRandomChallenge(
  demoId: DemoId,
  difficulty?: PredictDifficulty,
  excludeIds?: string[],
): PredictChallenge | null {
  let pool = getChallengesForDemo(demoId);
  if (difficulty) {
    pool = pool.filter((c) => c.difficulty === difficulty);
  }
  if (excludeIds && excludeIds.length > 0) {
    const excluded = new Set(excludeIds);
    pool = pool.filter((c) => !excluded.has(c.id));
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Look up a challenge by ID. */
export function getChallengeById(id: string): PredictChallenge | null {
  return CHALLENGE_MAP.get(id) ?? null;
}

/** Check whether a demo has prediction challenges. */
export function hasPredictChallenges(demoId: DemoId): boolean {
  return ALL_CHALLENGES.some((c) => c.demoId === demoId);
}

/** List all demo IDs that have challenges. */
export const PREDICT_DEMO_IDS: DemoId[] = [...new Set(ALL_CHALLENGES.map((c) => c.demoId))];
