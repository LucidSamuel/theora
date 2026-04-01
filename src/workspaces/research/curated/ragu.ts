import type { Walkthrough } from '../types';

export const raguWalkthrough: Walkthrough = {
  id: 'ragu-tachyon',
  paper: {
    title: 'Ragu: Proof-Carrying Data for Zcash Scalability',
    authors: 'Tachyon',
    year: 2025,
    abstractSummary:
      'Ragu extends Halo-style recursive proof composition into a proof-carrying data (PCD) system for Zcash. It combines Pasta curves, Poseidon hashing, Bootle16 constraint systems, and split accumulation to enable scalable transaction validation without trusted setup.',
  },
  sections: [
    {
      id: 'proof-carrying-data',
      title: 'Proof-Carrying Data',
      summary:
        'Proof-carrying data (PCD) attaches a proof to every piece of data as it flows through a distributed system. Each node verifies the incoming proof and extends it with its own computation. In Ragu, every transaction carries a proof that the entire chain of prior transactions was valid — without anyone needing to re-check the full history.',
      keyInsight:
        'PCD via seed() and fuse(left, right) — binary tree composition of proofs.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 3, showPasta: true },
        caption: 'PCD composes proofs as a binary tree: seed() at leaves, fuse(left, right) at internal nodes',
        interactionHints: [
          'Run verification to watch bottom-up proof checking',
          'Each node verifies its children before producing its own proof',
        ],
      },
    },
    {
      id: 'pasta-in-ragu',
      title: 'The Pasta Cycle in Ragu',
      summary:
        'Ragu uses Pallas and Vesta curves whose scalar and base fields are swapped. This allows each recursion step to verify a proof from the "other" curve using only native field arithmetic. The alternation is visible in the proof tree: odd depths use Pallas, even depths use Vesta (or vice versa).',
      keyInsight:
        'Pallas and Vesta alternate at each recursion depth, keeping field operations native.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 4, showPasta: true, showProofSize: true },
        caption: 'Pallas and Vesta alternate by depth — each node operates in its native field',
        interactionHints: [
          'Increase depth to see the alternation pattern clearly',
          'Toggle Pasta visibility to compare with a single-curve tree',
        ],
      },
    },
    {
      id: 'split-accumulation',
      title: 'Split Accumulation',
      summary:
        'Fully verifying an IPA proof inside a circuit is expensive — it requires a multi-scalar multiplication. Ragu uses split accumulation to defer this cost: instead of verifying, each recursive step accumulates the verification work. The expensive MSM is only performed once, by the final verifier. This keeps the recursive circuit small.',
      keyInsight:
        'Expensive IPA verification is deferred via accumulation — the recursive circuit stays small.',
      demo: {
        demoId: 'split-accumulation',
        state: {},
        caption: 'Split accumulation defers the expensive MSM check across recursive steps',
        interactionHints: [
          'Step through the accumulation to see how work is deferred',
        ],
      },
    },
    {
      id: 'bootle16',
      title: 'Bootle16 Constraint System',
      summary:
        'Ragu uses the Bootle16 constraint system, which separates multiplication constraints from linear ones. This separation allows more efficient prover computation and better fits the IPA-based polynomial commitment. The multiplicative gates are A·B=C (like R1CS), while linear relations are handled in a separate matrix.',
      keyInsight:
        'Bootle16 separates multiplication constraints from linear ones for more efficient proving.',
      demo: {
        demoId: 'circuit',
        state: { x: 7, broken: false, viewMode: 'bootle16' },
        caption: 'Bootle16 view separates the multiplication gate from the linear output relation',
        interactionHints: [
          'Compare R1CS and Bootle16 views to see the structural difference',
          'Toggle broken mode to remove the linear row',
        ],
      },
    },
    {
      id: 'poseidon-hashing',
      title: 'Poseidon for Circuit-Friendly Hashing',
      summary:
        'Inside recursive circuits, Ragu uses Poseidon instead of SHA-256 for hashing. Poseidon is designed to be efficient when expressed as arithmetic constraints: it uses only additions and a few exponentiations over the native field. This dramatically reduces the number of constraints compared to bitwise hash functions.',
      keyInsight:
        'Poseidon generates far fewer constraints inside recursive circuits than SHA-256.',
      demo: {
        demoId: 'constraint-counter',
        state: {},
        caption: 'Pedersen vs Poseidon constraint comparison — Poseidon is dramatically cheaper in-circuit',
        interactionHints: [
          'Compare the constraint counts for different hash functions',
        ],
      },
    },
    {
      id: 'proof-pipeline',
      title: 'The Proof Pipeline',
      summary:
        'Ragu follows a standard proof pipeline: Witness computation → Constraint satisfaction → Polynomial representation → Commitment → Challenge derivation → Opening → Verification. Each stage feeds into the next, and a fault at any stage propagates forward to cause verification failure.',
      keyInsight:
        'Witness → Constraints → Polynomial → Commit → Challenge → Open → Verify — the complete pipeline.',
      demo: {
        demoId: 'pipeline',
        state: { secretInput: 7, fault: 'none' },
        caption: 'The full 7-stage proof pipeline from witness to verification',
        interactionHints: [
          'Inject a fault to see where detection happens',
          'Try different fault types to see how they propagate',
        ],
      },
    },
    {
      id: 'failure-containment',
      title: 'Failure Containment',
      summary:
        'In a PCD tree, a bad transaction (invalid witness, forged proof) invalidates its entire branch but does not affect other branches. The tree structure naturally contains failures: the root verifier rejects the subtree with the bad leaf, but siblings remain valid. This is critical for a multi-party system where individual participants may be malicious.',
      keyInsight:
        'A bad transaction invalidates its branch, not the whole block.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 3, showPasta: true, autoplay: true },
        caption: 'A bad proof at a leaf invalidates only its branch — sibling branches remain valid',
        interactionHints: [
          'Inject a bad proof at a leaf node',
          'Run verification to see failure propagation stop at the branch boundary',
        ],
      },
    },
    {
      id: 'rerandomization',
      title: 'Rerandomization',
      summary:
        'Before submitting a proof to the network, Ragu can rerandomize it — producing a new proof that is unlinkable to the original. This prevents observers from correlating proofs to specific users or transactions. The rerandomized proof is equally valid but looks completely different.',
      keyInsight:
        'Proofs can be rerandomized for unlinkability before submission.',
      demo: {
        demoId: 'rerandomization',
        state: {},
        caption: 'Rerandomization produces an unlinkable proof that verifies identically',
        interactionHints: [
          'Rerandomize and compare the before/after proof values',
        ],
      },
    },
  ],
  generatedBy: 'curated',
};
