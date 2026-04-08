import type { AttackScenario } from './types';

export const FORGE_MEMBERSHIP: AttackScenario = {
  id: 'forge-membership',
  demoId: 'accumulator',
  title: 'Forge an RSA Accumulator Membership Proof',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Produce a valid membership witness for a prime that is NOT in the accumulated set.',
    adversarySees: [
      'The RSA modulus n (product of two unknown primes)',
      'The generator g',
      'The current accumulator value acc = g^(∏eᵢ) mod n',
      'The set of accumulated primes (public)',
    ],
    adversaryControls: [
      'Choice of target prime x to forge membership for',
      'Unlimited computation time over the toy modulus',
    ],
    adversaryCannotDo: [
      'Factor the modulus n (in the security model)',
      'Modify the accumulator value',
      'Change the set of accumulated elements',
    ],
  },
  steps: [
    {
      id: 'observe-accumulator',
      instruction: 'An RSA accumulator has been built with several primes. The accumulator value acc = g^(e₁·e₂·...·eₖ) mod n is public. Your target: forge a witness for a prime x that is NOT in the set.',
      observation: 'The accumulator holds g raised to the product of all set primes. A valid membership witness w for element x satisfies w^x ≡ acc (mod n).',
      adversaryNarration: 'I need to find w such that w^x ≡ acc (mod n). That means w = acc^(1/x) mod n — I need to compute an x-th root modulo n.',
      demoAction: {
        type: 'LOAD_FORGERY_CHALLENGE',
        payload: {
          primes: [3, 5, 11, 13],
          target: 17,
        },
      },
    },
    {
      id: 'attempt-root',
      instruction: 'To forge a witness for x, you need w = acc^(1/x) mod n. Try computing this directly. You need the x-th root of acc modulo n.',
      observation: 'Computing roots mod n requires knowing the factorization of n (to compute φ(n) and then the modular inverse of x mod φ(n)). Without the factorization, this is believed to be hard.',
      adversaryNarration: 'If I knew φ(n) = (p-1)(q-1), I could compute d = x^(-1) mod φ(n) and then w = acc^d mod n. But n is a product of two large unknown primes — I cannot factor it.',
    },
    {
      id: 'toy-modulus-factor',
      instruction: 'However, this demo uses a toy modulus n = 1000000007 × 1000000009. With small factors, you can factor n and compute roots directly.',
      observation: 'Over a toy modulus, factoring is trivial. Once you know p and q, you can compute φ(n) = (p-1)(q-1) and find any root. The attack succeeds completely.',
      adversaryNarration: 'I factored n instantly. Now I can compute any root: d = x^(-1) mod φ(n), w = acc^d mod n. The witness is valid. The toy modulus provides no security.',
      demoAction: {
        type: 'FORGE_MEMBERSHIP_WITNESS',
      },
    },
    {
      id: 'production-security',
      instruction: 'In production, RSA accumulators use 2048+ bit moduli where n = p·q with p, q each ~1024 bits. Factoring such n is infeasible with current technology.',
      observation: 'The strong RSA assumption states: given n and u, finding (e, w) with w^e ≡ u mod n for ANY e > 1 is hard. This is even stronger than standard RSA (where e is fixed).',
      adversaryNarration: 'Against a 2048-bit modulus, factoring requires ~2^110 operations. My root-extraction attack is completely infeasible. The strong RSA assumption holds.',
    },
  ],
  conclusion: {
    succeeded: true,
    explanation: 'On the toy modulus, the attack succeeds because factoring n = 1000000007 × 1000000009 is trivial. With the factorization, computing arbitrary roots mod n is straightforward. This demonstrates exactly why production RSA accumulators require large moduli.',
    securityGuarantee: 'RSA accumulator security relies on the strong RSA assumption: computing arbitrary roots modulo a properly-generated RSA modulus is infeasible. With 2048-bit moduli, the best known factoring algorithms require approximately 2^110 operations — well beyond current computational limits.',
    realWorldExample: 'RSA accumulators are used in certificate revocation (via dynamic accumulators), anonymous credentials (Camenisch-Lysyanskaya), and blockchain state commitments (Boneh et al. for stateless validation).',
  },
};
