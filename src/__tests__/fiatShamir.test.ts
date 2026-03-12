import { describe, it, expect } from 'vitest';
import { simulateProof, simulateStatement, derivePublicKey, forgePredictableProof } from '@/demos/fiat-shamir/logic';

describe('fiat-shamir logic', () => {
  it('produces a valid proof in correct Fiat-Shamir mode', () => {
    const statement = simulateStatement(9);
    const proof = simulateProof('fs-correct', statement, 9, 12, 17);
    expect(proof.valid).toBe(true);
  });

  it('allows a forged proof only in broken mode', () => {
    const statement = simulateStatement(9);
    const publicKey = derivePublicKey(9);
    const forged = forgePredictableProof(statement, publicKey, 'fs-broken');
    expect(forged?.valid).toBe(true);
    expect(forgePredictableProof(statement, publicKey, 'fs-correct')).toBeNull();
  });
});
