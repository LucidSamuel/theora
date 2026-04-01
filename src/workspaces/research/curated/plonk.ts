import type { Walkthrough } from '../types';

export const plonkWalkthrough: Walkthrough = {
  id: 'plonk-2019',
  paper: {
    title: 'Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge',
    authors: 'Ariel Gabizon, Zachary J. Williamson, Oana Ciobotaru',
    year: 2019,
    eprintId: '2019/953',
    eprintUrl: 'https://eprint.iacr.org/2019/953',
    abstractSummary:
      'PLONK introduces a universal and updateable SNARK with a single structured reference string that works for any circuit up to a given size. It uses gate equations with selector polynomials and copy constraints via permutation arguments.',
  },
  sections: [
    {
      id: 'gate-equations',
      sectionRef: 'Section 5',
      title: 'Gate Equations',
      summary:
        'PLONK represents computation through gate equations of the form qL·a + qR·b + qO·c + qM·a·b + qC = 0. The selector polynomials (qL, qR, qO, qM, qC) configure each gate as addition, multiplication, or a custom operation. This generalizes R1CS by supporting both linear and multiplicative constraints in a single framework.',
      keyInsight:
        'Selector polynomials make gates programmable — the same equation handles addition, multiplication, and custom gates.',
      demo: {
        demoId: 'plonk',
        state: {},
        caption: 'Each gate satisfies qL·a + qR·b + qO·c + qM·a·b + qC = 0 with different selectors',
        interactionHints: [
          'Select different gates to see how the selectors configure each operation',
          'Check the equation display for each gate type',
        ],
      },
    },
    {
      id: 'copy-constraints',
      sectionRef: 'Section 6',
      title: 'Copy Constraints',
      summary:
        'Wires between gates are enforced by copy constraints, which ensure that the output of one gate equals the input of another. PLONK implements these via a grand product permutation argument: the prover shows that the multiset of (wire value, position) pairs is invariant under a specific permutation. This avoids the need for explicit equality checks.',
      keyInsight:
        'Wires between gates are enforced by permutation arguments, not explicit equality constraints.',
      demo: {
        demoId: 'plonk',
        state: {},
        caption: 'Copy constraints connect gates — dashed arrows show wire equality enforcement',
        interactionHints: [
          'Click "Break a copy constraint" to see what happens when wire equality fails',
          'Notice how breaking one constraint can cascade to affect others',
        ],
      },
    },
    {
      id: 'r1cs-to-plonk',
      title: 'From R1CS to PLONK',
      summary:
        'R1CS expresses each constraint as A·B = C (three sparse vectors per constraint). PLONK subsumes this: a multiplication gate uses qM=1, qO=−1, and zeros for qL, qR, qC. An addition gate uses qL=1, qR=1, qO=−1. This flexibility lets PLONK handle both in a uniform framework, and custom gates can be defined for repeated patterns.',
      keyInsight:
        'PLONK\'s gate equations generalize R1CS — every R1CS constraint maps to a PLONK gate, but PLONK can also express linear constraints directly.',
      demo: {
        demoId: 'circuit',
        state: { x: 7, broken: false, viewMode: 'r1cs' },
        caption: 'The same circuit as R1CS — PLONK generalizes this with programmable selectors',
        interactionHints: [
          'Compare the R1CS view with the PLONK gate equation structure',
          'Switch to Bootle16 view to see the linear/multiplicative separation',
        ],
      },
    },
  ],
  generatedBy: 'curated',
};
