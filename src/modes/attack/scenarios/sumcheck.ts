import type { AttackScenario } from './types';

export const SUMCHECK_CHEAT: AttackScenario = {
  id: 'sumcheck-cheat',
  demoId: 'sumcheck',
  title: 'Cheat the Sumcheck Verifier',
  difficulty: 'beginner',
  briefing: {
    goal: 'Claim a false sum and try to pass all rounds of the sumcheck protocol without being caught.',
    adversarySees: [
      'The multilinear polynomial f evaluated at all 2^n Boolean inputs',
      'The honest sum S = \u03a3 f(x)',
      'The verifier\'s random challenges after each round',
    ],
    adversaryControls: [
      'The claimed sum (can lie about the total)',
      'The univariate polynomials sent in each round',
    ],
    adversaryCannotDo: [
      'Predict the verifier\'s random challenges before committing to each round polynomial',
      'Change a previously sent polynomial after seeing the challenge',
      'Tamper with the final oracle query',
    ],
  },
  steps: [
    {
      id: 'setup-honest',
      instruction: 'First, observe an honest sumcheck run. The prover claims S = \u03a3f(x) and sends consistent round polynomials.',
      observation: 'All rounds pass: g(0) + g(1) = expected sum in each round. The final oracle check also passes.',
      adversaryNarration: 'The honest protocol works. Now let me try claiming a different sum \u2014 say S + 1 \u2014 and see if I can fake the round polynomials.',
      demoAction: { type: 'RUN_HONEST', payload: undefined },
    },
    {
      id: 'enable-cheat',
      instruction: 'Enable cheat mode. The prover now claims S + 1 as the sum \u2014 one more than the true value.',
      observation: 'The claimed sum changes from 36 to 37 (for default values). The prover must now construct g\u2081(x) such that g\u2081(0) + g\u2081(1) = 37.',
      adversaryNarration: 'I added 1 to the sum. To pass round 1, I need g\u2081(0) + g\u2081(1) = 37 instead of 36. I can adjust one coefficient... but then subsequent rounds will be inconsistent.',
      demoAction: { type: 'TOGGLE_CHEAT', payload: true },
    },
    {
      id: 'run-cheat',
      instruction: 'Step through the protocol with the false claim. Watch how the error propagates through rounds.',
      observation: 'Round 1 immediately fails: g\u2081(0) + g\u2081(1) \u2260 37. The verifier catches the lie in the very first round because the prover cannot construct a valid degree-1 polynomial that sums to the wrong value while being consistent with the true function.',
      adversaryNarration: 'Caught in round 1. The sumcheck structure forces each round polynomial to be consistent with the actual function evaluations. Lying about the sum creates an unavoidable mismatch.',
      demoAction: { type: 'RUN_CHEAT', payload: undefined },
    },
    {
      id: 'why-caught',
      instruction: 'The Schwartz-Zippel lemma guarantees detection: a false polynomial can only agree with the true one at d points out of |F|.',
      observation: 'Over GF(101) with degree-1 polynomials, the prover has only a 1/101 chance of escaping detection per round. Over 3 rounds, the probability of getting away with it is at most 3/101 \u2248 3%.',
      adversaryNarration: 'The random challenges are my undoing. Even if I got lucky in round 1, the error would surface in a later round or the final oracle check. The protocol is sound.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'A cheating prover who claims a false sum must send at least one inconsistent round polynomial. The verifier\'s random challenge catches this inconsistency with probability \u2265 1 - d/|F| per round. Over n rounds, the total soundness error is at most n\u00b7d/|F|, which is negligible for large fields.',
    securityGuarantee: 'Sumcheck soundness: over GF(q) with n variables and max degree d per variable, a cheating prover passes all rounds with probability \u2264 n\u00b7d/q. For GF(101) with n=3, d=1: error \u2264 3/101 \u2248 3%.',
  },
};
