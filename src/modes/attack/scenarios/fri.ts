import type { AttackScenario } from './types';

export const FRI_DEGREE_FRAUD: AttackScenario = {
  id: 'fri-degree-fraud',
  demoId: 'fri',
  title: 'Submit a Non-Low-Degree Function to FRI',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Commit to a function that is NOT a low-degree polynomial and try to pass the FRI verifier\'s query checks.',
    adversarySees: [
      'The evaluation domain and field size GF(257)',
      'The expected degree bound for the protocol',
      'The number of queries the verifier will make',
    ],
    adversaryControls: [
      'The evaluations committed in each FRI layer',
      'Whether the committed function is actually a polynomial',
    ],
    adversaryCannotDo: [
      'Predict the verifier\'s query positions before committing',
      'Change committed evaluations after the query phase begins',
      'Modify the random folding challenges \u03b1',
    ],
  },
  steps: [
    {
      id: 'honest-baseline',
      instruction: 'First, run FRI with an honest low-degree polynomial to see a successful proof.',
      observation: 'The commit phase folds the polynomial through several layers. Query checks pass \u2014 the verifier confirms the function is low-degree.',
      adversaryNarration: 'The honest path works. The folding produces consistent layers because the function really is a polynomial. Now I will try corrupting it.',
      demoAction: { type: 'RUN_HONEST', payload: undefined },
    },
    {
      id: 'corrupt-evaluations',
      instruction: 'Enable "not low-degree" mode. This corrupts several evaluation points so the function no longer matches any low-degree polynomial.',
      observation: 'The evaluations are randomly perturbed. The committed function now disagrees with every degree-d polynomial on multiple points.',
      adversaryNarration: 'I have injected noise into the evaluations. The commit phase will still run \u2014 it blindly folds whatever I give it. But the query phase should expose the fraud.',
      demoAction: { type: 'TOGGLE_CORRUPT', payload: true },
    },
    {
      id: 'query-fails',
      instruction: 'Run the query phase. The verifier opens random positions and checks consistency between adjacent FRI layers.',
      observation: 'Query checks FAIL \u2014 the folded values are inconsistent because the corruption breaks the algebraic relationship between layers.',
      adversaryNarration: 'The queries caught me. The corrupted evaluations don\'t fold consistently, so the verifier sees a mismatch at the opened positions.',
      demoAction: { type: 'RUN_QUERY', payload: undefined },
    },
    {
      id: 'soundness-analysis',
      instruction: 'FRI\'s security comes from the combination of random folding challenges and random query positions. Both are outside the prover\'s control.',
      observation: 'Even if a few queries happen to land on uncorrupted positions, enough queries will statistically catch the fraud. The soundness error decreases exponentially with the number of queries.',
      adversaryNarration: 'With each additional query, my chances of escaping detection drop exponentially. FRI is sound: non-low-degree functions are rejected with overwhelming probability.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'FRI detects non-low-degree functions through query consistency checks. If the committed evaluations do not correspond to a low-degree polynomial, the folding between layers introduces inconsistencies that random queries expose. The probability of a corrupt function passing Q queries is at most (1-\u03b4)^Q, where \u03b4 is the fraction of corrupted positions.',
    securityGuarantee: 'FRI proximity testing: for a function that is \u03b4-far from every degree-d polynomial, Q random queries reject with probability \u2265 1 - (1-\u03b4)^Q. For practical parameters (Q \u2265 30), this is overwhelming.',
  },
};
