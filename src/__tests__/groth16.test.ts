import { describe, it, expect } from 'vitest';
import {
  buildR1CS,
  r1csToQAP,
  trustedSetup,
  prove,
  verify,
  corruptProof,
  computePublicOutput,
  buildPhaseData,
} from '../demos/groth16/logic';

describe('Groth16', () => {
  it('verification passes with correct witness (x=3)', () => {
    const r1cs = buildR1CS(3);
    expect(r1cs.satisfied).toBe(true);
    expect(r1cs.witness).toEqual([1, 3, 9, 17]);

    const qap = r1csToQAP(r1cs);
    const setup = trustedSetup();
    const proof = prove(qap, r1cs, setup);
    const result = verify(proof, setup, qap, r1cs.witness);

    expect(result.valid).toBe(true);
    expect(result.lhsPairing).toBe(result.rhsPairing);
  });

  it('verification passes for multiple x values', () => {
    for (const x of [1, 2, 5, 10, 42, 99]) {
      const r1cs = buildR1CS(x);
      expect(r1cs.satisfied).toBe(true);

      const qap = r1csToQAP(r1cs);
      const setup = trustedSetup();
      const proof = prove(qap, r1cs, setup);
      const result = verify(proof, setup, qap, r1cs.witness);

      expect(result.valid).toBe(true);
    }
  });

  it('verification fails with corrupted proof element A', () => {
    const r1cs = buildR1CS(3);
    const qap = r1csToQAP(r1cs);
    const setup = trustedSetup();
    const proof = corruptProof(prove(qap, r1cs, setup), 'A');
    const result = verify(proof, setup, qap, r1cs.witness);

    expect(result.valid).toBe(false);
    expect(result.lhsPairing).not.toBe(result.rhsPairing);
  });

  it('verification fails with corrupted proof element B', () => {
    const r1cs = buildR1CS(3);
    const qap = r1csToQAP(r1cs);
    const setup = trustedSetup();
    const proof = corruptProof(prove(qap, r1cs, setup), 'B');
    const result = verify(proof, setup, qap, r1cs.witness);

    expect(result.valid).toBe(false);
  });

  it('verification fails with corrupted proof element C', () => {
    const r1cs = buildR1CS(3);
    const qap = r1csToQAP(r1cs);
    const setup = trustedSetup();
    const proof = corruptProof(prove(qap, r1cs, setup), 'C');
    const result = verify(proof, setup, qap, r1cs.witness);

    expect(result.valid).toBe(false);
  });

  it('computePublicOutput matches witness', () => {
    expect(computePublicOutput(3)).toBe(17);  // 9 + 3 + 5
    expect(computePublicOutput(7)).toBe(61);  // 49 + 7 + 5
    expect(computePublicOutput(10)).toBe(14); // 100 + 10 + 5 = 115 mod 101 = 14
  });

  it('buildPhaseData at verify phase produces valid result without corruption', () => {
    const data = buildPhaseData(3, 'verify', 'none');
    expect(data.verifyResult).not.toBeNull();
    expect(data.verifyResult!.valid).toBe(true);
  });

  it('buildPhaseData at verify phase produces invalid result with corruption', () => {
    const data = buildPhaseData(3, 'verify', 'A');
    expect(data.verifyResult).not.toBeNull();
    expect(data.verifyResult!.valid).toBe(false);
  });
});
