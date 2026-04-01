import type { AttackScenario } from './types';

export const BREAK_THE_PIPELINE: AttackScenario = {
  id: 'break-the-pipeline',
  demoId: 'pipeline',
  title: 'Break the Proof Pipeline',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Try all 4 attacks and discover which one the verifier fails to catch.',
    adversarySees: [
      'The 7-stage proof pipeline',
      'The public output and commitment',
      'The verification result at each stage',
    ],
    adversaryControls: [
      'The witness value (bad balance)',
      'The polynomial encoding',
      'The Fiat-Shamir challenge derivation',
      'The opening proof',
    ],
    adversaryCannotDo: [
      'Modify the verifier logic',
      'Change the constraint system',
    ],
  },
  steps: [
    {
      id: 'observe-clean',
      instruction: 'First, observe the clean pipeline. All 7 stages pass with an honest witness. This is a valid transaction proof.',
      demoAction: { type: 'SET_FAULT', payload: 'none' },
      observation: 'Every stage produces consistent outputs. The final verification succeeds.',
      adversaryNarration: 'The honest path works. Now I need to find a way to forge a proof that passes verification.',
    },
    {
      id: 'attack-bad-witness',
      instruction: 'Attack 1: Lie about the witness. Submit a wrong computation for x² (x·x+1 instead of x²).',
      demoAction: { type: 'SET_FAULT', payload: 'bad-witness' },
      observation: 'The bad witness produces wrong constraint outputs. The constraint check catches the inconsistency. Verification fails.',
      adversaryNarration: 'Caught at the constraints stage. The R1CS system detected that my witness does not satisfy t = x·x.',
    },
    {
      id: 'attack-bad-polynomial',
      instruction: 'Attack 2: Corrupt the polynomial encoding. Add 0.5 to the leading coefficient after computing the polynomial.',
      demoAction: { type: 'SET_FAULT', payload: 'bad-polynomial' },
      observation: 'The corrupted polynomial does not match the commitment. The opening check fails because the quotient polynomial is inconsistent.',
      adversaryNarration: 'Caught at the opening stage. The commitment binds the polynomial — I cannot change it after committing.',
    },
    {
      id: 'attack-weak-fs',
      instruction: 'Attack 3: Use weak Fiat-Shamir. Replace the hash-derived challenge with a fixed value (7).',
      demoAction: { type: 'SET_FAULT', payload: 'weak-fiat-shamir' },
      observation: 'The pipeline completes. All stages show green. The verifier accepts the proof.',
      adversaryNarration: 'This is interesting. The proof passes because the challenge is still a valid field element. The verifier cannot tell it was not randomly derived.',
    },
    {
      id: 'attack-bad-opening',
      instruction: 'Attack 4: Forge the opening proof. Corrupt the quotient polynomial by adding 1 to the first coefficient.',
      demoAction: { type: 'SET_FAULT', payload: 'bad-opening' },
      observation: 'The corrupted quotient fails the opening check. The verifier rejects because (x−z)·q(x) + p(z) does not reconstruct p(x).',
      adversaryNarration: 'Caught at verification. The KZG opening proof is binding — any modification to the quotient breaks the polynomial identity.',
    },
    {
      id: 'debrief',
      instruction: 'Review: 3 of 4 attacks were caught. Only the weak Fiat-Shamir attack succeeded. Why?',
      demoAction: { type: 'SET_FAULT', payload: 'none' },
      observation: 'Weak Fiat-Shamir produces a proof that looks valid because it does not violate binding or soundness — it violates the randomness assumption. The challenge must be unpredictable.',
      adversaryNarration: 'The pipeline catches structural attacks (bad witness, bad polynomial, bad opening) through algebraic checks. But Fiat-Shamir is a protocol-level guarantee — a fixed challenge is still mathematically valid, just not sound.',
    },
  ],
  conclusion: {
    succeeded: true,
    explanation: 'Three attacks are caught by algebraic verification (constraints, commitment binding, opening proof). The weak Fiat-Shamir attack succeeds because the verifier cannot distinguish a hash-derived challenge from a fixed one — soundness requires randomness, which the verifier assumes but cannot verify.',
    securityGuarantee: 'Fix: Fiat-Shamir must hash the full transcript. The verifier trusts that the challenge was derived correctly. In interactive proofs, the verifier generates the randomness directly. The Fiat-Shamir transform replaces this with a hash — but only if the hash input is complete.',
    realWorldExample: 'Weak Fiat-Shamir implementations have been found in multiple production systems, including early Bulletproofs and PlonK implementations.',
  },
};
