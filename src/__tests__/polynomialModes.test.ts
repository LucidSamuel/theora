import { describe, expect, it } from 'vitest';
import { createInitialPolynomialState, polynomialReducer } from '@/demos/polynomial/PolynomialDemo';

describe('polynomial mode switching', () => {
  it('clears comparison, evals, and KZG flow when switching sub-modes', () => {
    const state = {
      ...createInitialPolynomialState(),
      compareEnabled: true,
      compareCoefficients: [1, 2, 3],
      evalPoints: [{ x: 2, y: 9, label: 'p(2) = 9' }],
      kzg: {
        commitment: 'abc123',
        challengeZ: 2,
        revealedValue: 9,
        quotientPoly: [1, 2],
        proofHash: 'deadbeef',
        verified: true,
        currentStep: 4,
      },
    };

    const next = polynomialReducer(state, { type: 'SET_MODE', mode: 'lagrange' });

    expect(next.compareEnabled).toBe(false);
    expect(next.compareCoefficients).toEqual([]);
    expect(next.evalPoints).toEqual([]);
    expect(next.kzg.currentStep).toBe(0);
    expect(next.kzg.commitment).toBeNull();
    expect(next.kzg.challengeZ).toBeNull();
  });
});
