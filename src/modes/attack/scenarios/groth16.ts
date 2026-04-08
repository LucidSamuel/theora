import type { AttackScenario } from './types';

export const GROTH16_CORRUPT_PROOF: AttackScenario = {
  id: 'groth16-corrupt-proof',
  demoId: 'groth16',
  title: 'Corrupt a Groth16 Proof Element',
  difficulty: 'beginner',
  briefing: {
    goal: 'Modify one element of a valid Groth16 proof and see if the pairing-based verifier catches the tampering.',
    adversarySees: [
      'The full proof triple (A, B, C) in their group elements',
      'The public inputs and verification key',
      'The pairing equation e(A,B) = e(\u03b1,\u03b2)\u00b7e(pub,\u03b3)\u00b7e(C,\u03b4)',
    ],
    adversaryControls: [
      'One proof element (A, B, or C) after the prover generates the proof',
    ],
    adversaryCannotDo: [
      'Access the toxic waste (\u03b1, \u03b2, \u03b3, \u03b4)',
      'Modify the verification key',
      'Change the public input',
    ],
  },
  steps: [
    {
      id: 'generate-valid-proof',
      instruction: 'First, run all phases to generate a valid Groth16 proof. Watch the pipeline: R1CS \u2192 QAP \u2192 Setup \u2192 Prove \u2192 Verify.',
      observation: 'A valid proof (A, B, C) is generated and the pairing check passes: e(A,B) = e(\u03b1,\u03b2)\u00b7e(pub,\u03b3)\u00b7e(C,\u03b4).',
      adversaryNarration: 'I have a valid proof. The pairing equation balances. Now I will tamper with one element to see if I can slip a modified proof past the verifier.',
      demoAction: { type: 'AUTO_RUN', payload: undefined },
    },
    {
      id: 'corrupt-element-a',
      instruction: 'Corrupt proof element A by incrementing it. This simulates an adversary modifying the proof after generation.',
      observation: 'A(G\u2081) changes from its valid value to valid+1. The other elements B and C remain untouched.',
      adversaryNarration: 'I have changed A by just 1. In a real group, even this tiny change completely alters the pairing output.',
      demoAction: { type: 'SET_CORRUPT', payload: 'A' },
    },
    {
      id: 'verify-corrupted',
      instruction: 'Run verification on the corrupted proof. The pairing check computes e(A\',B) and compares it to e(\u03b1,\u03b2)\u00b7e(pub,\u03b3)\u00b7e(C,\u03b4).',
      observation: 'INVALID \u2014 the pairing equation no longer holds. e(A\',B) \u2260 e(A,B) because pairings are sensitive to any input change.',
      adversaryNarration: 'The verifier caught my tampering instantly. The bilinear map amplifies even a \u00b11 change into a completely different pairing output.',
      demoAction: { type: 'STEP_PHASE', payload: { phase: 'verify', corrupt: 'A' } },
    },
    {
      id: 'conclusion-step',
      instruction: 'Without the toxic waste, an adversary cannot construct (A\', B\', C\') that satisfies the pairing equation for a false statement.',
      observation: 'The pairing check is an all-or-nothing verification: any modification to any proof element is detected.',
      adversaryNarration: 'I cannot forge a proof by tweaking elements. The algebraic structure of pairings makes proof forgery equivalent to breaking the discrete log assumption.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Groth16 verification uses bilinear pairings that are extremely sensitive to any change in proof elements. Corrupting A, B, or C by even \u00b11 breaks the pairing equation. Without the toxic waste from the trusted setup, an adversary cannot construct valid proof elements for a false statement.',
    securityGuarantee: 'Groth16 knowledge soundness: under the Generic Group Model and the q-PKE assumption, no efficient adversary can produce a valid proof for a false statement without knowing a valid witness (or the toxic waste).',
  },
};
