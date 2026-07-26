import type { Walkthrough } from '../types';

const FRI_FOLD_DSL = `// FRI fold check at one query point:
// 2x·g(x²) = x·(f(x)+f(−x)) + β·(f(x)−f(−x))
input fx
input fnx
input x
input beta
public g

wire sum = fx + fnx
wire diff = fx - fnx
wire xsum = x * sum
wire bdiff = beta * diff
wire rhs = xsum + bdiff
wire xg = x * g
wire lhs = 2 * xg
assert lhs == rhs`;

export const friWalkthrough: Walkthrough = {
  id: 'fri-ethstark-2021',
  paper: {
    title: 'ethSTARK Documentation',
    authors: 'Eli Ben-Sasson (StarkWare)',
    year: 2021,
    eprintId: '2021/582',
    eprintUrl: 'https://eprint.iacr.org/2021/582',
    abstractSummary:
      'The ethSTARK documentation is the most complete public specification of a production STARK: a transparent, hash-based proof system with no trusted setup and plausible post-quantum security. Its engine is FRI, a low-degree test that repeatedly folds a Reed-Solomon codeword in half until a claimed polynomial either collapses to a constant or is caught cheating. This walkthrough follows that pipeline on toy fields where every fold and every query is visible.',
  },
  sections: [
    {
      id: 'low-degree-problem',
      title: 'The Problem: Proving a Polynomial Has Low Degree',
      summary:
        'Every STARK reduces "this computation is correct" to "this function is a polynomial of low degree." The prover claims a committed function f agrees with some polynomial of degree less than d. The verifier cannot read all of f — that would defeat succinctness — so it needs a test that reads only a handful of positions yet catches any function that is far from every low-degree polynomial. This is the low-degree testing problem, and FRI (Fast Reed-Solomon Interactive Oracle Proof of Proximity) is its practical solution: logarithmic rounds, hash commitments, and no elliptic curves anywhere.',
      keyInsight:
        'STARK soundness reduces to one question: is this committed function close to a low-degree polynomial?',
      citations: ['fri-2018'],
    },
    {
      id: 'rs-codewords',
      title: 'Reed-Solomon Codewords: Polynomials as Evaluations',
      summary:
        'FRI never touches coefficients directly. The prover evaluates the polynomial over a fixed domain (a multiplicative subgroup of the field) and commits to that table of evaluations — a Reed-Solomon codeword. The key property: two distinct polynomials of degree less than d agree on fewer than d domain points, so a codeword of a low-degree polynomial is far (in Hamming distance) from the codeword of any other. Lagrange interpolation shows the equivalence: d evaluation points determine the degree-(d−1) polynomial exactly.',
      keyInsight:
        'A polynomial and its evaluation table are interchangeable; distance between codewords is what makes cheating detectable.',
      demo: {
        demoId: 'polynomial',
        state: { mode: 'lagrange', coefficients: [3, 5, 2, 7] },
        caption: 'A cubic through its evaluation points — the codeword view of a polynomial',
        interactionHints: [
          'Drag the interpolation points and watch the unique cubic follow',
          'Switch to coefficients mode to see the same polynomial both ways',
        ],
      },
    },
    {
      id: 'split-and-fold',
      title: 'Split and Fold: Halving the Degree Each Round',
      summary:
        'Write f(x) = f_even(x²) + x·f_odd(x²), splitting the coefficients by parity. Both halves have half the degree. The verifier sends a random challenge β, and the prover commits to the folded polynomial g(y) = f_even(y) + β·f_odd(y) over the squared (halved) domain. If f had degree less than d, then g has degree less than d/2 — and crucially, if f was far from low-degree, the fold stays far with high probability over β. Repeat log₂(d) times and an honest claim collapses to a constant.',
      keyInsight:
        'One random β compresses two half-degree claims into one — degree halves every round, and cheating survives folding only with negligible probability.',
      citations: ['fri-2018', 'ethstark'],
      demo: {
        demoId: 'fri',
        state: { degree: 8, coefficients: ['3', '1', '4', '1', '5', '9', '2', '6'], phase: 'committing' },
        caption: 'The commit phase: each layer folds the codeword in half under a fresh challenge',
        interactionHints: [
          'Run the commit phase and watch the domain halve at each layer',
          'Each layer\'s challenge β mixes even and odd parts into one codeword',
          'The final layer is a single constant — that is the whole claim',
        ],
      },
    },
    {
      id: 'merkle-commitments',
      title: 'Committing to Each Layer: Merkle Roots',
      summary:
        'The verifier never receives full codewords — each layer is committed via a Merkle tree, and the prover sends only the root. Later, when the verifier queries position i, the prover reveals the leaf plus its authentication path. The hash tree binds the prover to every layer before any query positions are known: it cannot adapt evaluations after the fact. This is what makes FRI transparent — the only cryptographic assumption is a collision-resistant hash, no pairing groups, no trusted ceremony.',
      keyInsight:
        'Merkle roots bind the prover to every layer before queries land; hashes are the only cryptography STARKs need.',
      citations: ['ethstark'],
      demo: {
        demoId: 'merkle',
        state: { leaves: ['f(ω⁰)', 'f(ω¹)', 'f(ω²)', 'f(ω³)', 'f(ω⁴)', 'f(ω⁵)', 'f(ω⁶)', 'f(ω⁷)'], selectedLeafIndex: 3 },
        caption: 'A layer\'s codeword as Merkle leaves — one root commits to all eight evaluations',
        interactionHints: [
          'Select a leaf to highlight its authentication path to the root',
          'Change a leaf value and watch the root change — the binding property',
        ],
      },
    },
    {
      id: 'query-phase',
      title: 'The Query Phase: Spot-Checking the Folds',
      summary:
        'After all layers are committed, the verifier picks random positions and checks consistency between consecutive layers. For a query at x, the prover opens f(x) and f(−x) in layer i and the folded value g(x²) in layer i+1. The verifier recomputes the fold locally — f_even(x²) from the sum, f_odd(x²) from the difference — and checks it matches the opened g(x²). One query chain touches every layer; each additional query multiplies a cheater\'s survival probability by roughly the same small factor.',
      keyInsight:
        'Each query re-derives one fold from two openings; layers are chained, so a lie in any round is exposed at the seam.',
      citations: ['ethstark'],
      demo: {
        demoId: 'fri',
        state: { degree: 8, coefficients: ['3', '1', '4', '1', '5', '9', '2', '6'], phase: 'querying' },
        caption: 'Query chains descending the layers: every fold seam is spot-checked',
        interactionHints: [
          'Run the query phase and follow one query index through every layer',
          'Each check compares the locally recomputed fold to the committed value',
        ],
      },
    },
    {
      id: 'catching-cheaters',
      title: 'Catching a Corrupt Codeword',
      summary:
        'Enable corruption mode: the demo perturbs the committed evaluations so they no longer lie on any low-degree polynomial. The commit phase still runs — the prover can always fold *something* — but the query phase now finds inconsistent seams: the recomputed fold disagrees with the committed layer. This is FRI\'s distance-preservation argument made visible: corruption cannot be folded away, because a random β keeps the folded word far from every low-degree codeword.',
      keyInsight:
        'A cheating prover survives only if every random query misses every inconsistent seam — probability that vanishes exponentially in the query count.',
      demo: {
        demoId: 'fri',
        state: { degree: 8, coefficients: ['3', '1', '4', '1', '5', '9', '2', '6'], corruptMode: true, phase: 'complete' },
        caption: 'Corrupted evaluations fail their consistency checks in the query phase',
        interactionHints: [
          'Compare the failed checks here to the clean run in the previous section',
          'Toggle corruption off and re-run to watch the checks turn green',
        ],
      },
    },
    {
      id: 'fold-as-constraints',
      title: 'The Fold Relation, Live in the Constraint Editor',
      summary:
        'The consistency check the verifier performs at each query is one algebraic identity. Multiply the fold definition through by 2x to clear denominators and it becomes: 2x·g(x²) = x·(f(x)+f(−x)) + β·(f(x)−f(−x)). That is exactly the equation below, written as an arithmetic circuit over GF(101). The loaded witness is a real fold: f(y) = 3+5y+2y²+7y³ evaluated at x = 10, so f(x) = 82, f(−x) = 21, and with β = 7 the folded value is g(x²) = 88. Drag the witness values and watch the assertion break — then restore them and it heals.',
      keyInsight:
        'A FRI query check is a single low-degree identity — small enough to write, satisfy, and break by hand.',
      citations: ['fri-2018'],
      demo: {
        demoId: 'constraint-editor',
        state: {
          v: 1,
          source: FRI_FOLD_DSL,
          field: '101',
          inputs: { fx: '82', fnx: '21', x: '10', beta: '7', g: '88' },
        },
        caption: 'The fold identity as R1CS constraints with a genuine satisfying witness',
        interactionHints: [
          'Change g and watch the assert fail — the constraint list pinpoints the mismatch',
          'Change beta and recompute: only one g satisfies the identity for each β',
          'The analysis panel confirms every wire is constrained — no prover freedom here',
        ],
      },
    },
    {
      id: 'fiat-shamir',
      title: 'From Interactive to Non-Interactive: Fiat-Shamir',
      summary:
        'Everything so far was interactive: the verifier sends β challenges and query positions. ethSTARK makes it non-interactive by deriving every challenge from a hash of the transcript so far — commit roots in, challenges out. The documentation is unusually careful here, specifying exactly which values enter the transcript channel and in what order, because a challenge derived before its commitment is bound (the Frozen Heart bug class) lets a prover grind forgeries. Watch the broken variant: reordering the transcript lets a cheater pass.',
      keyInsight:
        'Every commitment must enter the transcript before the challenge it justifies — order is the entire security argument.',
      citations: ['ethstark', 'frozen-heart'],
      demo: {
        demoId: 'fiat-shamir',
        state: { mode: 'fs-correct', secret: 9, nonce: 12, verifierSeed: 17 },
        caption: 'Challenges derived by hashing the transcript — the interactive protocol, sealed',
        interactionHints: [
          'Step through the transcript to see commitments absorbed before challenges emerge',
          'Switch to the broken variant to watch a forged proof pass when ordering is wrong',
        ],
      },
    },
    {
      id: 'stark-pipeline',
      title: 'FRI Inside the Full STARK Pipeline',
      summary:
        'FRI is the last stage of a longer pipeline. ethSTARK arithmetizes the computation (an execution trace with transition constraints), interpolates trace columns into polynomials, combines constraint quotients into one composition polynomial, and then hands FRI a single low-degree claim about it. If any step of the original computation was wrong, some constraint quotient fails to be a polynomial, the composition polynomial fails the degree bound, and FRI rejects. The pipeline demo shows the same shape end-to-end: witness → constraints → polynomial → commitment → proof → verify.',
      keyInsight:
        'FRI never sees the computation — arithmetization funnels every correctness claim into one low-degree test.',
      citations: ['ethstark', 'stark-2018'],
      demo: {
        demoId: 'pipeline',
        state: { x: 7, fault: 'none', activeStageIdx: 6, completedStages: [0, 1, 2, 3, 4, 5] },
        caption: 'The full proving pipeline: FRI is the engine behind the commitment/proof stages',
        interactionHints: [
          'Step through each stage from witness to verification',
          'Inject a fault early and watch it surface at verification time',
        ],
      },
    },
  ],
  references: [
    {
      id: 'fri-2018',
      authors: 'Eli Ben-Sasson, Iddo Bentov, Yinon Horesh, Michael Riabzev',
      title: 'Fast Reed-Solomon Interactive Oracle Proofs of Proximity',
      year: 2018,
      url: 'https://eccc.weizmann.ac.il/report/2017/134/',
      note: 'The original FRI protocol (ICALP 2018): split-and-fold low-degree testing.',
    },
    {
      id: 'stark-2018',
      authors: 'Eli Ben-Sasson, Iddo Bentov, Yinon Horesh, Michael Riabzev',
      title: 'Scalable, transparent, and post-quantum secure computational integrity',
      year: 2018,
      url: 'https://eprint.iacr.org/2018/046',
      note: 'The STARK paper: arithmetization pipeline that feeds FRI.',
    },
    {
      id: 'ethstark',
      authors: 'Eli Ben-Sasson (StarkWare)',
      title: 'ethSTARK Documentation',
      year: 2021,
      url: 'https://eprint.iacr.org/2021/582',
      note: 'The paper this walkthrough follows: a complete production STARK specification.',
    },
    {
      id: 'frozen-heart',
      authors: 'Jim Miller, Trail of Bits',
      title: 'Coordinated disclosure of vulnerabilities affecting Girault, Bulletproofs, and PlonK',
      year: 2022,
      url: 'https://blog.trailofbits.com/2022/04/13/part-1-coordinated-disclosure-of-vulnerabilities-affecting-girault-bulletproofs-and-plonk/',
      note: 'The Frozen Heart bug class: challenges derived from incomplete transcripts.',
    },
  ],
  generatedBy: 'curated',
};
