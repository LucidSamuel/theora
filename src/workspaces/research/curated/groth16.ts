import type { Walkthrough } from '../types';

export const groth16Walkthrough: Walkthrough = {
  id: 'groth16-2016',
  paper: {
    title: 'On the Size of Pairing-Based Non-interactive Arguments',
    authors: 'Jens Groth',
    year: 2016,
    eprintId: '2016/260',
    eprintUrl: 'https://eprint.iacr.org/2016/260',
    abstractSummary:
      'Groth16 achieves the smallest known proof size for pairing-based SNARKs: just 3 group elements. The paper introduces an efficient SNARK construction from QAP (Quadratic Arithmetic Programs) with a single trusted setup ceremony.',
  },
  sections: [
    {
      id: 'r1cs-formulation',
      sectionRef: 'Section 2',
      title: 'The R1CS Formulation',
      summary:
        'Every computation is first compiled into a Rank-1 Constraint System (R1CS). Each constraint has the form A·s ⊙ B·s = C·s, where s is the witness vector and A, B, C are sparse matrices. The witness includes public inputs, private inputs, and intermediate wire values.',
      keyInsight:
        'Every computation compiles to A·B = C constraints over a finite field.',
      demo: {
        demoId: 'circuit',
        state: { x: 7, broken: false, viewMode: 'r1cs' },
        caption: 'R1CS constrains f(x) = x² + x + 5 with two rows: multiplication and output relation',
        interactionHints: [
          'Adjust x to see how the witness changes',
          'Toggle broken mode to remove the output constraint',
        ],
      },
    },
    {
      id: 'qap-conversion',
      sectionRef: 'Section 3',
      title: 'QAP: From Constraints to Polynomials',
      summary:
        'The R1CS matrices are converted into polynomials via Lagrange interpolation over an evaluation domain. This produces a Quadratic Arithmetic Program (QAP) where constraint satisfaction is equivalent to a polynomial divisibility check: t(x) divides h(x)·z(x), where z(x) is the vanishing polynomial.',
      keyInsight:
        'R1CS matrices become polynomials — constraint satisfaction reduces to polynomial divisibility.',
      demo: {
        demoId: 'groth16',
        state: { x: 7, phase: 'qap' },
        caption: 'The QAP phase converts R1CS matrices into A(x), B(x), C(x) polynomials',
        interactionHints: [
          'Step through the pipeline to reach the QAP phase',
          'Notice how the evaluation domain {1, 2} maps to the two R1CS rows',
        ],
      },
    },
    {
      id: 'trusted-setup',
      sectionRef: 'Section 4',
      title: 'The Trusted Setup Ceremony',
      summary:
        'Groth16 requires a circuit-specific trusted setup that generates a structured reference string (SRS) containing encrypted evaluations of the QAP polynomials at a secret point τ. The randomness α, β, γ, δ must be destroyed after the ceremony — if leaked, proofs can be forged for any statement.',
      keyInsight:
        'α, β, γ, δ are the toxic waste — if leaked, proofs can be forged.',
      demo: {
        demoId: 'groth16',
        state: { x: 7, showToxic: true, phase: 'setup' },
        caption: 'The setup phase generates toxic waste parameters',
        interactionHints: [
          'Toggle "Show toxic waste" to see the secret parameters',
          'These values must be destroyed — leaking them breaks soundness entirely',
        ],
      },
    },
    {
      id: 'proof-generation',
      sectionRef: 'Section 5',
      title: 'Proof Generation',
      summary:
        'The prover computes π = (A, B, C) using the QAP polynomial evaluations and the SRS. The proof is just 3 group elements (2 in G₁ and 1 in G₂), making Groth16 proofs extremely compact. The prover uses random blinding factors r and s for zero-knowledge.',
      keyInsight:
        'The entire proof is just 3 group elements — the smallest known for pairing-based SNARKs.',
      demo: {
        demoId: 'groth16',
        state: { x: 7, phase: 'prove' },
        caption: 'π = (A, B, C) computed from QAP evaluations at the secret point',
        interactionHints: [
          'Step to the prove phase to see the proof elements',
          'These 3 values are the entire proof',
        ],
      },
    },
    {
      id: 'pairing-verification',
      sectionRef: 'Section 6',
      title: 'Pairing-Based Verification',
      summary:
        'Verification checks the pairing equation e(A, B) = e(α, β) · e(pub, γ) · e(C, δ). This single equation simultaneously checks QAP satisfaction, correct use of the SRS, and the public input binding. Verification requires only a constant number of pairing operations.',
      keyInsight:
        'One pairing equation checks everything: QAP satisfaction, SRS binding, and public inputs.',
      demo: {
        demoId: 'groth16',
        state: { x: 7, phase: 'verify' },
        caption: 'e(A,B) = e(α,β) · e(pub,γ) · e(C,δ) — the complete verification equation',
        interactionHints: [
          'Corrupt a proof element to see the pairing mismatch',
          'Notice how the equation catches any modification',
        ],
      },
    },
  ],
  generatedBy: 'curated',
};
