import type { AttackScenario } from './types';

export const MLE_FORGERY: AttackScenario = {
  id: 'mle-forgery',
  demoId: 'mle',
  title: 'Forge an MLE Evaluation',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Claim a false value for f\u0303(r) at a random evaluation point r and see if a verifier who knows the true function can detect the lie.',
    adversarySees: [
      'The function f defined on the Boolean hypercube {0,1}^n',
      'The evaluation point r chosen by the verifier',
      'The eq-basis weight eq(v, r) for each vertex v',
    ],
    adversaryControls: [
      'The claimed evaluation value f\u0303(r)',
    ],
    adversaryCannotDo: [
      'Change the function values on the hypercube after committing',
      'Choose or predict the evaluation point r',
      'Modify the eq-basis formula',
    ],
  },
  steps: [
    {
      id: 'observe-mle',
      instruction: 'Examine the MLE with 2 variables. The function is defined by 4 values on {0,1}\u00b2.',
      observation: 'The MLE f\u0303 is uniquely determined by its 4 hypercube values. Any evaluation at a non-Boolean point is a specific weighted sum of these values.',
      adversaryNarration: 'I see the function values and the formula. If the verifier asks me for f\u0303(r), I must return the correct weighted sum. Can I lie?',
      demoAction: { type: 'SET_VARIABLES', payload: 2 },
    },
    {
      id: 'evaluate-honest',
      instruction: 'Evaluate the MLE at a non-Boolean point, say r = (2, 3). The result is f\u0303(2,3) computed via the eq-basis formula.',
      observation: 'Each vertex v contributes f(v)\u00b7eq(v, r) to the sum. The weights are determined entirely by r and the eq formula \u2014 no freedom for the prover.',
      adversaryNarration: 'The evaluation is deterministic. For this r, the correct answer is fixed. If I claim a different value, the verifier can recompute and catch me.',
      demoAction: { type: 'LOAD_ATTACK_EVALUATION', payload: { point: [2, 3] } },
    },
    {
      id: 'attempt-lie',
      instruction: 'Imagine claiming f\u0303(2,3) = 42 when the true value is different. The verifier recomputes using the known function values and the eq-basis formula.',
      observation: 'The verifier computes f\u0303(2,3) = \u03a3 f(v)\u00b7eq(v, (2,3)) independently. Since the function values are public, the verifier gets the true answer and rejects the false claim.',
      adversaryNarration: 'I cannot lie about a single evaluation when the verifier knows the function. The eq-basis formula is deterministic and publicly verifiable.',
      demoAction: { type: 'LOAD_ATTACK_EVALUATION', payload: { point: [2, 3], claimedValue: 42 } },
    },
    {
      id: 'why-this-matters',
      instruction: 'In proof systems, the verifier does NOT know all 2^n values \u2014 that is why protocols like sumcheck are needed to verify evaluations efficiently.',
      observation: 'The MLE evaluation claim becomes meaningful in settings where the verifier cannot compute f\u0303(r) directly. Sumcheck and polynomial commitments bridge this gap.',
      adversaryNarration: 'The MLE itself is not a proof system \u2014 it is a building block. My attack fails here because the verifier has full information. In real protocols, the challenge is proving f\u0303(r) = v without revealing all of f.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'The multilinear extension is uniquely determined by the function values on the Boolean hypercube. Any evaluation f\u0303(r) is a deterministic weighted sum that the verifier can independently recompute. Lying about an evaluation is immediately detectable when the function is known. In real proof systems, protocols like sumcheck allow efficient verification even when the verifier cannot compute f\u0303(r) directly.',
    securityGuarantee: 'MLE uniqueness: for any function f: {0,1}^n \u2192 F, there is exactly one multilinear polynomial f\u0303 extending f. Any claimed evaluation can be verified in O(2^n) time, or in O(n) rounds via the sumcheck protocol.',
  },
};
