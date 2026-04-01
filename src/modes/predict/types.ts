import type { DemoId } from '@/types';

// --- Phase 3: Procedural Predict Types ---

export type PredictPhase = 'prompt' | 'locked' | 'revealed';

export type PredictDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** A single prediction challenge. */
export interface PredictChallenge {
  id: string;
  demoId: DemoId;
  difficulty: PredictDifficulty;
  /** The question shown to the user. */
  question: string;
  /** A hint shown before answering. */
  hint: string;
  /** The choices the user picks from. */
  choices: PredictChoice[];
  /** The index of the correct choice in the choices array. */
  correctIndex: number;
  /** Explanation shown after reveal. */
  explanation: string;
  /** Optional demo action to set up the demo state for this challenge. */
  demoAction?: { type: string; payload?: unknown };
  /** Category tag for grouping. */
  category: string;
}

export interface PredictChoice {
  label: string;
  /** Short rationale shown after reveal (why this choice is right or wrong). */
  rationale: string;
}

export interface PredictState {
  challenge: PredictChallenge | null;
  phase: PredictPhase;
  selectedIndex: number | null;
  /** Whether the user's answer was correct. Only set in 'revealed' phase. */
  correct: boolean | null;
}

export type PredictAction =
  | { type: 'START_CHALLENGE'; challenge: PredictChallenge }
  | { type: 'SELECT_CHOICE'; index: number }
  | { type: 'LOCK_IN' }
  | { type: 'REVEAL' }
  | { type: 'RESET' };

// --- Phase 3b: AI Adaptive Types ---

export type KeyStoragePreference = 'memory' | 'session' | 'local';

export interface AiPrediction {
  question: string;
  choices: PredictChoice[];
  correctIndex: number;
  explanation: string;
  /** The misconception this challenge targets, if any. */
  targetMisconception?: string;
  /** Confidence level of the AI in this challenge. */
  confidence?: number;
}

export interface AiChallengeRequest {
  demoId: DemoId;
  /** Current demo state snapshot for context. */
  demoState: Record<string, unknown>;
  /** User's accuracy history for this demo. */
  accuracy: AccuracyRecord;
  /** Optional: specific misconception to target. */
  targetMisconception?: string;
  difficulty: PredictDifficulty;
}

export interface AccuracyRecord {
  total: number;
  correct: number;
  /** Per-category breakdown. */
  byCategory: Record<string, { total: number; correct: number }>;
  /** Recent streak (positive = correct, negative = wrong). */
  streak: number;
}

export interface RateLimitState {
  remaining: number;
  resetAt: number;
  windowMs: number;
  maxPerWindow: number;
}
