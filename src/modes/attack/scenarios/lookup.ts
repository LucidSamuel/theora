import type { AttackScenario } from './types';

export const LOOKUP_SMUGGLE: AttackScenario = {
  id: 'lookup-smuggle',
  demoId: 'lookup',
  title: 'Smuggle an Invalid Lookup',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Insert a wire value that is not in the table and try to make the LogUp sum still balance to zero.',
    adversarySees: [
      'The lookup table contents',
      'The current wire values',
      'The LogUp sum computation',
    ],
    adversaryControls: [
      'One wire value in the lookup column',
      'The claimed multiplicity counts',
    ],
    adversaryCannotDo: [
      'Choose the random challenge β',
      'Modify the table after commitment',
      'Skip the final sum check',
    ],
  },
  steps: [
    {
      id: 'observe-table',
      instruction: 'Examine the lookup table and wire values in the multiset view. All current wire values are contained in the table.',
      observation: 'The multiset check passes: every wire value has a matching table entry with correct multiplicity.',
      adversaryNarration: 'The table is small. If I swap one wire value for something outside the table, maybe I can adjust multiplicities to compensate.',
      demoAction: { type: 'SET_VIEW', payload: 'multiset' },
    },
    {
      id: 'inject-bad-wire',
      instruction: 'Replace one wire value with 99, which is not in the table. The multiset check should now fail.',
      observation: 'The multiset columns no longer match — wire contains a value absent from the table.',
      adversaryNarration: 'I have injected 99 into the wire column. Now I need the LogUp sum to still equal zero despite this mismatch.',
      demoAction: { type: 'SET_WIRE_VALUES', payload: 'inject-invalid' },
    },
    {
      id: 'run-logup',
      instruction: 'Switch to the LogUp view and run the protocol. The verifier picks a random β and computes the sum of inverse terms.',
      observation: 'The term 1/(β + 99) on the wire side has no matching table-side cancellation. The sum is nonzero.',
      adversaryNarration: 'The random β makes it impossible to balance the sum. I would need to know β in advance to find a compensating value.',
      demoAction: { type: 'RUN_LOGUP', payload: undefined },
    },
    {
      id: 'schwartz-zippel',
      instruction: 'The Schwartz-Zippel lemma guarantees that a random β catches the mismatch with overwhelming probability.',
      observation: 'Over a large field, the probability of accidentally finding a β that masks the invalid wire is negligible.',
      adversaryNarration: 'I cannot cheat. The random challenge exposes any mismatch between wire and table multiplicities.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'The LogUp protocol reduces the multiset check to a sum of rational terms over a random challenge β. An invalid wire value creates an unmatched term that the verifier detects. The Schwartz-Zippel lemma ensures that no choice of wire values can fool the check except with negligible probability.',
    securityGuarantee: 'Lookup soundness: for any polynomial-size table and wire column, a cheating prover can fool LogUp with probability at most d/|F|, where d is the number of lookups and |F| is the field size.',
  },
};
