import type { AttackScenario } from './types';

export const PEDERSEN_HIDING_ATTACK: AttackScenario = {
  id: 'pedersen-recover-value',
  demoId: 'pedersen',
  title: 'Recover a Hidden Value from a Pedersen Commitment',
  difficulty: 'beginner',
  briefing: {
    goal: 'Given only a Pedersen commitment C, recover the committed value v without learning the blinding factor r.',
    adversarySees: [
      'The public parameters p, g, and h',
      'The commitment C = g^v · h^r mod p',
      'The verified statement that C is well-formed',
    ],
    adversaryControls: [
      'Offline analysis of the public commitment',
      'Comparisons against other commitments to the same statement',
    ],
    adversaryCannotDo: [
      'Read the hidden blinding factor r',
      'Modify the opening after the commitment is fixed',
      'Learn any trapdoor relating g and h',
    ],
  },
  steps: [
    {
      id: 'load-hidden-commitment',
      instruction: 'A commitment is published with its blinding hidden. Try to read the value directly from C.',
      observation: 'You see a single opaque group element. Without the blinding, the commitment alone does not tell you which value was committed.',
      adversaryNarration: 'I can inspect C, but every value is masked by the hidden h^r term. The commitment looks like a random group element.',
      demoAction: { type: 'LOAD_ATTACK_COMMITMENT', payload: { value: 42, randomness: 17, showBlinding: false } },
    },
    {
      id: 'same-value-fresh-randomness',
      instruction: 'Now publish a second commitment to the same value but with fresh randomness. Compare the result.',
      observation: 'The value is unchanged, but the commitment changes because the blinding factor changed. Linkability from bytes alone disappears.',
      adversaryNarration: 'Even when the value stays fixed, fresh randomness produces a different commitment. I still cannot isolate v from what I see.',
      demoAction: { type: 'LOAD_ATTACK_COMMITMENT', payload: { value: 42, randomness: 58, showBlinding: false } },
    },
    {
      id: 'reveal-opening',
      instruction: 'Only after the prover reveals the opening pair (v, r) can the verifier recompute the commitment exactly.',
      observation: 'Once v and r are revealed together, the verifier can check C = g^v · h^r. Until then, the commitment remains perfectly hiding.',
      adversaryNarration: 'The attack failed. I can verify an opening once it is disclosed, but I cannot extract it from the commitment alone.',
      demoAction: { type: 'LOAD_ATTACK_COMMITMENT', payload: { value: 42, randomness: 58, showBlinding: true } },
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Pedersen commitments are perfectly hiding: the randomness term h^r statistically masks the committed value. Observing C alone does not reveal v.',
    securityGuarantee: 'Under the standard Pedersen setup assumptions, the commitment distribution for any fixed value is identical once r is sampled uniformly. The verifier can check an opening, but cannot recover it from C alone.',
    realWorldExample: 'Pedersen commitments are used in confidential transactions, Bulletproofs-style range proofs, and many zero-knowledge protocols where hidden values must still support algebraic verification.',
  },
};
