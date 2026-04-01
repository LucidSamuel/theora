import type { AttackScenario } from './types';

export const POLYNOMIAL_SUBSTITUTION: AttackScenario = {
  id: 'polynomial-substitution',
  demoId: 'polynomial',
  title: 'Fool the Polynomial Verifier',
  difficulty: 'advanced',
  briefing: {
    goal: 'Commit to p(x) but convince the verifier you committed to a different polynomial q(x).',
    adversarySees: [
      'The commitment hash',
      'The challenge point z',
      'The verification equation',
    ],
    adversaryControls: [
      'The polynomial coefficients (before committing)',
      'The claimed evaluation value',
    ],
    adversaryCannotDo: [
      'Predict the challenge point z before committing',
      'Change the commitment after it is published',
      'Find two polynomials with the same commitment hash',
    ],
  },
  steps: [
    {
      id: 'honest-kzg',
      instruction: 'First, run the honest KZG flow. Commit to p(x) = x² + x + 5, receive a challenge, open honestly, and verify.',
      demoAction: { type: 'KZG_RESET' },
      observation: 'The honest flow succeeds. Commit → Challenge at random z → Reveal p(z) with quotient proof → Verify: commitment binding + polynomial identity hold.',
      adversaryNarration: 'The honest path works. The commitment locks in my polynomial. The challenge z is random. I must evaluate p(z) truthfully.',
    },
    {
      id: 'enable-comparison',
      instruction: 'Now consider the attack: you want to claim you committed to q(x) ≠ p(x). Enable comparison mode to see a second polynomial.',
      demoAction: { type: 'TOGGLE_COMPARE' },
      observation: 'Two polynomials are plotted. They intersect at a few points. At most d intersection points exist for degree-d polynomials (Schwartz-Zippel lemma).',
      adversaryNarration: 'If the challenge z happens to land on an intersection point, p(z) = q(z) and I could claim either polynomial. But the probability is at most d/|F|.',
    },
    {
      id: 'commit-and-challenge',
      instruction: 'Commit to p(x) and receive a random challenge z. The commitment is now fixed. You cannot change the polynomial.',
      demoAction: { type: 'KZG_RUN_COMMIT' },
      observation: 'The commitment is published. The challenge z is chosen at random from the field. With overwhelming probability, z is NOT an intersection point.',
      adversaryNarration: 'My commitment is locked. The challenge z was not at an intersection. p(z) ≠ q(z). If I try to open as q(z), the quotient proof will fail.',
    },
    {
      id: 'attempt-cheat',
      instruction: 'Try to open the commitment as q(z) instead of p(z). The quotient polynomial (p(x) − q(z)) / (x − z) will have a non-zero remainder.',
      demoAction: { type: 'KZG_RUN_OPEN' },
      observation: 'The verification will catch the mismatch. The recomputed commitment does not match, or the quotient identity fails. The opening proof is invalid.',
      adversaryNarration: 'The attack fails. The commitment binds me to p(x). The random challenge ensures p(z) ≠ q(z). I cannot produce a valid quotient proof for the wrong evaluation.',
    },
    {
      id: 'schwartz-zippel',
      instruction: 'The Schwartz-Zippel lemma: two distinct degree-d polynomials agree on at most d points. Over a 255-bit field, d/|F| ≈ 0. One random evaluation is sufficient.',
      observation: 'The number of intersection points is at most the degree of the polynomial. Over a large field (2²⁵⁵), the probability of hitting one is negligible.',
      adversaryNarration: 'My only hope was that z would land on an intersection — probability d/2²⁵⁵ ≈ 0. A single random challenge defeats polynomial substitution.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'The Schwartz-Zippel lemma guarantees that a random evaluation point catches any cheating prover with overwhelming probability. Two distinct degree-d polynomials can agree on at most d points out of |F| total field elements.',
    securityGuarantee: 'KZG commitments are binding (cannot change the polynomial after committing) and the random challenge ensures evaluation correctness. The security reduces to the hardness of the discrete log problem in the pairing group.',
    realWorldExample: 'KZG polynomial commitments are used in Ethereum\'s EIP-4844 (Proto-Danksharding), PlonK, and Marlin proof systems.',
  },
};
