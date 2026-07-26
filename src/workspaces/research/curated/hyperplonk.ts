import type { Walkthrough } from '../types';

const HYPERPLONK_GATE_DSL = `// HyperPlonk gate identity at one hypercube point:
//   q_m·(a·b) + q_l·a + q_r·b + q_o·c + q_c = 0
// Loaded as an addition gate: q_l = q_r = 1, q_o = 100 ≡ −1 (mod 101),
// so the identity reads a + b − c = 0.
input a
input b
input c
input q_m
input q_l
input q_r
input q_o
input q_c

wire ab = a * b
wire t1 = q_m * ab
wire t2 = q_l * a
wire t3 = q_r * b
wire t4 = q_o * c
wire s1 = t1 + t2
wire s2 = s1 + t3
wire s3 = s2 + t4
wire g = s3 + q_c
assert g == 0`;

export const hyperplonkWalkthrough: Walkthrough = {
  id: 'hyperplonk-2022',
  paper: {
    title: 'HyperPlonk: Plonk with Linear-Time Prover and High-Degree Custom Gates',
    authors: 'Binyi Chen, Benedikt Bünz, Dan Boneh, Zhenfei Zhang',
    year: 2022,
    eprintId: '2022/1355',
    eprintUrl: 'https://eprint.iacr.org/2022/1355',
    abstractSummary:
      'HyperPlonk re-plants PLONK from a univariate evaluation domain onto the boolean hypercube: witness columns become multilinear polynomials, the FFT disappears from the prover entirely, and the gate identity is enforced by sumcheck-based ZeroChecks instead of quotient polynomials. The move buys a linear-time prover and makes high-degree custom gates cheap, at the price of multilinear commitment schemes. This walkthrough rebuilds each substitution on demos small enough to check by hand.',
  },
  sections: [
    {
      id: 'fft-bottleneck',
      title: 'Why the FFT Is the Prover Bottleneck',
      summary:
        'A univariate PLONK prover spends most of its time in FFTs: interpolating witness columns over an evaluation domain, computing the quotient polynomial, moving between coefficient and evaluation form — all O(n log n) with painful memory traffic at production sizes. Watch the butterfly network below: every layer touches every value. HyperPlonk\'s opening move is to delete this entire machine — no evaluation domain, no interpolation, no quotients — by changing where the polynomials live.',
      keyInsight:
        'The log factor in O(n log n) is not asymptotics pedantry — the FFT\'s data movement is the practical wall HyperPlonk removes.',
      citations: ['hyperplonk'],
      demo: {
        demoId: 'polynomial',
        state: {
          mode: 'ntt',
          coefficients: [3, 1, 4, 1],
          ntt: { coefficients: [3, 1, 4, 1, 5, 9, 2, 6], n: 8, direction: 'forward', activeLayer: 2 },
        },
        caption: 'The NTT butterfly network — the O(n log n) machine HyperPlonk deletes',
        interactionHints: [
          'Step through all log n layers and count the total work',
          'Every layer touches all n values — this is the traffic that vanishes',
        ],
      },
    },
    {
      id: 'boolean-hypercube',
      title: 'From Evaluation Domains to the Boolean Hypercube',
      summary:
        'Univariate PLONK indexes its n gate rows by roots of unity ω⁰…ωⁿ⁻¹. HyperPlonk indexes them by the corners of the boolean hypercube {0,1}^μ with n = 2^μ: row 5 becomes the point (1,0,1). The witness column is then a function on the hypercube, and the natural polynomial extension of such a function is *multilinear* — degree at most 1 in each variable. Explore the hypercube below: every corner is one gate row, and evaluating anywhere else is interpolation.',
      keyInsight:
        'Same table, different address space: rows indexed by bits instead of roots of unity — and bit-indexing has no FFT tax.',
      citations: ['hyperplonk'],
      demo: {
        demoId: 'mle',
        state: { numVars: 3, fieldSize: '97', values: ['1', '2', '3', '4', '5', '6', '7', '8'], evalPoint: ['0', '0', '0'], fixedVars: ['0'], phase: 'setup' },
        caption: 'The boolean hypercube {0,1}³: eight corners, eight gate rows',
        interactionHints: [
          'Hover the corners to read the witness value stored at each row',
          'Note how 3 bits address 8 rows — μ variables for 2^μ gates',
        ],
      },
    },
    {
      id: 'multilinear-extensions',
      title: 'Multilinear Extensions: One Polynomial per Column',
      summary:
        'The multilinear extension (MLE) is the unique degree-≤1-per-variable polynomial agreeing with a column on every hypercube corner — the multivariate analogue of Lagrange interpolation, but computable in linear time via the eq(x, b) basis. Committing to a column means committing to its MLE; opening at a random point r ∈ F^μ is what the verifier buys instead of a univariate evaluation. Move the evaluation point off the corners below and watch the MLE interpolate between rows.',
      keyInsight:
        'MLE is interpolation without an FFT: linear-time to evaluate, unique by construction, and the object every hypercube argument commits to.',
      citations: ['hyperplonk'],
      demo: {
        demoId: 'mle',
        state: { numVars: 2, fieldSize: '97', values: ['3', '7', '2', '9'], evalPoint: ['5', '8'], fixedVars: ['0'], phase: 'evaluating' },
        caption: 'Evaluating the MLE at a random point: a weighted blend of all corner values',
        interactionHints: [
          'Drag the evaluation point and watch the eq-basis weights shift',
          'Set the point to a corner to recover the raw table value exactly',
        ],
      },
    },
    {
      id: 'sumcheck-engine',
      title: 'Sumcheck: The Engine That Replaces Quotients',
      summary:
        'Univariate PLONK proves "the gate identity holds on every row" by exhibiting a quotient by the vanishing polynomial — an FFT-heavy object. HyperPlonk instead proves the identity\'s sum over the hypercube is zero using the classic sumcheck protocol: μ rounds, one univariate polynomial per round, one random challenge per round, one final MLE opening. Prover work is linear; verifier work is logarithmic. Run the protocol below and check each round\'s claim g_i(0) + g_i(1) = claim_{i−1} by hand.',
      keyInsight:
        'Sumcheck converts "true everywhere on the cube" into μ tiny univariate claims — no quotient polynomial ever exists.',
      citations: ['sumcheck-1992', 'hyperplonk'],
      demo: {
        demoId: 'sumcheck',
        state: { numVars: 3, values: ['1', '2', '3', '4', '5', '6', '7', '8'], cheatMode: false, currentRound: 4, phase: 'complete', verdict: 'honest' },
        caption: 'A complete honest sumcheck: three rounds, then one oracle query',
        interactionHints: [
          'Verify each round: g(0) + g(1) must equal the previous claim',
          'The final check is a single MLE evaluation at the accumulated challenge point',
        ],
      },
    },
    {
      id: 'gate-identity-editor',
      title: 'The Gate Identity, Live in the Constraint Editor',
      summary:
        'HyperPlonk\'s ZeroCheck enforces the PLONK gate identity q_m·ab + q_l·a + q_r·b + q_o·c + q_c = 0 at every hypercube point. Below is that identity at a single point, over GF(101). It is configured as an addition gate: q_l = q_r = 1, q_o = 100 (that is −1 mod 101), q_m = q_c = 0, with witness a = 5, b = 7, c = 12 — so the identity reads 5 + 7 − 12 = 0. Reconfigure the selectors into a multiplication gate (q_m = 1, q_l = q_r = 0) and repair c to 35. The ZeroCheck is nothing more than sumcheck applied to this expression times a random eq polynomial.',
      keyInsight:
        'One gate row is one small identity; ZeroCheck is that identity swept over the cube by sumcheck instead of divided by a vanishing polynomial.',
      citations: ['hyperplonk'],
      demo: {
        demoId: 'constraint-editor',
        state: {
          v: 1,
          source: HYPERPLONK_GATE_DSL,
          field: '101',
          inputs: { a: '5', b: '7', c: '12', q_m: '0', q_l: '1', q_r: '1', q_o: '100', q_c: '0' },
        },
        caption: 'The PLONK gate identity as an addition gate: a + b − c = 0 with −1 written as 100',
        interactionHints: [
          'Turn it into a multiplication gate: q_m = 1, q_l = q_r = 0, then fix c = 35',
          'Break the witness (c = 13) and find the failing constraint in the list',
          'Note q_o = 100: negative selectors live as p − 1 in the field',
        ],
      },
    },
    {
      id: 'permutation-hypercube',
      title: 'Copy Constraints on the Hypercube',
      summary:
        'PLONK\'s permutation argument survives the move to the hypercube, but its grand product — a running product over all rows — becomes a multiset equality proven by a dedicated ProductCheck built, again, from sumcheck. HyperPlonk arranges the product tree as one extra multilinear polynomial and reduces the check to two openings. The univariate permutation view below shows what is being re-proven: cells wired together by the copy permutation must carry equal values, enforced by a randomized product.',
      keyInsight:
        'The permutation argument ports wholesale: the grand product just trades its univariate accumulator for a sumcheck-friendly product tree.',
      citations: ['plonk-2019', 'hyperplonk'],
      demo: {
        demoId: 'plonk',
        state: { tab: 'permutation', beta: 2, gamma: 3 },
        caption: 'Copy constraints via randomized grand product — the relation ProductCheck re-proves',
        interactionHints: [
          'Trace one permutation cycle and check its contribution to the product',
          'Re-randomize β, γ and confirm the product still balances',
        ],
      },
    },
    {
      id: 'cheating-prover',
      title: 'Catching a Cheating Sumcheck Prover',
      summary:
        'Sumcheck\'s soundness is the reason ZeroCheck is safe: a prover claiming a false sum must, in some round, send a univariate polynomial that disagrees with the true one — and two distinct low-degree polynomials agree at few points, so a random challenge catches the lie with overwhelming probability, and the deception cascades to the final oracle check. Enable cheat mode below: the prover fudges one round polynomial and the protocol pinpoints the round where the fraud dies.',
      keyInsight:
        'Each round pins the prover to a low-degree polynomial; Schwartz-Zippel does the rest — lies survive a round with probability d/|F|.',
      citations: ['sumcheck-1992'],
      demo: {
        demoId: 'sumcheck',
        state: { numVars: 3, values: ['1', '2', '3', '4', '5', '6', '7', '8'], cheatMode: true, currentRound: 4, phase: 'complete', verdict: 'cheating_caught' },
        caption: 'Cheat mode: a fudged round polynomial fails against the honest oracle',
        interactionHints: [
          'Find the round where the cheat is injected and where it is caught',
          'Re-run honestly to contrast the verdicts',
        ],
      },
    },
    {
      id: 'batch-openings',
      title: 'Batch Openings and Multilinear PCS',
      summary:
        'A HyperPlonk proof ends with many MLE openings: witness columns, selector columns, permutation polynomials, each at points produced by the various sumchecks. Opening each separately would dominate proof size, so HyperPlonk batches: random linear combinations collapse many claims into one commitment opening. The batch demo below shows the univariate version of the same trick — one γ-combined opening standing in for many — which is exactly how the multilinear PCS (KZG-style multilinear, or Brakedown/Orion hash-based) is invoked once instead of a dozen times.',
      keyInsight:
        'Sumcheck multiplies opening claims; random batching collapses them back to one — the PCS is called once, not per column.',
      citations: ['hyperplonk'],
      demo: {
        demoId: 'polynomial',
        state: {
          mode: 'batch',
          coefficients: [3, 1, 4],
          batch: { polynomials: [[3, 1, 4], [2, 7, 1], [5, 0, 2]], evalPoint: 5, gamma: 7, fieldSize: 97, computed: true, activeStep: 3 },
        },
        caption: 'Three polynomials, one γ-batched opening — the cost model behind multilinear batching',
        interactionHints: [
          'Step through the batching: γ-powers weight each polynomial into one claim',
          'Change γ and watch the combined polynomial re-randomize while the check still passes',
        ],
      },
    },
    {
      id: 'lineage',
      title: 'Where HyperPlonk Sits: The Multilinear Turn',
      summary:
        'HyperPlonk is part of a broader multilinear turn: Spartan proved R1CS with sumcheck and MLEs; HyperPlonk brought the approach to PLONKish tables with custom gates up to degree ~32 essentially free of quotient blowup; HyperNova folds CCS claims with the same machinery; and modern zkVM stacks (Jolt, Lasso-style lookups) are sumcheck-first designs. The through-line is economic: sumcheck costs the prover a linear pass while a random challenge costs the verifier almost nothing — the cube, not the coset, is where cheap proving lives.',
      keyInsight:
        'The field moved its polynomials: from univariate cosets and quotients to the hypercube and sumcheck — HyperPlonk is PLONK saying so out loud.',
      citations: ['spartan-2019', 'hypernova-2023', 'hyperplonk'],
    },
  ],
  references: [
    {
      id: 'hyperplonk',
      authors: 'Binyi Chen, Benedikt Bünz, Dan Boneh, Zhenfei Zhang',
      title: 'HyperPlonk: Plonk with Linear-Time Prover and High-Degree Custom Gates',
      year: 2022,
      url: 'https://eprint.iacr.org/2022/1355',
      note: 'The paper this walkthrough follows.',
    },
    {
      id: 'plonk-2019',
      authors: 'Ariel Gabizon, Zachary J. Williamson, Oana Ciobotaru',
      title: 'PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge',
      year: 2019,
      url: 'https://eprint.iacr.org/2019/953',
      note: 'The univariate original: gate identity plus permutation argument.',
    },
    {
      id: 'sumcheck-1992',
      authors: 'Carsten Lund, Lance Fortnow, Howard Karloff, Noam Nisan',
      title: 'Algebraic Methods for Interactive Proof Systems',
      year: 1992,
      url: 'https://dl.acm.org/doi/10.1145/146585.146605',
      note: 'The sumcheck protocol powering ZeroCheck and ProductCheck.',
    },
    {
      id: 'spartan-2019',
      authors: 'Srinath Setty',
      title: 'Spartan: Efficient and general-purpose zkSNARKs without trusted setup',
      year: 2019,
      url: 'https://eprint.iacr.org/2019/550',
      note: 'The sumcheck-plus-MLE blueprint HyperPlonk adapts to PLONKish circuits.',
    },
    {
      id: 'hypernova-2023',
      authors: 'Abhiram Kothapalli, Srinath Setty',
      title: 'HyperNova: Recursive arguments for customizable constraint systems',
      year: 2023,
      url: 'https://eprint.iacr.org/2023/573',
      note: 'Folding for CCS via the same multilinear machinery.',
    },
  ],
  generatedBy: 'curated',
};
