import type { AttackScenario } from './types';

export const SPLIT_ACC_BAD_FOLD: AttackScenario = {
  id: 'split-acc-bad-fold',
  demoId: 'split-accumulation',
  title: 'Inject a Bad Fold into Split Accumulation',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Submit an invalid instance during accumulation and see if the final MSM check catches the error.',
    adversarySees: [
      'The current accumulated state',
      'The fold challenge r for each step',
      'The cost comparison between naive and split accumulation',
    ],
    adversaryControls: [
      'The instance submitted at one fold step',
    ],
    adversaryCannotDo: [
      'Choose the random fold challenge r',
      'Skip the final MSM verification',
      'Modify previously accumulated state',
    ],
  },
  steps: [
    {
      id: 'observe-honest',
      instruction: 'Watch an honest split accumulation run. Each step folds a valid instance into the accumulator cheaply.',
      observation: 'The accumulator grows through fold operations. At the end, the single MSM check verifies the entire chain. Cost savings vs naive: dramatic.',
      adversaryNarration: 'Each fold is just a random linear combination — very cheap. But the final MSM checks everything at once. Can I sneak a bad instance past the folds?',
      demoAction: { type: 'LOAD_ATTACK_TRACE', payload: { badFoldIndex: null, settled: true } },
    },
    {
      id: 'inject-bad-instance',
      instruction: 'Imagine injecting an invalid instance at step 3. The fold acc\' = acc + r·bad_instance uses a random r the adversary cannot control.',
      observation: 'The random challenge r means the bad instance is mixed into the accumulator with a weight the prover cannot predict. The error persists.',
      adversaryNarration: 'I submitted a bad instance, but r is random. I cannot choose the instance to cancel the existing accumulator error. The corruption propagates.',
      demoAction: { type: 'LOAD_ATTACK_TRACE', payload: { badFoldIndex: 2, settled: false } },
    },
    {
      id: 'final-msm-catches',
      instruction: 'The final MSM check verifies the accumulated instance. Since the bad fold corrupted the accumulator, the MSM fails.',
      observation: 'The MSM check detects the inconsistency. Even though individual fold steps are cheap and don\'t verify anything, the accumulated errors survive to the final check.',
      adversaryNarration: 'The deferred MSM caught my cheating. The random linear combinations preserve errors with overwhelming probability — they cannot accidentally cancel.',
      demoAction: { type: 'LOAD_ATTACK_TRACE', payload: { badFoldIndex: 2, settled: true } },
    },
    {
      id: 'schwartz-zippel',
      instruction: 'By the Schwartz-Zippel lemma, a bad instance can only cancel the accumulated error if r hits one of at most d roots of an error polynomial.',
      observation: 'Over a large field, the probability of error cancellation is at most d/|F|, which is negligible. The final MSM check is as sound as verifying each step individually.',
      adversaryNarration: 'Split accumulation is sound: cheap folds + one final check is as secure as verifying every step. I cannot cheat.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Split accumulation folds instances using random challenges, preserving any errors in the accumulator with overwhelming probability. The final MSM verification catches all accumulated inconsistencies. A cheating prover who injects a bad instance at any step is detected at the final check with probability \u2265 1 - d/|F| per fold.',
    securityGuarantee: 'Accumulation soundness: over a field F with N fold steps and max degree d, a cheating prover escapes detection with probability \u2264 N\u00b7d/|F|. For practical parameters, this is negligible.',
  },
};
