import { describe, it, expect } from 'vitest';
import type { PredictState, PredictAction, PredictChallenge } from '../modes/predict/types';
import {
  getChallengesForDemo,
  getChallengesForDemoDifficulty,
  getRandomChallenge,
  getChallengeById,
  hasPredictChallenges,
  PREDICT_DEMO_IDS,
  ALL_CHALLENGES,
} from '../modes/predict/challenges';

// --- Reducer (inline since it's not exported) ---
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
      return {
        challenge: null,
        phase: 'prompt',
        selectedIndex: null,
        correct: null,
      };
    default:
      return state;
  }
}

const initialState: PredictState = {
  challenge: null,
  phase: 'prompt',
  selectedIndex: null,
  correct: null,
};

// --- Tests ---

describe('Predict challenge registry', () => {
  it('has challenges for 5 demos', () => {
    expect(PREDICT_DEMO_IDS).toHaveLength(5);
    expect(PREDICT_DEMO_IDS).toContain('merkle');
    expect(PREDICT_DEMO_IDS).toContain('circuit');
    expect(PREDICT_DEMO_IDS).toContain('fiat-shamir');
    expect(PREDICT_DEMO_IDS).toContain('polynomial');
    expect(PREDICT_DEMO_IDS).toContain('pipeline');
  });

  it('has at least 4 challenges per demo', () => {
    for (const demoId of PREDICT_DEMO_IDS) {
      const challenges = getChallengesForDemo(demoId);
      expect(challenges.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('each challenge has a unique id', () => {
    const ids = ALL_CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each challenge has exactly 4 choices', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c.choices).toHaveLength(4);
    }
  });

  it('correctIndex is within range for all challenges', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c.correctIndex).toBeGreaterThanOrEqual(0);
      expect(c.correctIndex).toBeLessThan(c.choices.length);
    }
  });

  it('returns null for demos without challenges', () => {
    expect(hasPredictChallenges('elliptic')).toBe(false);
    expect(getRandomChallenge('elliptic')).toBeNull();
  });

  it('hasPredictChallenges returns correct booleans', () => {
    expect(hasPredictChallenges('merkle')).toBe(true);
    expect(hasPredictChallenges('circuit')).toBe(true);
    expect(hasPredictChallenges('recursive')).toBe(false);
  });

  it('getChallengeById works', () => {
    expect(getChallengeById('merkle-leaf-change')?.demoId).toBe('merkle');
    expect(getChallengeById('nonexistent')).toBeNull();
  });

  it('filters by difficulty', () => {
    const beginners = getChallengesForDemoDifficulty('merkle', 'beginner');
    for (const c of beginners) {
      expect(c.difficulty).toBe('beginner');
    }
    expect(beginners.length).toBeGreaterThan(0);
  });

  it('getRandomChallenge excludes seen ids', () => {
    const allMerkle = getChallengesForDemo('merkle');
    const excludeAll = allMerkle.map((c) => c.id);
    expect(getRandomChallenge('merkle', undefined, excludeAll)).toBeNull();
  });
});

describe('Predict challenge data integrity', () => {
  it('every choice has a label and rationale', () => {
    for (const c of ALL_CHALLENGES) {
      for (const choice of c.choices) {
        expect(choice.label).toBeTruthy();
        expect(choice.rationale).toBeTruthy();
      }
    }
  });

  it('every challenge has required fields', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c.id).toBeTruthy();
      expect(c.demoId).toBeTruthy();
      expect(c.question).toBeTruthy();
      expect(c.hint).toBeTruthy();
      expect(c.explanation).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(['beginner', 'intermediate', 'advanced']).toContain(c.difficulty);
    }
  });

  it('all choice labels within a challenge are unique', () => {
    for (const c of ALL_CHALLENGES) {
      const labels = c.choices.map((ch) => ch.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('PredictProvider reducer', () => {
  const challenge: PredictChallenge = {
    id: 'test-challenge',
    demoId: 'merkle',
    difficulty: 'beginner',
    question: 'Test question?',
    hint: 'Test hint',
    choices: [
      { label: 'A', rationale: 'Wrong' },
      { label: 'B', rationale: 'Correct' },
      { label: 'C', rationale: 'Wrong' },
      { label: 'D', rationale: 'Wrong' },
    ],
    correctIndex: 1,
    explanation: 'B is correct.',
    category: 'test',
  };

  it('START_CHALLENGE initializes state', () => {
    const state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    expect(state.challenge?.id).toBe('test-challenge');
    expect(state.phase).toBe('prompt');
    expect(state.selectedIndex).toBeNull();
    expect(state.correct).toBeNull();
  });

  it('SELECT_CHOICE sets selected index', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 2 });
    expect(state.selectedIndex).toBe(2);
  });

  it('SELECT_CHOICE is ignored after lock-in', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 1 });
    state = predictReducer(state, { type: 'LOCK_IN' });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 3 });
    expect(state.selectedIndex).toBe(1); // unchanged
  });

  it('LOCK_IN transitions to locked phase', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 0 });
    state = predictReducer(state, { type: 'LOCK_IN' });
    expect(state.phase).toBe('locked');
  });

  it('LOCK_IN requires a selection', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'LOCK_IN' });
    expect(state.phase).toBe('prompt'); // no change
  });

  it('REVEAL shows correct answer', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 1 }); // correct
    state = predictReducer(state, { type: 'LOCK_IN' });
    state = predictReducer(state, { type: 'REVEAL' });
    expect(state.phase).toBe('revealed');
    expect(state.correct).toBe(true);
  });

  it('REVEAL shows incorrect answer', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 0 }); // wrong
    state = predictReducer(state, { type: 'LOCK_IN' });
    state = predictReducer(state, { type: 'REVEAL' });
    expect(state.phase).toBe('revealed');
    expect(state.correct).toBe(false);
  });

  it('REVEAL requires locked phase', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 0 });
    state = predictReducer(state, { type: 'REVEAL' });
    expect(state.phase).toBe('prompt'); // no change
  });

  it('RESET clears all state', () => {
    let state = predictReducer(initialState, { type: 'START_CHALLENGE', challenge });
    state = predictReducer(state, { type: 'SELECT_CHOICE', index: 1 });
    state = predictReducer(state, { type: 'LOCK_IN' });
    state = predictReducer(state, { type: 'REVEAL' });
    state = predictReducer(state, { type: 'RESET' });
    expect(state.challenge).toBeNull();
    expect(state.phase).toBe('prompt');
    expect(state.selectedIndex).toBeNull();
    expect(state.correct).toBeNull();
  });
});
