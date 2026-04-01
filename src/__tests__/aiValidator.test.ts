import { describe, it, expect } from 'vitest';
import { validateAiPrediction } from '../modes/predict/ai/validator';
import type { AiPrediction } from '../modes/predict/types';

function makePrediction(overrides: Partial<AiPrediction> = {}): AiPrediction {
  return {
    question: 'What happens when you change the leaf?',
    choices: [
      { label: 'Choice A', rationale: 'Rationale A' },
      { label: 'Choice B', rationale: 'Rationale B' },
      { label: 'Choice C', rationale: 'Rationale C' },
      { label: 'Choice D', rationale: 'Rationale D' },
    ],
    correctIndex: 0,
    explanation: 'The correct answer is A because of cryptographic properties.',
    ...overrides,
  };
}

describe('AI prediction validator', () => {
  it('passes valid prediction', () => {
    const result = validateAiPrediction(makePrediction(), 'merkle');
    expect(result).toBeNull();
  });

  it('rejects wrong number of choices', () => {
    const result = validateAiPrediction(
      makePrediction({ choices: [{ label: 'A', rationale: 'R' }] }),
      'merkle',
    );
    expect(result).toContain('Expected 4 choices');
  });

  it('rejects out-of-range correctIndex', () => {
    const result = validateAiPrediction(
      makePrediction({ correctIndex: 5 }),
      'merkle',
    );
    expect(result).toContain('out of range');
  });

  it('rejects too-short question', () => {
    const result = validateAiPrediction(
      makePrediction({ question: 'Short?' }),
      'merkle',
    );
    expect(result).toContain('too short');
  });

  it('rejects too-short explanation', () => {
    const result = validateAiPrediction(
      makePrediction({ explanation: 'Yes.' }),
      'merkle',
    );
    expect(result).toContain('too short');
  });

  it('rejects duplicate choice labels', () => {
    const result = validateAiPrediction(
      makePrediction({
        choices: [
          { label: 'Same', rationale: 'R1' },
          { label: 'Same', rationale: 'R2' },
          { label: 'Other', rationale: 'R3' },
          { label: 'Another', rationale: 'R4' },
        ],
      }),
      'merkle',
    );
    expect(result).toContain('Duplicate');
  });

  it('catches circuit equation contradiction', () => {
    const result = validateAiPrediction(
      makePrediction({
        question: 'What happens when x² + y changes?',
        explanation: 'The circuit computes x² - y so the result is different.',
      }),
      'circuit',
    );
    expect(result).toContain('contradicts');
  });

  it('catches broken Fiat-Shamir misconception', () => {
    const result = validateAiPrediction(
      makePrediction({
        question: 'What does broken FS do?',
        explanation: 'The broken version includes the commitment in the hash, making it secure.',
      }),
      'fiat-shamir',
    );
    expect(result).toContain('OMITS');
  });

  it('catches Merkle proof size misconception', () => {
    const result = validateAiPrediction(
      makePrediction({
        question: 'How big is the proof?',
        explanation: 'The proof length is O(n) for a tree with n leaves.',
      }),
      'merkle',
    );
    expect(result).toContain('O(log n)');
  });

  it('passes for demos without specific validators', () => {
    const result = validateAiPrediction(makePrediction(), 'accumulator');
    expect(result).toBeNull();
  });
});
