import type { Walkthrough } from '../types';

export const bulletproofsWalkthrough: Walkthrough = {
  id: 'bulletproofs-2018',
  paper: {
    title: 'Bulletproofs: Short Proofs for Confidential Transactions and More',
    authors: 'Benedikt Bünz, Jonathan Bootle, Dan Boneh, Andrew Poelstra, Pieter Wuille, Greg Maxwell',
    year: 2018,
    eprintId: '2017/1066',
    eprintUrl: 'https://eprint.iacr.org/2017/1066',
    abstractSummary:
      'Bulletproofs are short non-interactive zero-knowledge proofs that require no trusted setup. They are especially efficient for range proofs (proving a committed value lies in an interval) and are used in Monero and other confidential transaction systems.',
  },
  sections: [
    {
      id: 'pedersen-commitments',
      sectionRef: 'Section 2',
      title: 'Pedersen Commitments',
      summary:
        'Bulletproofs build on Pedersen commitments: C = g^v · h^r mod p, where v is the value and r is the blinding factor. The commitment is computationally binding (you can\'t change the committed value) and perfectly hiding (the commitment reveals nothing about v). The blinding factor r provides information-theoretic privacy.',
      keyInsight:
        'C = g^v · h^r — computationally binding, perfectly hiding.',
      demo: {
        demoId: 'pedersen',
        state: { mode: 'single', value: 42, randomness: 17 },
        caption: 'A single Pedersen commitment with explicit value and blinding factor',
        interactionHints: [
          'Change the value and notice the commitment changes',
          'Toggle the blinding factor visibility to see r\'s role',
        ],
      },
    },
    {
      id: 'homomorphic-addition',
      sectionRef: 'Section 2.1',
      title: 'Homomorphic Addition',
      summary:
        'Pedersen commitments are additively homomorphic: C₁ · C₂ = commit(v₁+v₂, r₁+r₂). This means you can add committed values without opening them. In confidential transactions, this property lets you verify that inputs equal outputs (conservation of value) without revealing the amounts.',
      keyInsight:
        'C₁ · C₂ = commit(v₁+v₂, r₁+r₂) without revealing the individual values.',
      demo: {
        demoId: 'pedersen',
        state: { mode: 'homomorphic' },
        caption: 'Two commitments merge homomorphically — the result equals a direct commitment to the sum',
        interactionHints: [
          'Adjust values in both commitment columns',
          'Verify that C₁·C₂ matches commit(v₁+v₂, r₁+r₂)',
        ],
      },
    },
    {
      id: 'inner-product-proof',
      sectionRef: 'Section 3',
      title: 'Inner Product Proof',
      summary:
        'The core of Bulletproofs is an efficient inner product argument that proves knowledge of two vectors whose inner product equals a claimed value. The proof is logarithmic in the vector length — each round halves the vector size. This is used to build polynomial commitments and range proofs without trusted setup.',
      keyInsight:
        'The IPA protocol reduces proof size logarithmically — each round halves the problem.',
      demo: {
        demoId: 'polynomial',
        state: { mode: 'coefficients', coefficients: [5, 1, 1], kzg: { currentStep: 1 } },
        caption: 'KZG is shown as a reference — Bulletproofs use IPA instead of pairings',
        interactionHints: [
          'Step through the KZG flow',
          'The IPA version replaces the pairing verification with inner product reductions',
        ],
      },
    },
    {
      id: 'range-proofs',
      title: 'Range Proofs',
      summary:
        'A range proof demonstrates that a committed value v lies in [0, 2^n) without revealing v. Bulletproofs achieve this with a proof of size only 2·log₂(n) group elements plus a few scalars. For n=64 (enough for monetary amounts), this is dramatically smaller than previous range proof constructions.',
      keyInsight:
        'Proving v ∈ [0, 2^64) takes only ~13 group elements — small enough for blockchain transactions.',
    },
  ],
  generatedBy: 'curated',
};
