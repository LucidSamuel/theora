import type { AttackScenario } from './types';

export const UNDERCONSTRAINED_CIRCUIT: AttackScenario = {
  id: 'underconstrained-circuit',
  demoId: 'circuit',
  title: 'Underconstrained Circuit Exploit',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Prove a false statement by exploiting a missing constraint.',
    adversarySees: [
      'The circuit structure (gates and wires)',
      'The public output z',
      'The constraint equations',
    ],
    adversaryControls: [
      'All witness values (the adversary IS the prover)',
      'Intermediate wire values when constraints are missing',
    ],
    adversaryCannotDo: [
      'Cheat when all constraints are present',
      'Change the circuit structure (only the developer can)',
    ],
  },
  steps: [
    {
      id: 'honest-circuit',
      instruction: 'Examine the honest circuit. The computation is f(x, y) = x² + y with two constraints: t = x·x AND z = t + y. Every wire is determined.',
      demoAction: { type: 'SET_BROKEN', payload: false },
      observation: 'With both constraints, the witness is fully determined. Setting x=3, y=4 forces t=9 and z=13. No cheating is possible.',
      adversaryNarration: 'Both constraints are active. Every wire has exactly one valid value. I cannot produce a false proof.',
    },
    {
      id: 'remove-constraint',
      instruction: 'A developer forgot the multiplication constraint. Remove the t = x·x constraint by enabling the exploit toggle.',
      demoAction: { type: 'SET_BROKEN', payload: true },
      observation: 'Only one constraint remains: z = t + y. The wire t is now free — nothing enforces t = x·x.',
      adversaryNarration: 'One constraint is gone. The intermediate wire t has no constraint. I can set it to anything.',
    },
    {
      id: 'load-exploit',
      instruction: 'Load the exploit witness. This sets z = x² + y + 5, which is wrong — the correct answer for x=3, y=4 is 13, not 18.',
      demoAction: { type: 'LOAD_EXPLOIT' },
      observation: 'The circuit accepts! With only one constraint (z = t + y), any t that satisfies z − y = t is valid. The prover chose t to make a false z pass.',
      adversaryNarration: 'I set t = 14, z = 18. The remaining constraint z = t + y holds (18 = 14 + 4). I just proved x² + y = 18 for x=3, y=4. The correct answer is 13.',
    },
    {
      id: 'explain-impact',
      instruction: 'The verifier accepted a false statement. In a real system, this could mean approving a fraudulent transaction, accepting an invalid state transition, or verifying a counterfeit proof.',
      observation: 'The root cause: a missing constraint left a wire underdetermined. The prover exploited this freedom to satisfy the remaining constraints with wrong values.',
      adversaryNarration: 'The attack succeeds because the circuit developer assumed t = x·x would be enforced. Without the explicit constraint, the verifier has no way to check.',
    },
  ],
  conclusion: {
    succeeded: true,
    explanation: 'An underconstrained circuit has fewer constraints than necessary to fully determine the witness. This gives the prover freedom to choose wire values that satisfy the remaining constraints while producing an incorrect output.',
    securityGuarantee: 'Fix: every intermediate wire must be constrained. Formal verification tools can detect underconstrained wires by checking that each signal has a unique valid assignment given the public inputs.',
    realWorldExample: 'The Zcash Sapling counterfeiting bug (CVE-2019-7167) was exactly this pattern. Chaliasos et al. (USENIX Security 2024) found that 96% of SNARK circuit vulnerabilities are underconstrained-wire bugs.',
    furtherReading: 'Chaliasos et al., "The Blockchain Bug Bounty Landscape" (USENIX Security 2024)',
  },
};
