import type { AttackScenario } from './types';

export const NOVA_INVALID_WITNESS: AttackScenario = {
  id: 'nova-invalid-witness',
  demoId: 'nova',
  title: 'Hide an Invalid Step Inside Nova',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Corrupt one witness and see whether Nova\'s folded accumulator can still pass the relaxed R1CS checks.',
    adversarySees: [
      'The circuit f(x) = x² + x + 5',
      'The witness progression and the verifier challenges used in each fold',
      'The folded accumulator values u, x, commitment, E, and T',
    ],
    adversaryControls: [
      'One witness value before it enters the accumulator',
      'Which computation step is corrupted',
    ],
    adversaryCannotDo: [
      'Change the relaxed R1CS verifier',
      'Alter previously folded honest steps after the fact',
      'Force Nova to ignore an unsatisfied fold',
    ],
  },
  steps: [
    {
      id: 'observe-honest-chain',
      instruction: 'Start from an honest Nova run so the baseline is clear.',
      observation: 'Every fold satisfies relaxed R1CS, and the final accumulator summarizes all prior steps.',
      adversaryNarration: 'The honest chain works. If I want to cheat, I need to sneak one false step into that accumulator.',
      demoAction: { type: 'LOAD_ATTACK_CHAIN', payload: { numSteps: 4, baseX: 3, stepDelta: 4, badWitnessIndex: null, runAll: true } },
    },
    {
      id: 'inject-bad-step',
      instruction: 'Corrupt witness 2 by changing its claimed output from y to y + 1.',
      observation: 'Only one computation step is invalid, but it is now marked before folding begins.',
      adversaryNarration: 'I only changed one witness. Maybe the accumulator will hide the mistake once everything is folded together.',
      demoAction: { type: 'LOAD_ATTACK_CHAIN', payload: { numSteps: 4, baseX: 3, stepDelta: 4, badWitnessIndex: 1, runAll: false } },
    },
    {
      id: 'run-bad-chain',
      instruction: 'Fold the corrupted witness into the chain and inspect the result.',
      observation: 'The first fold that absorbs the invalid witness fails its relaxed R1CS check, so the final chain is unsatisfied.',
      adversaryNarration: 'Caught immediately. The bad witness changes the fold algebra, so the accumulator cannot stay valid.',
      demoAction: { type: 'LOAD_ATTACK_CHAIN', payload: { numSteps: 4, baseX: 3, stepDelta: 4, badWitnessIndex: 1, runAll: true } },
    },
    {
      id: 'why-it-fails',
      instruction: 'Nova is succinct, but every absorbed step still has to satisfy the circuit relation.',
      observation: 'One invalid step poisons the fold that absorbs it. Compact accumulation does not weaken soundness.',
      adversaryNarration: 'The accumulator is small, not permissive. I cannot hide a false computation inside an honest Nova chain.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Nova folding preserves soundness only when every absorbed step satisfies the circuit. Once a bad witness is folded in, the relaxed R1CS check fails and the invalid computation is exposed.',
    securityGuarantee: 'Nova soundness reduces to the soundness of the underlying relaxed R1CS checks and the binding of the folded accumulator. A succinct accumulator cannot hide an unsatisfied step.',
  },
};
