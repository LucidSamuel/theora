import type { AttackScenario } from './types';

export const PLONK_PERMUTATION_BREAK: AttackScenario = {
  id: 'plonk-permutation-break',
  demoId: 'plonk',
  title: 'Break a PLONK Copy Constraint',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Violate a copy constraint by assigning different values to wires that should be equal, and observe how the permutation argument catches the cheat.',
    adversarySees: [
      'The gate layout with 3 gates and their selector values',
      'The copy constraint assignments linking wires across gates',
      'The grand product accumulator Z',
    ],
    adversaryControls: [
      'One wire value in Gate 0 that is copy-constrained to Gate 1',
    ],
    adversaryCannotDo: [
      'Modify the permutation polynomial \u03c3',
      'Choose the random challenges \u03b2 and \u03b3',
      'Alter the gate selector values',
    ],
  },
  steps: [
    {
      id: 'observe-constraints',
      instruction: 'Examine the Gates tab. Gate 0 is an addition gate: a + b = c. Gate 1 uses Gate 0\'s output as an input via a copy constraint.',
      observation: 'The circuit has wires connected across gates. The permutation argument enforces these connections.',
      adversaryNarration: 'I see that Gate 0\'s output c\u2080 is copy-constrained to Gate 1\'s input a\u2081. If I change c\u2080 without changing a\u2081, the copy constraint breaks.',
      demoAction: { type: 'LOAD_ATTACK_CIRCUIT', payload: { tab: 'gates', breakCopy: false } },
    },
    {
      id: 'switch-to-permutation',
      instruction: 'Switch to the Permutation tab to see the grand product Z accumulating across gates.',
      observation: 'Z starts at 1 and multiplies through each gate. If all copy constraints hold, Z(n) should return to 1.',
      adversaryNarration: 'The grand product Z is the weak point. If I break a copy constraint, Z(n) will diverge from 1.',
      demoAction: { type: 'LOAD_ATTACK_CIRCUIT', payload: { tab: 'permutation', breakCopy: false } },
    },
    {
      id: 'break-copy',
      instruction: 'Click "Break a copy constraint" to assign wire c\u2080 = 99 while a\u2081 remains at its original value.',
      observation: 'Z(n) is no longer 1. The grand product diverges because the permuted wire values no longer match.',
      adversaryNarration: 'The copy constraint is broken. Z(3) shows a value far from 1. The verifier will immediately detect this.',
      demoAction: { type: 'LOAD_ATTACK_CIRCUIT', payload: { tab: 'permutation', breakCopy: true } },
    },
    {
      id: 'detect-failure',
      instruction: 'The permutation check Z(n) \u2260 1 proves that wires declared equal carry different values. The verifier rejects.',
      observation: 'The grand product catches any inconsistency in wire assignments. Even a single mismatched copy constraint makes Z(n) \u2260 1.',
      adversaryNarration: 'I cannot break a copy constraint without the grand product exposing it. The random challenges \u03b2, \u03b3 ensure I cannot craft values to make Z(n) = 1 by coincidence.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'The permutation argument computes a grand product Z over all wire values using random challenges \u03b2 and \u03b3. If any copy-constrained pair carries different values, the product Z(n) \u2260 1, and the verifier rejects. The Schwartz-Zippel lemma ensures that no adversary can make Z(n) = 1 except with negligible probability.',
    securityGuarantee: 'PLONK permutation soundness: for N gates over a field F, a cheating prover who violates k copy constraints is caught with probability \u2265 1 \u2212 N/|F|.',
  },
};
