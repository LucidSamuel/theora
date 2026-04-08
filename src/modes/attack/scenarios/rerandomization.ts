import type { AttackScenario } from './types';

export const RERAND_LINKABILITY: AttackScenario = {
  id: 'rerand-linkability',
  demoId: 'rerandomization',
  title: 'Link a Rerandomized Proof to Its Original',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Given an original proof and a rerandomized version, determine whether they attest to the same statement by examining the byte-level content.',
    adversarySees: [
      'The original proof bytes',
      'A rerandomized proof (unknown whether it came from the original)',
      'The statement hash for both proofs',
    ],
    adversaryControls: [
      'Statistical analysis tools on the proof bytes',
    ],
    adversaryCannotDo: [
      'Access the randomness used for rerandomization',
      'Observe the rerandomization process itself',
      'Modify either proof',
    ],
  },
  steps: [
    {
      id: 'compare-bytes',
      instruction: 'Compare the original and rerandomized proofs byte-by-byte. Count how many bytes differ.',
      observation: 'Nearly every byte has changed. The commitment, evaluation, and IPA components are all different. Only the proof length remains the same.',
      adversaryNarration: 'The byte-level content is completely different. I cannot find any shared subsequence or pattern between the two proofs.',
      demoAction: { type: 'RERANDOMIZE', payload: { statementIndex: 0, nonce: 2, gameSeed: 5 } },
    },
    {
      id: 'check-statement',
      instruction: 'Compare the statement hashes. Both proofs verify the same statement — the hash is identical.',
      observation: 'The statement hash matches, confirming both proofs attest to the same claim. But this only tells me the statement, not whether one proof was derived from the other.',
      adversaryNarration: 'The statement match is expected — many proofs could verify the same statement independently. I need byte-level evidence of derivation, and there is none.',
    },
    {
      id: 'statistical-analysis',
      instruction: 'Run statistical tests: byte frequency distribution, positional correlation, XOR patterns between the two proofs.',
      observation: 'All statistical tests show the rerandomized proof is indistinguishable from a fresh proof generated independently. The rerandomization blinding is information-theoretically hiding.',
      adversaryNarration: 'No correlation found. The rerandomized proof has the same statistical distribution as a completely independent proof. I cannot distinguish rerandomization from independent generation.',
    },
    {
      id: 'conclusion-step',
      instruction: 'Rerandomization provides computational unlinkability: no efficient algorithm can determine if two proofs sharing a statement are related by rerandomization.',
      observation: 'The fresh randomness injected during rerandomization completely masks the algebraic relationship between the original and rerandomized proofs.',
      adversaryNarration: 'I have failed. Without observing the rerandomization process or knowing the randomness, the two proofs are unlinkable. This is exactly the privacy property Zcash needs.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Proof rerandomization injects fresh randomness into every component of the proof (commitments, evaluations, IPA), producing a new proof that is computationally indistinguishable from an independently generated proof for the same statement. No efficient adversary can link a rerandomized proof to its original without knowledge of the rerandomization randomness.',
    securityGuarantee: 'Rerandomization unlinkability: under the decisional Diffie-Hellman assumption on the proof system\'s group, rerandomized proofs are computationally indistinguishable from fresh proofs for the same statement.',
  },
};
