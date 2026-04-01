import { createContext, useContext, useReducer, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PredictState, PredictAction, PredictChallenge, PredictDifficulty, AiPrediction } from './types';
import { getRandomChallenge, hasPredictChallenges } from './challenges';
import { useAccuracy } from './useAccuracy';
import { ApiKeyStore } from './ai/apiKeyStore';
import { generateAiChallenge, AiClientError } from './ai/client';
import { validateAiPrediction } from './ai/validator';
import { useMode } from '@/modes/ModeProvider';
import type { DemoId } from '@/types';

const initialState: PredictState = {
  challenge: null,
  phase: 'prompt',
  selectedIndex: null,
  correct: null,
};

function predictReducer(state: PredictState, action: PredictAction): PredictState {
  switch (action.type) {
    case 'START_CHALLENGE':
      return {
        challenge: action.challenge,
        phase: 'prompt',
        selectedIndex: null,
        correct: null,
      };
    case 'SELECT_CHOICE':
      if (state.phase !== 'prompt') return state;
      return { ...state, selectedIndex: action.index };
    case 'LOCK_IN':
      if (state.phase !== 'prompt' || state.selectedIndex === null || !state.challenge) return state;
      return { ...state, phase: 'locked' };
    case 'REVEAL':
      if (state.phase !== 'locked' || state.selectedIndex === null || !state.challenge) return state;
      return {
        ...state,
        phase: 'revealed',
        correct: state.selectedIndex === state.challenge.correctIndex,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface PredictContextValue {
  state: PredictState;
  selectChoice: (index: number) => void;
  lockIn: () => void;
  reveal: () => void;
  nextChallenge: () => void;
  reset: () => void;
  difficulty: PredictDifficulty;
  setDifficulty: (d: PredictDifficulty) => void;
  /** AI mode: generate a challenge from the Anthropic API. */
  generateAi: (demoState: Record<string, unknown>) => Promise<void>;
  aiLoading: boolean;
  aiError: string | null;
  aiEnabled: boolean;
  accuracyPct: number | null;
  accuracyTotal: number;
}

const PredictContext = createContext<PredictContextValue>({
  state: initialState,
  selectChoice: () => {},
  lockIn: () => {},
  reveal: () => {},
  nextChallenge: () => {},
  reset: () => {},
  difficulty: 'beginner',
  setDifficulty: () => {},
  generateAi: async () => {},
  aiLoading: false,
  aiError: null,
  aiEnabled: false,
  accuracyPct: null,
  accuracyTotal: 0,
});

export function PredictProvider({ activeDemo, children }: { activeDemo: DemoId; children: ReactNode }) {
  const { mode } = useMode();
  const [state, dispatch] = useReducer(predictReducer, initialState);
  const [difficulty, setDifficulty] = useState<PredictDifficulty>('beginner');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const { record, recordAnswer, accuracyPct } = useAccuracy(activeDemo);
  const previousDemoRef = useRef(activeDemo);
  const previousDifficultyRef = useRef(difficulty);

  const aiEnabled = ApiKeyStore.has();

  const loadProceduralChallenge = useCallback((
    demoId: DemoId,
    challengeDifficulty: PredictDifficulty,
    excludeIds: string[] = [],
  ) => {
    const challenge = getRandomChallenge(demoId, challengeDifficulty, excludeIds);
    if (challenge) {
      dispatch({ type: 'START_CHALLENGE', challenge });
      return;
    }

    if (excludeIds.length > 0) {
      setSeenIds([]);
      const fresh = getRandomChallenge(demoId, challengeDifficulty);
      if (fresh) {
        dispatch({ type: 'START_CHALLENGE', challenge: fresh });
        return;
      }
    }

    dispatch({ type: 'RESET' });
  }, []);

  // Load or refresh the active challenge when the demo or difficulty changes.
  useEffect(() => {
    if (mode !== 'predict') {
      if (state.challenge) dispatch({ type: 'RESET' });
      return;
    }

    const demoChanged = previousDemoRef.current !== activeDemo;
    const difficultyChanged = previousDifficultyRef.current !== difficulty;
    previousDemoRef.current = activeDemo;
    previousDifficultyRef.current = difficulty;

    if (!hasPredictChallenges(activeDemo)) {
      if (state.challenge) dispatch({ type: 'RESET' });
      return;
    }

    if (demoChanged) {
      setSeenIds([]);
      setAiError(null);
      dispatch({ type: 'RESET' });
      loadProceduralChallenge(activeDemo, difficulty, []);
      return;
    }

    if (!state.challenge) {
      loadProceduralChallenge(activeDemo, difficulty, seenIds);
      return;
    }

    if (difficultyChanged) {
      setAiError(null);
      loadProceduralChallenge(activeDemo, difficulty, seenIds);
    }
  }, [mode, activeDemo, difficulty, state.challenge, seenIds, loadProceduralChallenge]);

  // Record accuracy when revealed
  useEffect(() => {
    if (
      state.phase === 'revealed' &&
      state.correct !== null &&
      state.challenge &&
      state.challenge.demoId === activeDemo
    ) {
      recordAnswer(state.correct, state.challenge.category, state.challenge.difficulty);
      setSeenIds((prev) => [...prev, state.challenge!.id]);
    }
  }, [activeDemo, state.phase, state.correct, state.challenge, recordAnswer]);

  const selectChoice = useCallback((index: number) => dispatch({ type: 'SELECT_CHOICE', index }), []);
  const lockIn = useCallback(() => dispatch({ type: 'LOCK_IN' }), []);
  const reveal = useCallback(() => dispatch({ type: 'REVEAL' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const nextChallenge = useCallback(() => {
    loadProceduralChallenge(activeDemo, difficulty, seenIds);
  }, [activeDemo, difficulty, seenIds, loadProceduralChallenge]);

  const generateAi = useCallback(async (demoState: Record<string, unknown>) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const prediction: AiPrediction = await generateAiChallenge({
        demoId: activeDemo,
        demoState,
        accuracy: record,
        difficulty,
      });

      // Validate against logic.ts
      const validationError = validateAiPrediction(prediction, activeDemo);
      if (validationError) {
        setAiError(`AI generated an invalid challenge: ${validationError}. Using procedural challenge instead.`);
        nextChallenge();
        return;
      }

      const aiChallenge: PredictChallenge = {
        id: `ai-${Date.now()}`,
        demoId: activeDemo,
        difficulty,
        question: prediction.question,
        hint: prediction.targetMisconception ?? 'Think carefully about the cryptographic properties.',
        choices: prediction.choices,
        correctIndex: prediction.correctIndex,
        explanation: prediction.explanation,
        category: prediction.targetMisconception ?? 'ai-generated',
      };
      dispatch({ type: 'START_CHALLENGE', challenge: aiChallenge });
    } catch (err) {
      if (err instanceof AiClientError) {
        setAiError(err.message);
      } else {
        setAiError('Unexpected error generating AI challenge.');
      }
      // Fall back to procedural
      nextChallenge();
    } finally {
      setAiLoading(false);
    }
  }, [activeDemo, difficulty, record, nextChallenge]);

  return (
    <PredictContext.Provider
      value={{
        state,
        selectChoice,
        lockIn,
        reveal,
        nextChallenge,
        reset,
        difficulty,
        setDifficulty,
        generateAi,
        aiLoading,
        aiError,
        aiEnabled,
        accuracyPct,
        accuracyTotal: record.total,
      }}
    >
      {children}
    </PredictContext.Provider>
  );
}

export function usePredict(): PredictContextValue {
  return useContext(PredictContext);
}
