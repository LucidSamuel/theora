import type { DemoId } from '@/types';

export type AttackDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type AttackPhase = 'briefing' | 'setup' | 'attempt' | 'result';

export interface AttackStep {
  id: string;
  instruction: string;
  observation: string;
  adversaryNarration: string;
  /** If present, the AttackProvider will programmatically trigger this demo action. */
  demoAction?: {
    type: string;
    payload?: unknown;
  };
  /** If present, the user is expected to interact with a specific control. */
  userAction?: {
    description: string;
  };
}

export interface AttackScenario {
  id: string;
  demoId: DemoId;
  title: string;
  difficulty: AttackDifficulty;
  briefing: {
    goal: string;
    adversarySees: string[];
    adversaryControls: string[];
    adversaryCannotDo: string[];
  };
  steps: AttackStep[];
  conclusion: {
    succeeded: boolean;
    explanation: string;
    securityGuarantee: string;
    realWorldExample?: string;
    furtherReading?: string;
  };
}

export interface AttackAttempt {
  stepId: string;
  timestamp: number;
  result: 'success' | 'failure' | 'skipped';
}

export interface AttackState {
  scenario: AttackScenario | null;
  phase: AttackPhase;
  currentStep: number;
  attempts: AttackAttempt[];
  succeeded: boolean | null;
}

export type AttackAction =
  | { type: 'START_SCENARIO'; scenario: AttackScenario }
  | { type: 'ADVANCE_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'SUBMIT_ATTEMPT'; attempt: AttackAttempt }
  | { type: 'SHOW_RESULT' }
  | { type: 'RESET' };
