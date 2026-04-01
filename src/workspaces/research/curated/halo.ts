import type { Walkthrough } from '../types';

export const haloWalkthrough: Walkthrough = {
  id: 'halo-2019',
  paper: {
    title: 'Recursive Proof Composition without a Trusted Setup',
    authors: 'Sean Bowe, Jack Grigg, Daira Hopwood',
    year: 2019,
    eprintId: '2019/1021',
    eprintUrl: 'https://eprint.iacr.org/2019/1021',
    abstractSummary:
      'Halo introduces a technique for recursive proof composition that avoids trusted setup ceremonies. It uses a cycle of elliptic curves (Pasta) and an accumulation scheme to defer expensive verification steps across recursive layers.',
  },
  sections: [
    {
      id: 'why-recursive',
      title: 'Why Recursive Proofs Matter',
      summary:
        'Recursive proof composition allows a proof to verify another proof inside itself. This enables incrementally verifiable computation (IVC), where a long computation can be proven correct step-by-step without the verifier needing to re-check everything from the start. Halo achieves this without the toxic waste of a trusted setup.',
      keyInsight:
        'Recursion turns a linear verification cost into a constant one — each step only verifies the previous step, not the entire history.',
    },
    {
      id: 'pasta-curves',
      sectionRef: 'Section 5',
      title: 'The Pasta Curve Cycle',
      summary:
        'Halo uses a pair of elliptic curves — Pallas and Vesta — whose scalar fields are each other\'s base fields. This "cycle" allows a proof created on one curve to be efficiently verified inside a circuit on the other curve, enabling recursion without expensive non-native field arithmetic.',
      keyInsight:
        'Each depth level alternates between Pallas and Vesta, making field operations native at every recursion layer.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 4, showPasta: true, showProofSize: true },
        caption: 'Each depth level alternates between Pallas and Vesta curves',
        interactionHints: [
          'Toggle depth to see the alternating pattern hold',
          'Run verification to watch bottom-up proof checking',
        ],
      },
    },
    {
      id: 'inner-product',
      sectionRef: 'Section 3',
      title: 'Inner Product Arguments',
      summary:
        'Instead of pairing-based commitments like KZG, Halo uses an inner product argument (IPA) for polynomial commitments. IPA proofs are logarithmic in size and do not require a trusted setup. The commitment is a Pedersen vector commitment, and the opening proof recursively halves the witness vector.',
      keyInsight:
        'IPA replaces KZG pairings with inner product reductions — no toxic waste, logarithmic proof size.',
      demo: {
        demoId: 'polynomial',
        state: { mode: 'coefficients', coefficients: [5, 1, 1], kzg: { currentStep: 1 } },
        caption: 'KZG is shown here as a reference — IPA replaces the pairing step with inner product reductions',
        interactionHints: [
          'Step through commit → challenge → open → verify',
          'Notice the trusted setup step that IPA avoids',
        ],
      },
    },
    {
      id: 'accumulation',
      sectionRef: 'Section 4',
      title: 'Accumulation Instead of Full Verification',
      summary:
        'The key insight of Halo is that the expensive part of IPA verification (the multi-scalar multiplication) can be deferred. Instead of fully verifying at each recursive step, proofs are "accumulated" — the expensive check is carried forward and only performed once at the end. This makes each recursive step cheap.',
      keyInsight:
        'Accumulation lets each recursive step pay only a constant cost, deferring the expensive MSM to the final verifier.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'ivc', ivcLength: 8, showPasta: true, showProofSize: true },
        caption: 'Each IVC step accumulates rather than fully verifying',
        interactionHints: [
          'Watch the proof size stay constant across folds',
          'Each step carries the accumulated verification work forward',
        ],
      },
    },
    {
      id: 'fiat-shamir',
      sectionRef: 'Section 2',
      title: 'Fiat-Shamir for Non-Interactivity',
      summary:
        'Halo transforms the interactive IPA protocol into a non-interactive one using the Fiat-Shamir heuristic. The prover computes challenges by hashing the transcript of all prior messages. A correct implementation must include every prior message in the hash — omitting any creates a "Frozen Heart" vulnerability.',
      keyInsight:
        'The transcript must include every prior message; omitting any allows the prover to cheat.',
      demo: {
        demoId: 'fiat-shamir',
        state: { mode: 'fs-correct', secret: 9, nonce: 12 },
        caption: 'The Fiat-Shamir transcript includes every prior message',
        interactionHints: [
          'Switch to broken mode to see the Frozen Heart vulnerability',
          'Compare how the challenge derivation changes',
        ],
      },
    },
    {
      id: 'no-trusted-setup',
      title: 'Why No Trusted Setup',
      summary:
        'KZG polynomial commitments require a structured reference string generated by a trusted setup ceremony. If the secret randomness ("toxic waste") from the ceremony is not properly destroyed, it can be used to forge proofs. Halo\'s IPA-based approach avoids this entirely — the commitment scheme is transparent.',
      keyInsight:
        'IPA avoids the toxic waste problem of KZG trusted setup entirely.',
      demo: {
        demoId: 'groth16',
        state: { x: 7, phase: 'setup', showToxic: true },
        caption: 'Groth16\'s trusted setup generates toxic waste — Halo eliminates this requirement',
        interactionHints: [
          'Toggle "Show toxic waste" to see the secret parameters',
          'These are exactly what Halo avoids needing',
        ],
      },
    },
  ],
  generatedBy: 'curated',
};
