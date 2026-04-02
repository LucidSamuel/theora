import type { Walkthrough } from '../types';

export const raguWalkthrough: Walkthrough = {
  id: 'ragu-2025',
  paper: {
    title: 'How Ragu Composes Proofs',
    authors: 'LucidSamuel',
    year: 2025,
    abstractSummary:
      'Using interactive diagrams to explain the proof-carrying data framework behind Zcash\'s proposed Tachyon upgrade. Walk through Ragu\'s architecture from the Pasta curve cycle to the full proof pipeline with animated, clickable diagrams instead of static figures.',
  },
  sections: [
    {
      id: 'intro',
      title: 'Why Interactive Diagrams',
      summary:
        'There\'s a recurring problem when you try to explain how Ragu works. You draw some boxes on a whiteboard, label them "Pallas" and "Vesta," draw arrows between them, and then spend twenty minutes trying to convey what "each proof verifies the previous proof" actually means in practice. This walkthrough uses Theora\'s interactive demos to walk through Ragu\'s architecture with animated, clickable diagrams instead of static figures. Every diagram links to a live interactive version. Click any of them and you can manipulate the state yourself.',
    },
    {
      id: 'tachyon',
      title: 'What Tachyon Is Building',
      summary:
        'Tachyon is a proposed Zcash scalability upgrade that aims to shrink transactions by two orders of magnitude and eliminate runaway state growth for validators. At its core is Ragu, a Rust library implementing proof-carrying data (PCD) that closely follows the original Halo construction. Ragu enables recursive proof composition without a trusted setup, which is what makes the 100x transaction size reduction possible. The roadmap is modular: Ragu is developed independently of the payment protocol (PIR + post-quantum delivery) and shielded protocol (new pool with simplified keys), so performance and security work on the proof system doesn\'t block higher-level design. Ragu will undergo several rounds of optimization and auditing before deployment.',
      keyInsight:
        'Ragu is Tachyon\'s foundational cryptographic engine: recursive proof composition without trusted setup.',
    },
    {
      id: 'pasta-curves',
      title: 'The Pasta Curves: Why Ragu Needs Two Elliptic Curves',
      summary:
        'Recursive proof composition has a fundamental problem: to verify a proof inside another proof, you need to perform elliptic curve arithmetic inside a circuit. But a curve\'s arithmetic is efficient in its scalar field, and the circuit operates over the base field. If these don\'t match, the arithmetic is prohibitively expensive. The Pasta curves solve this with a cycle: Pallas and Vesta are two curves where each curve\'s base field equals the other\'s scalar field. A proof computed on Pallas can be efficiently verified as a circuit on Vesta, and vice versa. In the diagram, each depth level alternates colors. The root is Pallas, its children are Vesta, their children are Pallas again. Ragu\'s recursion depends on this alternation.',
      keyInsight:
        'Pallas and Vesta form a cycle: each curve\'s base field equals the other\'s scalar field, making cross-curve verification efficient.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 4, showPasta: true, showProofSize: true },
        caption: 'Pallas and Vesta alternate by depth. Run verification to watch bottom-up proof checking',
        interactionHints: [
          'Run verification to watch it proceed from leaves to root',
          'Each node verifies its children\'s proofs before producing its own',
          'Notice the proof size stays ~288 bytes regardless of tree depth',
        ],
      },
    },
    {
      id: 'failure-containment',
      title: 'What Happens When a Proof Fails',
      summary:
        'Inject a bad proof at any leaf and run verification again. The failure propagates upward: the leaf fails, its parent fails (it can\'t verify a bad child), the grandparent fails, all the way to the root. But the sibling branches remain valid. This containment property matters for Ragu. A single invalid transaction doesn\'t invalidate the rest of the block. The proof size indicator shows ~288 bytes regardless of tree depth. This is the "succinct" property: double the computation, and the proof stays the same size.',
      keyInsight:
        'A bad transaction invalidates its branch, not the whole block. Sibling branches remain valid.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 3, showPasta: true, showProofSize: true, badProofNode: 'node_3_5', autoplay: true },
        caption: 'A bad proof at a leaf invalidates only its branch. Watch failure propagate upward while siblings stay green',
        interactionHints: [
          'Watch the failure propagate from leaf to root',
          'Notice sibling branches remain fully valid',
        ],
      },
    },
    {
      id: 'ivc-folding',
      title: 'IVC: How Tachyon Folds Proofs',
      summary:
        'Switch to IVC (Incrementally Verifiable Computation) mode and the tree becomes a chain. This is closer to how Tachyon would actually operate: each Zcash block transition is a new computation step that folds into the running accumulator. Step 1 computes f(x) and produces a proof. Step 2 takes the proof from step 1, verifies it internally, computes its own f(x), and produces a new proof attesting to both computations. At the end of a chain of 100 steps, the final proof is no larger than after 2 steps. This is how Tachyon achieves its transaction size reduction: instead of each validator independently verifying every transaction, the chain produces a single accumulated proof. A new node syncing to the chain tip verifies one proof instead of replaying history.',
      keyInsight:
        'Proof size stays constant regardless of chain length. A new node verifies one proof instead of replaying history.',
      demo: {
        demoId: 'recursive',
        state: { mode: 'ivc', ivcLength: 8, showPasta: true, showProofSize: true, ivcFoldStep: 4 },
        caption: 'Each fold absorbs the previous proof. The Pasta cycle applies here too, alternating Pallas and Vesta at each step',
        interactionHints: [
          'Continue folding to see the chain grow while proof size stays constant',
          'Notice Pallas/Vesta alternation at each fold step',
        ],
      },
    },
    {
      id: 'polynomial-commitments',
      title: 'Polynomial Commitments: What Ragu Actually Commits To',
      summary:
        'Every SNARK encodes its computation as polynomials. Ragu\'s constraint system (the R1CS matrices that check transaction validity) gets compiled into a set of polynomials. The prover commits to these polynomials, and the verifier challenges the prover to open the commitment at random points. The flow: Commit (produce a short, binding representation of the polynomial), Challenge (the verifier picks a random evaluation point, in Ragu derived via Fiat-Shamir), Open (the prover evaluates and provides a quotient proof), Verify (the verifier checks consistency). The important distinction: Ragu uses IPA (Inner Product Arguments), not KZG. The interface is the same but KZG uses pairings and requires a trusted setup. IPA uses inner products and requires no trusted setup. The tradeoff is proof size: KZG gives constant-size proofs, IPA gives log-size proofs. Zcash\'s philosophy demands no trusted setup, so Ragu chose IPA.',
      keyInsight:
        'Ragu uses IPA, not KZG. Same commit/challenge/open/verify interface, but no trusted setup required.',
      demo: {
        demoId: 'polynomial',
        state: { mode: 'coefficients', coefficients: [5, 1, 1], kzgStep: 1 },
        caption: 'The polynomial f(x) = x\u00B2 + x + 5. Step through the commit, challenge, open, verify flow',
        interactionHints: [
          'Step through all 4 KZG phases to see the full commitment lifecycle',
          'The polynomial encodes f(x) = x\u00B2 + x + 5, the same computation used in the Pipeline demo',
        ],
      },
    },
    {
      id: 'schwartz-zippel',
      title: 'Why One Random Point Is Enough',
      summary:
        'Enable comparison mode and overlay a second polynomial. Count the intersections. Two different degree-d polynomials can agree on at most d points. This is the Schwartz-Zippel lemma, and it\'s why a single random evaluation point is enough to catch a cheating prover with overwhelming probability. If the prover committed to the wrong polynomial, the chance that the verifier\'s random challenge lands on one of the (at most d) agreeing points is negligible over a large field.',
      keyInsight:
        'Schwartz-Zippel lemma: two distinct degree-d polynomials agree on at most d points. One random check catches cheaters.',
      demo: {
        demoId: 'polynomial',
        state: { mode: 'coefficients', coefficients: [0, 0, 1], compareEnabled: true, compareCoefficients: [-1, 2] },
        caption: 'x\u00B2 vs 2x\u22121: two polynomials overlaid to show they intersect at most d times',
        interactionHints: [
          'Count the intersection points, at most d for degree-d polynomials',
          'Adjust coefficients to see how different polynomials can only agree at a few points',
        ],
      },
    },
    {
      id: 'fiat-shamir-correct',
      title: 'Fiat-Shamir: Where Non-Interactivity Comes From',
      summary:
        'Every recursive step in Ragu needs a verifier challenge. But there\'s no interactive verifier. Ragu\'s proofs are non-interactive. The Fiat-Shamir transform replaces the verifier: instead of receiving a random challenge, the prover hashes the entire transcript (commitment, public input, all prior messages) to derive the challenge deterministically. This works because the hash function acts as a random oracle. The prover can\'t predict the challenge before committing, because the challenge depends on the commitment itself.',
      keyInsight:
        'The prover can\'t predict the challenge before committing. The challenge depends on the commitment.',
      demo: {
        demoId: 'fiat-shamir',
        state: { mode: 'fs-correct', secret: 9, nonce: 12, verifierSeed: 17 },
        caption: 'Correct Fiat-Shamir: the challenge is derived from the full transcript including the commitment',
        interactionHints: [
          'Follow the transcript: commitment is hashed before the challenge is derived',
          'The challenge depends on the commitment, so the prover can\'t work backward',
        ],
      },
    },
    {
      id: 'fiat-shamir-broken',
      title: 'Fiat-Shamir: The Frozen Heart Vulnerability',
      summary:
        'Switch to broken mode. The challenge is now derived as e = Hash(public_input). The commitment is omitted from the hash. The prover can compute the challenge before choosing their commitment, then work backward to craft a commitment that satisfies the verification equation. This is the Frozen Heart vulnerability class, disclosed by Trail of Bits in 2022, which affected multiple production ZK implementations. The fix is straightforward: include all prior messages in the hash. But the bug is subtle because the proof still "looks" valid. The verification equation checks out, the soundness guarantee is just gone. Ragu\'s implementation is careful about transcript composition for exactly this reason.',
      keyInsight:
        'Frozen Heart (Trail of Bits, 2022): omitting the commitment from the hash lets attackers forge proofs that pass verification.',
      demo: {
        demoId: 'fiat-shamir',
        state: { mode: 'fs-broken', secret: 9, nonce: 12, verifierSeed: 17, forgeryComplete: true },
        caption: 'Broken Fiat-Shamir: the commitment is missing from the hash. Watch the forgery succeed',
        interactionHints: [
          'Notice the challenge is computed without the commitment',
          'The forged proof passes verification despite being crafted backward',
        ],
      },
    },
    {
      id: 'r1cs-constraints',
      title: 'R1CS: The Constraint Layer',
      summary:
        'Every Zcash transaction ultimately compiles down to R1CS (Rank-1 Constraint System) constraints. "I know a secret key that opens this note, and the note value plus fee equals the output" becomes equations over a finite field. The diagram shows these constraints as a circuit with wires. Each wire carries a value. Each constraint checks a relationship between wires. If all constraints are satisfied, the witness is valid. Toggle exploit mode to see the bug that costs billions: a 2024 analysis of 141 SNARK vulnerabilities found ~96% were caused by underconstrained circuits. Remove a constraint and the intermediate wire becomes unconstrained. The prover can set it to anything. This is the Zcash Sapling counterfeiting bug (2018) in miniature. Ragu\'s PCD framework provides a clean separation between the constraint layer (where bugs live) and the proof composition layer (sound by construction), making auditing more tractable.',
      keyInsight:
        '~96% of SNARK vulnerabilities are underconstrained circuits. Ragu separates the constraint layer from the recursion layer to make auditing tractable.',
      demo: {
        demoId: 'circuit',
        state: { x: 7, broken: false },
        caption: 'R1CS constraints for f(x) = x\u00B2 + x + 5. Toggle exploit mode to see an underconstrained failure',
        interactionHints: [
          'Toggle the exploit to remove a constraint and see how the prover can cheat',
          'This mirrors the Zcash Sapling counterfeiting bug pattern',
        ],
      },
    },
    {
      id: 'merkle-tree',
      title: 'The Note Commitment Tree: Zcash\'s Merkle Heart',
      summary:
        'Zcash uses a Merkle tree to commit to shielded notes. Each note (your ZEC, encrypted) is a leaf. The Merkle root is posted onchain. When you spend a note, you prove it\'s in the tree by revealing the sibling hashes along the path from your leaf to the root. You never reveal which leaf is yours. Click a leaf to generate its inclusion proof. The highlighted path from leaf to root is exactly the data a Zcash spender would provide. Edit a leaf and watch the cascade: only the hashes on the path to the root change, while every sibling branch is untouched. This is why Merkle trees are O(log n) for updates. Tachyon proposes upgrading the hash function from Pedersen to Poseidon. Poseidon is algebraically simpler, generating fewer constraints when verified inside Ragu\'s circuits. This matters because Tachyon\'s shielded protocol requires Merkle proof verification inside recursive circuits. Every constraint saved compounds across the entire recursion stack.',
      keyInsight:
        'Tachyon upgrades from Pedersen to Poseidon hashing. Fewer constraints per hash compounds across the full recursion stack.',
      demo: {
        demoId: 'merkle',
        state: {
          leaves: [
            'note_cm_0x1a3f', 'note_cm_0x2b7c', 'note_cm_0x3d9e', 'note_cm_0x4f1b',
            'note_cm_0x5a2d', 'note_cm_0x6c4f', 'note_cm_0x7e8a', 'note_cm_0x8b3c',
          ],
          selectedLeafIndex: 3,
        },
        caption: 'Zcash note commitments as Merkle leaves. The highlighted path is a spender\'s inclusion proof',
        interactionHints: [
          'Click different leaves to generate their inclusion proofs',
          'Edit a leaf to watch the hash cascade. Only the path to root changes',
        ],
      },
    },
    {
      id: 'proof-pipeline',
      title: 'The Proof Pipeline as a Tachyon Transaction',
      summary:
        'Each stage maps to a simplified Tachyon transaction: (1) Witness, the sender knows their secret key, note value, and randomness; (2) Constraints, the circuit checks value_in = value_out + fee and that the note commitment is in the Merkle tree; (3) Polynomial, the constraint system is encoded as polynomials for Ragu\'s IPA; (4) Commit, the prover commits over the Pasta curve, no trusted setup; (5) Challenge, Fiat-Shamir hashes the entire transcript; (6) Open, the prover reveals the evaluation and quotient proof; (7) Verify, a Zcash node checks this in milliseconds. With Tachyon, this proof is itself folded into the next recursive step, becoming input to the next IVC iteration. This is where the 100x size reduction comes from: one accumulated proof replaces thousands of individual verifications.',
      keyInsight:
        'Each verified proof folds into the next IVC iteration. One accumulated proof replaces thousands of individual verifications.',
      demo: {
        demoId: 'pipeline',
        state: { x: 7, fault: 'none', activeStageIdx: 6, completedStages: [0, 1, 2, 3, 4, 5] },
        caption: 'The full 7-stage proof pipeline from witness to verification. A complete Tachyon transaction flow',
        interactionHints: [
          'Step through each stage to see the data flow',
          'Click any stage in the pipeline to inspect its computed values',
        ],
      },
    },
    {
      id: 'pipeline-fault',
      title: 'Pipeline Fault Detection',
      summary:
        'Inject the "bad witness" fault and step through again. The prover lies about their balance. The constraint stage catches it: the wire values don\'t satisfy the R1CS equations. The proof never reaches the commitment stage. In a real Zcash node running Tachyon, this transaction would be rejected before any proving work is wasted.',
      keyInsight:
        'A bad witness is caught at the constraint stage. The proof never reaches commitment, saving all downstream work.',
      demo: {
        demoId: 'pipeline',
        state: { x: 7, fault: 'bad-witness', activeStageIdx: 1, completedStages: [0, 1] },
        caption: 'Bad witness injected. The constraint stage catches the lie before any proving work is wasted',
        interactionHints: [
          'Notice the pipeline stops at constraints. Downstream stages never execute',
          'Try other fault types to see where different failures are caught',
        ],
      },
    },
    {
      id: 'conclusion',
      title: 'What This Means for Zcash',
      summary:
        'Tachyon\'s roadmap is deliberately modular: Ragu (proof system), payment protocol (PIR + post-quantum delivery), shielded protocol (new pool with simplified keys), and mainnet activation (after community consensus and ZIP approval). Each layer can be developed, optimized, and audited independently. Ragu is still under construction and will go through several rounds of optimization and external auditing before deployment. But the architecture is concrete enough to visualize, and visualization is how we build community understanding before code review begins. As Ragu moves through its optimization and audit cycles, these visualizations will evolve alongside the implementation. Living documentation that stays current as the architecture matures.',
      keyInsight:
        'Visualization builds community understanding before code review begins. Living documentation that evolves with the implementation.',
    },
  ],
  generatedBy: 'curated',
};
