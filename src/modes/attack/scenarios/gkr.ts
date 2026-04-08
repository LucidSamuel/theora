import type { AttackScenario } from './types';

export const GKR_FALSE_OUTPUT: AttackScenario = {
  id: 'gkr-false-output',
  demoId: 'gkr',
  title: 'Claim a False Circuit Output',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Claim a wrong output value for the circuit and try to pass all GKR layer reductions without being caught.',
    adversarySees: [
      'The full layered circuit structure (gates and wiring)',
      'The input values x[0]..x[3]',
      'The honest output value',
    ],
    adversaryControls: [
      'The claimed output value V(r) sent to the verifier',
    ],
    adversaryCannotDo: [
      'Choose the random evaluation points r used by the verifier',
      'Modify the circuit structure or gate types',
      'Change the input values after the protocol starts',
    ],
  },
  steps: [
    {
      id: 'observe-circuit',
      instruction: 'Examine the 3-layer circuit: inputs \u2192 ADD/MUL gates \u2192 final ADD gate \u2192 output. The honest output for default inputs is computed automatically.',
      observation: 'The circuit computes add(x[0],x[1]) at layer 1, mul(x[2],x[3]) at layer 1, then add(results) at layer 2. The output is deterministic given the inputs.',
      adversaryNarration: 'I see the circuit and the correct output. If I claim a different output, the GKR reduction should eventually expose the lie at some layer.',
      demoAction: { type: 'RESET', payload: undefined },
    },
    {
      id: 'run-honest',
      instruction: 'Run the honest proof first. Step through all layers and observe that every reduction passes, ending with a successful oracle check.',
      observation: 'Output claim matches. Layer 2 reduction passes. Layer 1 reduction passes. Oracle check at input layer confirms the claim.',
      adversaryNarration: 'The honest proof works perfectly. Each layer\'s sumcheck reduces the claim consistently. Now let me try lying about the output.',
      demoAction: { type: 'RUN_ALL', payload: undefined },
    },
    {
      id: 'understand-reduction',
      instruction: 'Now forge the top claim by adding 1 to the claimed output value. The verifier immediately compares the claimed output-layer MLE evaluation against the real circuit output and rejects.',
      observation: 'The forged output claim cannot survive the first consistency check. GKR does not let the prover choose a fake top-layer value and continue: the claim must already match the output-layer multilinear extension before the reductions can proceed.',
      adversaryNarration: 'I changed the claimed output, but the verifier can recompute V_out(r) from the circuit output layer. My forged claim fails before I even get to hide it inside later reductions.',
      demoAction: { type: 'LOAD_FORGED_OUTPUT_CLAIM', payload: 1 },
    },
    {
      id: 'soundness',
      instruction: 'GKR soundness comes from composing sumcheck soundness across layers. Each layer adds at most d/|F| error, and the oracle check at the input layer is exact.',
      observation: 'Over GF(101) with 2 layers and degree-2 gates, the total soundness error is at most 2\u00b72/101 \u2248 4%. Over real fields (|F| \u2248 2^255), this is negligible.',
      adversaryNarration: 'I cannot forge a GKR proof. The layer-by-layer reduction with random challenges makes every false claim detectable. The oracle check is the final wall \u2014 the verifier knows the inputs and checks directly.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'A false output claim creates an inconsistency that propagates through the GKR layer reductions. Each sumcheck catches the error with high probability via random challenges, and the final oracle check at the input layer is exact. The prover cannot forge a valid GKR proof for a wrong output.',
    securityGuarantee: 'GKR soundness: for a depth-d circuit over F with max gate degree \u03b4, a cheating prover passes with probability \u2264 d\u00b7\u03b4/|F|. Over GF(101) with d=2, \u03b4=2: error \u2264 4/101 \u2248 4%.',
  },
};
