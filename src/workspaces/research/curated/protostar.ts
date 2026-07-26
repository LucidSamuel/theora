import type { Walkthrough } from '../types';

const RELAXED_GATE_DSL = `// Relaxed multiplication gate (Nova/ProtoStar lineage):
//   a·b = u·c + e
// u = 1, e = 0 recovers the strict gate a·b = c.
// Folding two strict instances forces u and e to absorb cross terms.
input a
input b
input u
input e
public c

wire ab = a * b
wire uc = u * c
wire rhs = uc + e
assert ab == rhs`;

export const protostarWalkthrough: Walkthrough = {
  id: 'protostar-2023',
  paper: {
    title: 'ProtoStar: Generic Efficient Accumulation/Folding for Special Sound Protocols',
    authors: 'Benedikt Bünz, Binyi Chen',
    year: 2023,
    eprintId: '2023/620',
    eprintUrl: 'https://eprint.iacr.org/2023/620',
    abstractSummary:
      'ProtoStar generalizes Nova-style folding from R1CS to any special-sound protocol, yielding IVC from high-degree gates and lookups without pairing-based SNARKs at each step. Its compiler turns a multi-round protocol into an accumulation scheme where the recursive circuit pays for one group scalar multiplication per folded claim — the error term absorbs everything nonlinear. This walkthrough builds the folding intuition bottom-up on demos small enough to inspect every fold.',
  },
  sections: [
    {
      id: 'folding-lineage',
      title: 'The Folding Lineage: Halo to Nova to ProtoStar',
      summary:
        'Classic recursion verifies a full SNARK inside every step circuit — expensive. Halo deferred the expensive part (polynomial commitment openings) into an accumulator checked once at the end. Nova went further: don\'t verify proofs at all during the chain; instead *fold* two claim instances into one, and only prove the single accumulated instance at the very end. ProtoStar keeps Nova\'s shape but replaces its R1CS-specific folding with a generic compiler that accepts any special-sound protocol. The IVC chain below is the shared skeleton of all three: each step absorbs the previous claim while the proof stays constant-size.',
      keyInsight:
        'The lineage is a progression of deferral: verify less and less per step, accumulate the debt, settle once.',
      citations: ['halo-2019', 'nova-2021', 'protostar'],
      demo: {
        demoId: 'recursive',
        state: { mode: 'ivc', ivcLength: 6, showPasta: true, showProofSize: true },
        caption: 'IVC: each step folds the previous claim instead of verifying a proof',
        interactionHints: [
          'Continue folding and watch proof size stay flat as the chain grows',
          'Compare with tree mode: folding is the linear special case of PCD',
        ],
      },
    },
    {
      id: 'special-sound',
      title: 'Special-Sound Protocols: The Generic Recipe',
      summary:
        'ProtoStar\'s input is any (2k−1)-move special-sound protocol: prover sends messages, verifier sends random challenges, and the final check is a set of low-degree algebraic equations in messages, challenges, and public input. R1CS satisfiability is one such protocol; so are high-degree custom-gate checks and lookup arguments. Special soundness means a tree of accepting transcripts yields a witness — the property the compiler leverages to argue that folding preserves knowledge. The punchline of the paper: you design a simple, possibly many-round protocol for your relation, and the compiler mechanically produces the accumulation scheme.',
      keyInsight:
        'Design the protocol, not the folding: any special-sound protocol with algebraic verification folds for free.',
      citations: ['protostar'],
    },
    {
      id: 'relaxed-instances',
      title: 'Folding Two Claims: Relaxed Instances and Error Terms',
      summary:
        'Take two satisfying instances of the same circuit and form a random linear combination. Multiplication gates break: (a₁+r·a₂)(b₁+r·b₂) contains cross terms a₁b₂ + a₂b₁ that neither instance owes. Nova\'s fix is to *relax* the relation — introduce a scalar u and an error vector e that absorb the mismatch, so the folded instance satisfies a·b = u·c + e by construction. The folding demo shows this concretely: fold two R1CS witnesses and inspect what lands in the error term at each step.',
      keyInsight:
        'Folding is honest about its cross terms: the relaxed relation gives them a home (e) instead of pretending they cancel.',
      citations: ['nova-2021'],
      demo: {
        demoId: 'nova',
        state: { numSteps: 4, baseX: 3, stepDelta: 2, phase: 'folding', currentStep: 1, completedSteps: 1 },
        caption: 'Folding R1CS instances: the error term absorbs the multiplication cross terms',
        interactionHints: [
          'Step the fold and watch the error vector update with each combination',
          'Inject a bad witness to see the folded claim fail at settlement',
        ],
      },
    },
    {
      id: 'relaxed-gate-editor',
      title: 'The Relaxed Gate, Live in the Constraint Editor',
      summary:
        'Here is the relaxed multiplication gate as an actual constraint system over GF(101). The loaded witness is deliberately non-strict: a = 6, b = 7, so a·b = 42, but c = 20 with u = 2 and e = 2, satisfying 42 = 2·20 + 2. Set u = 1 and e = 0 and the gate collapses back to the strict a·b = c — which the current c fails, so you must repair c to 42. This is the exact degree-2 relation Nova folds; ProtoStar\'s contribution is doing the same trick for degree-d gates while committing to just one extra error term per fold.',
      keyInsight:
        'Relaxation is a two-parameter patch (u, e) on the gate equation — small enough to drag by hand.',
      citations: ['nova-2021', 'protostar'],
      demo: {
        demoId: 'constraint-editor',
        state: {
          v: 1,
          source: RELAXED_GATE_DSL,
          field: '101',
          inputs: { a: '6', b: '7', u: '2', e: '2', c: '20' },
        },
        caption: 'A relaxed instance satisfying a·b = u·c + e with u = 2, e = 2',
        interactionHints: [
          'Set u = 1 and e = 0, then fix c until the strict gate is satisfied',
          'Pick any a, b, c and compute the e that heals the gate — that is what folding does',
          'The constraint list shows exactly which R1CS rows implement the identity',
        ],
      },
    },
    {
      id: 'high-degree-gates',
      title: 'High-Degree Gates Without Cross-Term Blowup',
      summary:
        'Nova\'s folding is degree-2-specific: fold a degree-d gate naively and you owe d−1 cross-term commitments per fold. ProtoStar\'s compressing trick reduces this to a constant: the verifier\'s many degree-d equations are batched by powers of a random challenge into one claim, and the fold commits to a single error term regardless of gate degree. This is why ProtoStar pairs naturally with PLONKish custom gates — the expensive, expressive gates that make real circuits small stay cheap to fold.',
      keyInsight:
        'One committed error term per fold, independent of gate degree — high-degree gates become folding-native.',
      citations: ['protostar'],
      demo: {
        demoId: 'plonk',
        state: { tab: 'custom-gates' },
        caption: 'PLONKish custom gates: the high-degree relations ProtoStar folds at constant cost',
        interactionHints: [
          'Compose a custom gate and note its degree',
          'Compare the cost tab: gate degree trades against constraint count',
        ],
      },
    },
    {
      id: 'accumulation-vs-recursion',
      title: 'Accumulation vs Full Recursive Verification',
      summary:
        'The split-accumulation view makes the deferral explicit. Full recursion pays the whole verification cost at every step. Accumulation splits each claim into a cheap online check (performed in-circuit at every fold) and an expensive deferred check (one multi-scalar multiplication at settlement). The chart tracks both costs as steps accumulate: the per-step line stays flat while the deferred settlement grows only in the final opening — the economics that make folding-based IVC practical on ordinary hardware.',
      keyInsight:
        'Accumulation is amortization: constant work per step, one settlement at the end, no step ever verifies a SNARK.',
      citations: ['bcms-2020', 'protostar'],
      demo: {
        demoId: 'split-accumulation',
        state: { numSteps: 6, currentStep: 3, msmBaseCost: 8, showCostComparison: true, settled: false },
        caption: 'Per-step costs stay flat; the expensive check is deferred to one settlement',
        interactionHints: [
          'Advance steps and watch the accumulated vs per-step cost curves diverge',
          'Settle at the end to pay the single deferred MSM',
        ],
      },
    },
    {
      id: 'lookups-folded',
      title: 'Lookups Folded For Free',
      summary:
        'Real circuits lean on lookup arguments — range checks, bitwise ops, table-driven logic — because expressing them algebraically is brutal. ProtoStar shows that a LogUp-style lookup argument is itself special-sound with algebraic verification, so it folds under the same compiler: the lookup\'s running-sum claims join the accumulator alongside the gate claims. IVC with lookups previously meant proving the lookup at every step; here it rides along at the cost of a few extra committed columns.',
      keyInsight:
        'Lookups are just another special-sound protocol — the accumulator does not care that the relation came from a table.',
      citations: ['protostar', 'logup-2022'],
      demo: {
        demoId: 'lookup',
        state: { view: 'logup' },
        caption: 'LogUp\'s running-sum identity — algebraic, hence foldable',
        interactionHints: [
          'Step through the LogUp sum to see the algebraic identity a lookup reduces to',
          'Change a looked-up value to break the identity and watch the check fail',
        ],
      },
    },
    {
      id: 'ivc-step-circuit',
      title: 'What the IVC Step Circuit Actually Checks',
      summary:
        'Inside each IVC step, the recursive circuit does not verify a proof. It checks that the fold was performed correctly: hash the incoming accumulator, verify the random challenge was derived from the right transcript, and perform the one group operation that combines commitments. Everything else — the actual satisfiability of all folded claims — remains deferred. This is why ProtoStar\'s recursive overhead is measured in a handful of hashes and a single scalar multiplication, compared to full in-circuit pairing checks in SNARK recursion.',
      keyInsight:
        'The step circuit audits the fold, not the claims — that asymmetry is the entire performance win.',
      citations: ['protostar'],
      demo: {
        demoId: 'recursive',
        state: { mode: 'ivc', ivcLength: 8, showPasta: true, showProofSize: true, ivcFoldStep: 4 },
        caption: 'Mid-chain: step k folds the accumulator, checks the fold, and moves on',
        interactionHints: [
          'Advance fold steps and note what each step must recompute (little) vs defer (everything)',
          'The Pasta alternation shows where each fold\'s group arithmetic is cheap',
        ],
      },
    },
    {
      id: 'landscape',
      title: 'The Folding Landscape: Nova, HyperNova, ProtoStar',
      summary:
        'Nova folds R1CS (degree-2) with one cross-term commitment per fold. HyperNova moves to CCS and folds via a sumcheck-based multi-folding argument, avoiding committed cross terms at the price of running sumcheck in the step circuit. ProtoStar folds any special-sound protocol, supports degree-d gates and lookups with one committed error term, and keeps the step circuit hash-dominated. The schemes are converging on the same destination — IVC where per-step cost is independent of both circuit size and gate degree — along different compiler routes.',
      keyInsight:
        'Pick your generality: R1CS (Nova), CCS + sumcheck (HyperNova), or any special-sound protocol (ProtoStar).',
      citations: ['nova-2021', 'hypernova-2023', 'protostar'],
    },
  ],
  references: [
    {
      id: 'protostar',
      authors: 'Benedikt Bünz, Binyi Chen',
      title: 'ProtoStar: Generic Efficient Accumulation/Folding for Special Sound Protocols',
      year: 2023,
      url: 'https://eprint.iacr.org/2023/620',
      note: 'The paper this walkthrough follows.',
    },
    {
      id: 'nova-2021',
      authors: 'Abhiram Kothapalli, Srinath Setty, Ioanna Tzialla',
      title: 'Nova: Recursive Zero-Knowledge Arguments from Folding Schemes',
      year: 2021,
      url: 'https://eprint.iacr.org/2021/370',
      note: 'The folding scheme for relaxed R1CS that started the lineage.',
    },
    {
      id: 'halo-2019',
      authors: 'Sean Bowe, Jack Grigg, Daira Hopwood',
      title: 'Recursive Proof Composition without a Trusted Setup',
      year: 2019,
      url: 'https://eprint.iacr.org/2019/1021',
      note: 'Accumulation of polynomial commitment openings — the deferral idea folding generalizes.',
    },
    {
      id: 'bcms-2020',
      authors: 'Benedikt Bünz, Alessandro Chiesa, Pratyush Mishra, Nicholas Spooner',
      title: 'Proof-Carrying Data from Accumulation Schemes',
      year: 2020,
      url: 'https://eprint.iacr.org/2020/499',
      note: 'Formalizes accumulation schemes and PCD from them.',
    },
    {
      id: 'hypernova-2023',
      authors: 'Abhiram Kothapalli, Srinath Setty',
      title: 'HyperNova: Recursive arguments for customizable constraint systems',
      year: 2023,
      url: 'https://eprint.iacr.org/2023/573',
      note: 'Sumcheck-based multi-folding for CCS — the sibling approach.',
    },
    {
      id: 'logup-2022',
      authors: 'Ulrich Haböck',
      title: 'Multivariate lookups based on logarithmic derivatives',
      year: 2022,
      url: 'https://eprint.iacr.org/2022/1530',
      note: 'The LogUp lookup argument ProtoStar folds.',
    },
  ],
  generatedBy: 'curated',
};
