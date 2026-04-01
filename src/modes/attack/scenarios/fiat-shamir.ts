import type { AttackScenario } from './types';

export const FROZEN_HEART: AttackScenario = {
  id: 'frozen-heart',
  demoId: 'fiat-shamir',
  title: 'Frozen Heart Forgery',
  difficulty: 'beginner',
  briefing: {
    goal: 'Forge a valid Schnorr proof without knowing the secret key.',
    adversarySees: [
      'Public key (g^secret mod p)',
      'Public input (statement)',
      'The verification equation: g^response = commitment · publicKey^challenge',
    ],
    adversaryControls: [
      'The commitment value (if the transcript hash omits it)',
    ],
    adversaryCannotDo: [
      'Learn the secret key',
      'Predict the challenge when Fiat-Shamir is correct',
    ],
  },
  steps: [
    {
      id: 'observe-honest',
      instruction: 'First, observe the honest protocol. The verifier derives e = Hash(commitment, public_input). You cannot predict e before choosing your commitment.',
      demoAction: { type: 'SET_MODE', payload: 'fs-correct' },
      observation: 'The challenge depends on the commitment. Any change to the commitment produces a completely different challenge.',
      adversaryNarration: 'I can see the public key and the verification equation, but the challenge is unpredictable. I cannot work backward.',
    },
    {
      id: 'spot-vulnerability',
      instruction: 'Now examine what happens when the implementation derives e = Hash(public_input) — without the commitment.',
      demoAction: { type: 'SET_MODE', payload: 'fs-broken' },
      observation: 'The challenge no longer depends on the commitment. It is fixed before the prover speaks.',
      adversaryNarration: 'The challenge is now deterministic. I can compute it before choosing my commitment. This changes everything.',
    },
    {
      id: 'compute-challenge',
      instruction: 'With the broken transcript, compute the challenge first. Since Hash(public_input) is fixed, you know e before committing.',
      observation: 'The challenge e is now known to the adversary before any interaction.',
      adversaryNarration: 'I now know e. A correct implementation would have made this impossible — the commitment would feed into the hash.',
    },
    {
      id: 'forge-backward',
      instruction: 'Choose an arbitrary response r = 37. Then compute commitment = g^r · publicKey^(−e) mod p. This satisfies the verification equation by construction.',
      observation: 'The forged transcript satisfies g^response = commitment · publicKey^challenge. The verifier will accept.',
      adversaryNarration: 'I worked backward: chose r, derived the commitment. In an honest protocol, the commitment must come first. Here, the order does not matter.',
    },
    {
      id: 'verify-forgery',
      instruction: 'Examine the forged proof. The verifier checks the equation — and it passes. You never needed the secret key.',
      observation: 'Forgery accepted. The verifier cannot distinguish this from an honest proof.',
      adversaryNarration: 'Attack complete. I proved knowledge of a secret I do not have. The verifier is fooled because the transcript hash was incomplete.',
    },
  ],
  conclusion: {
    succeeded: true,
    explanation: 'The Frozen Heart vulnerability occurs when a Fiat-Shamir implementation omits prior transcript messages from the challenge hash. This lets the prover predict the challenge and work backward to forge a valid proof without knowing the witness.',
    securityGuarantee: 'Fix: include ALL prior transcript messages in the hash. With correct Fiat-Shamir, the challenge depends on the commitment, making backward computation infeasible.',
    realWorldExample: 'Trail of Bits discovered this vulnerability class in 2022, affecting multiple ZK libraries including Plonky2 and Bulletproofs implementations.',
    furtherReading: 'Trail of Bits: "Frozen Heart" (2022)',
  },
};
