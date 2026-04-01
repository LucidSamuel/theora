import { describe, it, expect } from 'vitest';
import type { AttackState, AttackAction } from '../modes/attack/scenarios/types';
import {
  getScenarioForDemo,
  getScenarioById,
  hasAttackScenario,
  ATTACK_DEMO_IDS,
  ALL_SCENARIOS,
} from '../modes/attack/scenarios';

// --- Reducer (inline since it's not exported) ---
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
      return { ...state, phase: 'result', succeeded: state.scenario.conclusion.succeeded };
    case 'RESET':
      return {
        scenario: null,
        phase: 'briefing',
        currentStep: 0,
        attempts: [],
        succeeded: null,
      };
    default:
      return state;
  }
}

const initialState: AttackState = {
  scenario: null,
  phase: 'briefing',
  currentStep: 0,
  attempts: [],
  succeeded: null,
};

// --- Tests ---

describe('Attack scenario registry', () => {
  it('has 5 scenarios', () => {
    expect(ALL_SCENARIOS).toHaveLength(5);
  });

  it('each scenario has a unique id', () => {
    const ids = ALL_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each scenario has at least 2 steps', () => {
    for (const s of ALL_SCENARIOS) {
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('maps scenarios to correct demo IDs', () => {
    expect(getScenarioForDemo('fiat-shamir')?.id).toBe('frozen-heart');
    expect(getScenarioForDemo('circuit')?.id).toBe('underconstrained-circuit');
    expect(getScenarioForDemo('pipeline')?.id).toBe('break-the-pipeline');
    expect(getScenarioForDemo('merkle')?.id).toBe('merkle-forgery');
    expect(getScenarioForDemo('polynomial')?.id).toBe('polynomial-substitution');
  });

  it('returns null for demos without attack scenarios', () => {
    expect(getScenarioForDemo('recursive')).toBeNull();
    expect(getScenarioForDemo('elliptic')).toBeNull();
    expect(getScenarioForDemo('pedersen')).toBeNull();
  });

  it('looks up scenario by id', () => {
    expect(getScenarioById('frozen-heart')?.demoId).toBe('fiat-shamir');
    expect(getScenarioById('nonexistent')).toBeNull();
  });

  it('hasAttackScenario returns correct booleans', () => {
    expect(hasAttackScenario('fiat-shamir')).toBe(true);
    expect(hasAttackScenario('circuit')).toBe(true);
    expect(hasAttackScenario('recursive')).toBe(false);
  });

  it('ATTACK_DEMO_IDS lists all attack-capable demos', () => {
    expect(ATTACK_DEMO_IDS).toContain('fiat-shamir');
    expect(ATTACK_DEMO_IDS).toContain('circuit');
    expect(ATTACK_DEMO_IDS).toContain('pipeline');
    expect(ATTACK_DEMO_IDS).toContain('merkle');
    expect(ATTACK_DEMO_IDS).toContain('polynomial');
    expect(ATTACK_DEMO_IDS).toHaveLength(5);
  });
});

describe('Attack scenario data integrity', () => {
  it('every step has required fields', () => {
    for (const s of ALL_SCENARIOS) {
      for (const step of s.steps) {
        expect(step.id).toBeTruthy();
        expect(step.instruction).toBeTruthy();
        expect(step.observation).toBeTruthy();
        expect(step.adversaryNarration).toBeTruthy();
      }
    }
  });

  it('every scenario has a conclusion', () => {
    for (const s of ALL_SCENARIOS) {
      expect(s.conclusion.explanation).toBeTruthy();
      expect(s.conclusion.securityGuarantee).toBeTruthy();
      expect(typeof s.conclusion.succeeded).toBe('boolean');
    }
  });

  it('briefing has all required lists', () => {
    for (const s of ALL_SCENARIOS) {
      expect(s.briefing.goal).toBeTruthy();
      expect(s.briefing.adversarySees.length).toBeGreaterThan(0);
      expect(s.briefing.adversaryControls.length).toBeGreaterThan(0);
      expect(s.briefing.adversaryCannotDo.length).toBeGreaterThan(0);
    }
  });

  it('Fiat-Shamir and Circuit attacks succeed; Merkle and Polynomial attacks fail', () => {
    expect(getScenarioById('frozen-heart')?.conclusion.succeeded).toBe(true);
    expect(getScenarioById('underconstrained-circuit')?.conclusion.succeeded).toBe(true);
    expect(getScenarioById('break-the-pipeline')?.conclusion.succeeded).toBe(true);
    expect(getScenarioById('merkle-forgery')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('polynomial-substitution')?.conclusion.succeeded).toBe(false);
  });
});

describe('AttackProvider reducer', () => {
  const scenario = getScenarioForDemo('fiat-shamir')!;

  it('START_SCENARIO initializes state', () => {
    const state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    expect(state.scenario?.id).toBe('frozen-heart');
    expect(state.phase).toBe('briefing');
    expect(state.currentStep).toBe(0);
    expect(state.attempts).toEqual([]);
    expect(state.succeeded).toBeNull();
  });

  it('ADVANCE_STEP moves through steps', () => {
    let state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    state = attackReducer(state, { type: 'ADVANCE_STEP' }); // step 0 -> 1
    expect(state.phase).toBe('attempt');
    expect(state.currentStep).toBe(1);

    state = attackReducer(state, { type: 'ADVANCE_STEP' }); // step 1 -> 2
    expect(state.currentStep).toBe(2);
  });

  it('ADVANCE_STEP past last step transitions to result', () => {
    let state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    // Advance through all steps
    for (let i = 0; i < scenario.steps.length; i++) {
      state = attackReducer(state, { type: 'ADVANCE_STEP' });
    }
    expect(state.phase).toBe('result');
    expect(state.succeeded).toBe(scenario.conclusion.succeeded);
  });

  it('GO_TO_STEP clamps to valid range', () => {
    let state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    state = attackReducer(state, { type: 'GO_TO_STEP', step: 99 });
    expect(state.currentStep).toBe(scenario.steps.length - 1);

    state = attackReducer(state, { type: 'GO_TO_STEP', step: -5 });
    expect(state.currentStep).toBe(0);
  });

  it('SUBMIT_ATTEMPT appends to attempts array', () => {
    let state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    const attempt = { stepId: 'test', timestamp: Date.now(), result: 'success' as const };
    state = attackReducer(state, { type: 'SUBMIT_ATTEMPT', attempt });
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toEqual(attempt);
  });

  it('SHOW_RESULT transitions to result phase', () => {
    let state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    state = attackReducer(state, { type: 'SHOW_RESULT' });
    expect(state.phase).toBe('result');
    expect(state.succeeded).toBe(true);
  });

  it('RESET clears all state', () => {
    let state = attackReducer(initialState, { type: 'START_SCENARIO', scenario });
    state = attackReducer(state, { type: 'ADVANCE_STEP' });
    state = attackReducer(state, { type: 'RESET' });
    expect(state.scenario).toBeNull();
    expect(state.phase).toBe('briefing');
    expect(state.currentStep).toBe(0);
  });

  it('ADVANCE_STEP is a no-op without scenario', () => {
    const state = attackReducer(initialState, { type: 'ADVANCE_STEP' });
    expect(state).toEqual(initialState);
  });
});

describe('Attack scenario demoActions', () => {
  it('Fiat-Shamir scenario has SET_MODE actions', () => {
    const scenario = getScenarioById('frozen-heart')!;
    const modeActions = scenario.steps
      .filter((s) => s.demoAction?.type === 'SET_MODE')
      .map((s) => s.demoAction!.payload);
    expect(modeActions).toContain('fs-correct');
    expect(modeActions).toContain('fs-broken');
  });

  it('Circuit scenario has SET_BROKEN and LOAD_EXPLOIT actions', () => {
    const scenario = getScenarioById('underconstrained-circuit')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('SET_BROKEN');
    expect(actionTypes).toContain('LOAD_EXPLOIT');
  });

  it('Pipeline scenario has SET_FAULT actions for all 4 fault types', () => {
    const scenario = getScenarioById('break-the-pipeline')!;
    const faults = scenario.steps
      .filter((s) => s.demoAction?.type === 'SET_FAULT')
      .map((s) => s.demoAction!.payload);
    expect(faults).toContain('none');
    expect(faults).toContain('bad-witness');
    expect(faults).toContain('bad-polynomial');
    expect(faults).toContain('weak-fiat-shamir');
    expect(faults).toContain('bad-opening');
  });

  it('Merkle scenario has BUILD_DEFAULT_TREE and GENERATE_PROOF', () => {
    const scenario = getScenarioById('merkle-forgery')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('BUILD_DEFAULT_TREE');
    expect(actionTypes).toContain('GENERATE_PROOF');
    expect(actionTypes).toContain('ATTEMPT_FORGERY');
  });

  it('Polynomial scenario has KZG flow actions', () => {
    const scenario = getScenarioById('polynomial-substitution')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('KZG_RESET');
    expect(actionTypes).toContain('TOGGLE_COMPARE');
    expect(actionTypes).toContain('KZG_RUN_COMMIT');
    expect(actionTypes).toContain('KZG_RUN_OPEN');
  });
});
