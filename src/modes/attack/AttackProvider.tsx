import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type { AttackState, AttackAction, AttackScenario, AttackAttempt } from './scenarios/types';
import { getScenarioForDemo, getScenarioById } from './scenarios';
import { useMode } from '@/modes/ModeProvider';
import type { DemoId } from '@/types';
import { getSearchParam } from '@/lib/urlState';
import { trackAttackStarted, trackAttackResult } from '@/lib/analytics';

const initialState: AttackState = {
  scenario: null,
  phase: 'briefing',
  currentStep: 0,
  attempts: [],
  succeeded: null,
};

function attackReducer(state: AttackState, action: AttackAction): AttackState {
  switch (action.type) {
    case 'START_SCENARIO':
      return {
        scenario: action.scenario,
        phase: 'briefing',
        currentStep: 0,
        attempts: [],
        succeeded: null,
      };
    case 'ADVANCE_STEP': {
      if (!state.scenario) return state;
      const nextStep = state.currentStep + 1;
      if (nextStep >= state.scenario.steps.length) {
        trackAttackResult(state.scenario.demoId, state.scenario.id, state.scenario.conclusion.succeeded);
        return { ...state, phase: 'result', succeeded: state.scenario.conclusion.succeeded };
      }
      return { ...state, phase: 'attempt', currentStep: nextStep };
    }
    case 'GO_TO_STEP': {
      if (!state.scenario) return state;
      const step = Math.max(0, Math.min(action.step, state.scenario.steps.length - 1));
      return { ...state, phase: 'attempt', currentStep: step };
    }
    case 'SUBMIT_ATTEMPT':
      return { ...state, attempts: [...state.attempts, action.attempt] };
    case 'SHOW_RESULT':
      if (!state.scenario) return state;
      trackAttackResult(state.scenario.demoId, state.scenario.id, state.scenario.conclusion.succeeded);
      return { ...state, phase: 'result', succeeded: state.scenario.conclusion.succeeded };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface AttackContextValue {
  state: AttackState;
  startScenario: (scenario: AttackScenario) => void;
  advanceStep: () => void;
  goToStep: (step: number) => void;
  submitAttempt: (attempt: AttackAttempt) => void;
  showResult: () => void;
  reset: () => void;
  /** The demo action that should be executed for the current step. Consumed by the demo integration. */
  currentDemoAction: { type: string; payload?: unknown } | null;
}

const AttackContext = createContext<AttackContextValue>({
  state: initialState,
  startScenario: () => {},
  advanceStep: () => {},
  goToStep: () => {},
  submitAttempt: () => {},
  showResult: () => {},
  reset: () => {},
  currentDemoAction: null,
});

export function AttackProvider({ activeDemo, children }: { activeDemo: DemoId; children: ReactNode }) {
  const { mode } = useMode();
  const [state, dispatch] = useReducer(attackReducer, initialState);

  // Auto-load scenario when entering attack mode for a demo that has one
  useEffect(() => {
    if (mode !== 'attack') {
      if (state.scenario) dispatch({ type: 'RESET' });
      return;
    }

    // Check URL for a specific scenario
    const scenarioParam = getSearchParam('scenario');
    if (scenarioParam) {
      const fromUrl = getScenarioById(scenarioParam);
      if (fromUrl && fromUrl.demoId === activeDemo) {
        dispatch({ type: 'START_SCENARIO', scenario: fromUrl });
        // Restore step from URL
        const stepParam = getSearchParam('step');
        if (stepParam) {
          const step = parseInt(stepParam, 10);
          if (!isNaN(step) && step > 0) {
            dispatch({ type: 'GO_TO_STEP', step });
          }
        }
        return;
      }
    }

    const scenario = getScenarioForDemo(activeDemo);
    if (scenario && state.scenario?.id !== scenario.id) {
      dispatch({ type: 'START_SCENARIO', scenario });
    }
  }, [mode, activeDemo, state.scenario]);

  // Sync attack state to URL
  useEffect(() => {
    if (mode !== 'attack' || !state.scenario) return;
    const params = new URLSearchParams(window.location.search);
    params.set('scenario', state.scenario.id);
    if (state.currentStep > 0) {
      params.set('step', String(state.currentStep));
    } else {
      params.delete('step');
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [mode, state.scenario, state.currentStep]);

  const currentDemoAction = (
    state.scenario && state.phase === 'attempt' && state.currentStep < state.scenario.steps.length
      ? state.scenario.steps[state.currentStep]?.demoAction ?? null
      : state.scenario && state.phase === 'briefing' && state.scenario.steps[0]?.demoAction
        ? state.scenario.steps[0].demoAction
        : null
  );

  const startScenario = useCallback((s: AttackScenario) => {
    trackAttackStarted(s.demoId, s.id);
    dispatch({ type: 'START_SCENARIO', scenario: s });
  }, []);
  const advanceStep = useCallback(() => dispatch({ type: 'ADVANCE_STEP' }), []);
  const goToStep = useCallback((step: number) => dispatch({ type: 'GO_TO_STEP', step }), []);
  const submitAttempt = useCallback((a: AttackAttempt) => dispatch({ type: 'SUBMIT_ATTEMPT', attempt: a }), []);
  const showResult = useCallback(() => dispatch({ type: 'SHOW_RESULT' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return (
    <AttackContext.Provider
      value={{ state, startScenario, advanceStep, goToStep, submitAttempt, showResult, reset, currentDemoAction }}
    >
      {children}
    </AttackContext.Provider>
  );
}

export function useAttack(): AttackContextValue {
  return useContext(AttackContext);
}
