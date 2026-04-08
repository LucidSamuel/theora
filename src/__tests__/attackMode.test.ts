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
  it('has 21 scenarios', () => {
    expect(ALL_SCENARIOS).toHaveLength(21);
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
    expect(getScenarioForDemo('elliptic')?.id).toBe('ecdlp-toy-field');
    expect(getScenarioForDemo('accumulator')?.id).toBe('forge-membership');
    expect(getScenarioForDemo('lookup')?.id).toBe('lookup-smuggle');
    expect(getScenarioForDemo('recursive')?.id).toBe('recursive-forgery');
    expect(getScenarioForDemo('plonk')?.id).toBe('plonk-permutation-break');
    expect(getScenarioForDemo('groth16')?.id).toBe('groth16-corrupt-proof');
    expect(getScenarioForDemo('sumcheck')?.id).toBe('sumcheck-cheat');
    expect(getScenarioForDemo('fri')?.id).toBe('fri-degree-fraud');
    expect(getScenarioForDemo('mle')?.id).toBe('mle-forgery');
    expect(getScenarioForDemo('nova')?.id).toBe('nova-invalid-witness');
    expect(getScenarioForDemo('gkr')?.id).toBe('gkr-false-output');
    expect(getScenarioForDemo('split-accumulation')?.id).toBe('split-acc-bad-fold');
    expect(getScenarioForDemo('rerandomization')?.id).toBe('rerand-linkability');
    expect(getScenarioForDemo('oblivious-sync')?.id).toBe('osync-deanonymize');
    expect(getScenarioForDemo('constraint-counter')?.id).toBe('sha256-cost-claim');
    expect(getScenarioForDemo('pedersen')?.id).toBe('pedersen-recover-value');
  });

  it('returns scenarios for newly supported demos', () => {
    expect(getScenarioForDemo('pedersen')).not.toBeNull();
  });

  it('looks up scenario by id', () => {
    expect(getScenarioById('frozen-heart')?.demoId).toBe('fiat-shamir');
    expect(getScenarioById('nonexistent')).toBeNull();
  });

  it('hasAttackScenario returns correct booleans', () => {
    expect(hasAttackScenario('fiat-shamir')).toBe(true);
    expect(hasAttackScenario('circuit')).toBe(true);
    expect(hasAttackScenario('recursive')).toBe(true);
    expect(hasAttackScenario('pedersen')).toBe(true);
  });

  it('ATTACK_DEMO_IDS lists all attack-capable demos', () => {
    expect(ATTACK_DEMO_IDS).toContain('fiat-shamir');
    expect(ATTACK_DEMO_IDS).toContain('circuit');
    expect(ATTACK_DEMO_IDS).toContain('pipeline');
    expect(ATTACK_DEMO_IDS).toContain('merkle');
    expect(ATTACK_DEMO_IDS).toContain('polynomial');
    expect(ATTACK_DEMO_IDS).toContain('elliptic');
    expect(ATTACK_DEMO_IDS).toContain('accumulator');
    expect(ATTACK_DEMO_IDS).toContain('lookup');
    expect(ATTACK_DEMO_IDS).toContain('recursive');
    expect(ATTACK_DEMO_IDS).toContain('plonk');
    expect(ATTACK_DEMO_IDS).toContain('groth16');
    expect(ATTACK_DEMO_IDS).toContain('sumcheck');
    expect(ATTACK_DEMO_IDS).toContain('fri');
    expect(ATTACK_DEMO_IDS).toContain('mle');
    expect(ATTACK_DEMO_IDS).toContain('nova');
    expect(ATTACK_DEMO_IDS).toContain('gkr');
    expect(ATTACK_DEMO_IDS).toContain('split-accumulation');
    expect(ATTACK_DEMO_IDS).toContain('rerandomization');
    expect(ATTACK_DEMO_IDS).toContain('oblivious-sync');
    expect(ATTACK_DEMO_IDS).toContain('constraint-counter');
    expect(ATTACK_DEMO_IDS).toContain('pedersen');
    expect(ATTACK_DEMO_IDS).toHaveLength(21);
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
    expect(getScenarioById('recursive-forgery')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('plonk-permutation-break')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('groth16-corrupt-proof')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('sumcheck-cheat')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('fri-degree-fraud')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('mle-forgery')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('nova-invalid-witness')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('gkr-false-output')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('split-acc-bad-fold')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('rerand-linkability')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('osync-deanonymize')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('sha256-cost-claim')?.conclusion.succeeded).toBe(false);
    expect(getScenarioById('pedersen-recover-value')?.conclusion.succeeded).toBe(false);
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

  it('Elliptic scenario sets up and reveals the toy ECDLP challenge', () => {
    const scenario = getScenarioById('ecdlp-toy-field')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('LOAD_ECDLP_CHALLENGE');
    expect(actionTypes).toContain('REVEAL_ECDLP_SOLUTION');

    const setupPayload = scenario.steps.find((s) => s.demoAction?.type === 'LOAD_ECDLP_CHALLENGE')?.demoAction?.payload as
      | { curve?: { p: number; a: number; b: number }; secretScalar?: number }
      | undefined;
    expect(setupPayload?.curve).toEqual({ p: 97, a: 2, b: 3 });
    expect(setupPayload?.secretScalar).toBe(17);
  });

  it('Accumulator scenario loads a target set and forges a witness', () => {
    const scenario = getScenarioById('forge-membership')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('LOAD_FORGERY_CHALLENGE');
    expect(actionTypes).toContain('FORGE_MEMBERSHIP_WITNESS');

    const setupPayload = scenario.steps.find((s) => s.demoAction?.type === 'LOAD_FORGERY_CHALLENGE')?.demoAction?.payload as
      | { primes?: number[]; target?: number }
      | undefined;
    expect(setupPayload?.primes).toEqual([3, 5, 11, 13]);
    expect(setupPayload?.target).toBe(17);
  });

  it('Lookup scenario switches views, injects an invalid wire, and runs LogUp', () => {
    const scenario = getScenarioById('lookup-smuggle')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('SET_VIEW');
    expect(actionTypes).toContain('SET_WIRE_VALUES');
    expect(actionTypes).toContain('RUN_LOGUP');

    const viewPayload = scenario.steps.find((s) => s.demoAction?.type === 'SET_VIEW')?.demoAction?.payload;
    const wirePayload = scenario.steps.find((s) => s.demoAction?.type === 'SET_WIRE_VALUES')?.demoAction?.payload;
    expect(viewPayload).toBe('multiset');
    expect(wirePayload).toBe('inject-invalid');
  });

  it('Recursive scenario loads an honest tree, then reloads it with a forged leaf', () => {
    const scenario = getScenarioById('recursive-forgery')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('LOAD_ATTACK_TREE');
    expect(actionTypes).toContain('START_VERIFICATION');

    const setupPayloads = scenario.steps
      .filter((s) => s.demoAction?.type === 'LOAD_ATTACK_TREE')
      .map((s) => s.demoAction!.payload) as Array<{ depth?: number; badProofNode?: string | null }>;
    expect(setupPayloads).toEqual([
      { depth: 2, badProofNode: null },
      { depth: 2, badProofNode: 'node_2_0' },
    ]);
  });

  it('PLONK scenario loads a clean circuit, then reloads it with a broken copy constraint', () => {
    const scenario = getScenarioById('plonk-permutation-break')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('LOAD_ATTACK_CIRCUIT');

    const payloads = scenario.steps
      .filter((s) => s.demoAction?.type === 'LOAD_ATTACK_CIRCUIT')
      .map((s) => s.demoAction!.payload) as Array<{ tab?: string; breakCopy?: boolean }>;
    expect(payloads).toEqual([
      { tab: 'gates', breakCopy: false },
      { tab: 'permutation', breakCopy: false },
      { tab: 'permutation', breakCopy: true },
    ]);
  });

  it('Groth16 scenario auto-runs, corrupts A, then verifies the tampered proof', () => {
    const scenario = getScenarioById('groth16-corrupt-proof')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('AUTO_RUN');
    expect(actionTypes).toContain('SET_CORRUPT');
    expect(actionTypes).toContain('STEP_PHASE');

    const corruptPayload = scenario.steps.find((s) => s.demoAction?.type === 'SET_CORRUPT')?.demoAction?.payload;
    const verifyPayload = scenario.steps.find((s) => s.demoAction?.type === 'STEP_PHASE')?.demoAction?.payload as
      | { phase?: string; corrupt?: string }
      | undefined;
    expect(corruptPayload).toBe('A');
    expect(verifyPayload).toEqual({ phase: 'verify', corrupt: 'A' });
  });

  it('Sumcheck scenario runs an honest baseline, then reruns with cheat mode enabled', () => {
    const scenario = getScenarioById('sumcheck-cheat')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('RUN_HONEST');
    expect(actionTypes).toContain('TOGGLE_CHEAT');
    expect(actionTypes).toContain('RUN_CHEAT');

    const cheatPayload = scenario.steps.find((s) => s.demoAction?.type === 'TOGGLE_CHEAT')?.demoAction?.payload;
    expect(cheatPayload).toBe(true);
  });

  it('FRI scenario runs an honest baseline, then reruns with corrupted evaluations', () => {
    const scenario = getScenarioById('fri-degree-fraud')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('RUN_HONEST');
    expect(actionTypes).toContain('TOGGLE_CORRUPT');
    expect(actionTypes).toContain('RUN_QUERY');

    const corruptPayload = scenario.steps.find((s) => s.demoAction?.type === 'TOGGLE_CORRUPT')?.demoAction?.payload;
    expect(corruptPayload).toBe(true);
  });

  it('MLE scenario sets the variable count, evaluates at a verifier point, then attempts a forged claim', () => {
    const scenario = getScenarioById('mle-forgery')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('SET_VARIABLES');
    expect(actionTypes).toContain('LOAD_ATTACK_EVALUATION');

    const evalPayloads = scenario.steps
      .filter((s) => s.demoAction?.type === 'LOAD_ATTACK_EVALUATION')
      .map((s) => s.demoAction!.payload) as Array<{ point?: number[]; claimedValue?: number }>;
    expect(evalPayloads).toEqual([
      { point: [2, 3] },
      { point: [2, 3], claimedValue: 42 },
    ]);
  });

  it('Nova scenario loads an honest chain, then reruns with an invalid witness', () => {
    const scenario = getScenarioById('nova-invalid-witness')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('LOAD_ATTACK_CHAIN');

    const payloads = scenario.steps
      .filter((s) => s.demoAction?.type === 'LOAD_ATTACK_CHAIN')
      .map((s) => s.demoAction!.payload) as Array<{
        numSteps?: number;
        baseX?: number;
        stepDelta?: number;
        badWitnessIndex?: number | null;
        runAll?: boolean;
      }>;
    expect(payloads).toEqual([
      { numSteps: 4, baseX: 3, stepDelta: 4, badWitnessIndex: null, runAll: true },
      { numSteps: 4, baseX: 3, stepDelta: 4, badWitnessIndex: 1, runAll: false },
      { numSteps: 4, baseX: 3, stepDelta: 4, badWitnessIndex: 1, runAll: true },
    ]);
  });

  it('GKR scenario resets, runs an honest proof, then loads a forged output claim', () => {
    const scenario = getScenarioById('gkr-false-output')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('RESET');
    expect(actionTypes).toContain('RUN_ALL');
    expect(actionTypes).toContain('LOAD_FORGED_OUTPUT_CLAIM');

    const forgedPayload = scenario.steps.find((s) => s.demoAction?.type === 'LOAD_FORGED_OUTPUT_CLAIM')?.demoAction?.payload;
    expect(forgedPayload).toBe(1);
  });

  it('Split accumulation scenario loads an honest trace, then reloads with a bad fold and failed settlement', () => {
    const scenario = getScenarioById('split-acc-bad-fold')!;
    const actionTypes = scenario.steps
      .filter((s) => s.demoAction)
      .map((s) => s.demoAction!.type);
    expect(actionTypes).toContain('LOAD_ATTACK_TRACE');

    const payloads = scenario.steps
      .filter((s) => s.demoAction?.type === 'LOAD_ATTACK_TRACE')
      .map((s) => s.demoAction!.payload) as Array<{ badFoldIndex?: number | null; settled?: boolean }>;
    expect(payloads).toEqual([
      { badFoldIndex: null, settled: true },
      { badFoldIndex: 2, settled: false },
      { badFoldIndex: 2, settled: true },
    ]);
  });
});
