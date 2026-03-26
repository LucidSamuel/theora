import { describe, expect, it } from 'vitest';
import {
  buildMatchingGame,
  countChangedBytes,
  createOriginalProof,
  rerandomizeProof,
  scoreMatchingGame,
  verifiedSameStatement,
} from '@/demos/rerandomization/logic';

describe('rerandomization logic', () => {
  it('preserves the statement while changing the proof bytes', () => {
    const original = createOriginalProof(0);
    const rerandomized = rerandomizeProof(original, 7);

    expect(rerandomized.statementHash).toBe(original.statementHash);
    expect(rerandomized.proofHash).not.toBe(original.proofHash);
    expect(countChangedBytes(original, rerandomized)).toBeGreaterThan(0);
    expect(verifiedSameStatement(original, rerandomized)).toBe(true);
  });

  it('builds a matching game with a shuffled rerandomized set', () => {
    const game = buildMatchingGame(11);

    expect(game.originals).toHaveLength(3);
    expect(game.shuffled).toHaveLength(3);
    expect(new Set(game.shuffled.map((card) => card.originalId)).size).toBe(3);
  });

  it('scores user guesses against the hidden original mapping', () => {
    const game = buildMatchingGame(3);
    const perfectGuesses = Object.fromEntries(game.shuffled.map((card) => [card.id, card.originalId]));
    const wrongGuesses = Object.fromEntries(game.shuffled.map((card) => [card.id, game.originals[0]!.id]));

    expect(scoreMatchingGame(game, perfectGuesses)).toEqual({ correct: 3, total: 3 });
    expect(scoreMatchingGame(game, wrongGuesses).correct).toBeLessThan(3);
  });
});
