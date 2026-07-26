import type { Walkthrough } from '../types';

const PLONKY2_GATE_DSL = `// Plonky2-style arithmetic gate:
//   out = q_mul·(a·b) + q_add·(a+b) + q_c
// Selector wires q_* configure what the gate computes.
input a
input b
input q_mul
input q_add
input q_c
public out

wire ab = a * b
wire mterm = q_mul * ab
wire s = a + b
wire aterm = q_add * s
wire acc = mterm + aterm
wire res = acc + q_c
assert res == out`;

export const plonkyWalkthrough: Walkthrough = {
  id: 'plonky-lineage-2022',
  paper: {
    title: 'Plonky2: Fast Recursive Arguments with PLONK and FRI',
    authors: 'Polygon Zero Team',
    year: 2022,
    eprintUrl: 'https://github.com/0xPolygonZero/plonky2/blob/main/plonky2/plonky2.pdf',
    abstractSummary:
      'Plonky2 marries PLONK\'s flexible arithmetization with FRI\'s transparent commitments, replacing pairing-based openings with hashes so that recursion becomes cheap: a proof verifying another proof in well under a second on commodity hardware. The design choices — a 64-bit Goldilocks field, hash-friendly recursion, aggressively custom gates — reshaped the practical SNARK landscape and led to the modular Plonky3 toolkit. This walkthrough traces the lineage from vanilla PLONK to that design.',
  },
  sections: [
    {
      id: 'lineage',
      title: 'The Lineage: PLONK, TurboPLONK, Plonky2, Plonky3',
      summary:
        'PLONK (2019) contributed a universal arithmetization: one gate equation with selector polynomials, plus a permutation argument for copy constraints. TurboPLONK generalized the gate equation to custom gates; Plonky2 swapped the polynomial commitment from KZG to FRI and tuned everything for recursion; Plonky3 decomposed the result into swappable components (field, hash, commitment scheme) powering production zkVMs. The gate view below is the common ancestor: every system in this lineage is still "selectors times wire values summing to zero."',
      keyInsight:
        'Four generations, one gate equation — the lineage varies the field, the commitment, and the gate degree, never the shape.',
      citations: ['plonk-2019', 'plonky2'],
      demo: {
        demoId: 'plonk',
        state: { tab: 'gates' },
        caption: 'The PLONK gate equation: selectors configure add, multiply, or constant per row',
        interactionHints: [
          'Edit gate wire values and watch the gate equation evaluate per row',
          'Note how selectors turn the same equation into different operations',
        ],
      },
    },
    {
      id: 'plonkish-arithmetization',
      title: 'PLONKish Arithmetization: Selectors and Copy Constraints',
      summary:
        'A PLONKish circuit is a table: columns of wire values, columns of fixed selectors, one gate identity applied to every row, and a permutation argument stitching cells that must be equal. Correct execution means (1) the gate identity holds on every row and (2) the copy permutation is respected. All of it compiles to polynomial identities over an evaluation domain — which is what lets any polynomial commitment scheme, pairing-based or hash-based, carry the argument.',
      keyInsight:
        'The circuit is a table; correctness is one identity per row plus one global permutation — everything else is commitment plumbing.',
      citations: ['plonk-2019'],
      demo: {
        demoId: 'plonk',
        state: { tab: 'permutation', beta: 2, gamma: 3 },
        caption: 'The permutation argument: grand product accumulating copy constraints',
        interactionHints: [
          'Follow the permutation cycles connecting cells that must agree',
          'Change β and γ to see the grand product re-randomize',
        ],
      },
    },
    {
      id: 'gate-in-editor',
      title: 'A Plonky2-Style Gate, Live in the Constraint Editor',
      summary:
        'Below is the arithmetic gate at the heart of the lineage, written over GF(101): out = q_mul·(a·b) + q_add·(a+b) + q_c. The loaded configuration sets q_mul = 1, q_add = 1, q_c = 5 with a = 3, b = 4, so out = 12 + 7 + 5 = 24. Flip selectors to reconfigure the gate: q_mul = 0 makes it a pure adder; q_add = 0 a pure multiplier. Plonky2\'s real gates are this idea at scale — high-degree, operating on 135 wires per row, with selector patterns chosen so recursion circuits fit in a few thousand rows.',
      keyInsight:
        'Selectors are program, wires are data: one algebraic template computes whatever the fixed columns say.',
      citations: ['plonky2'],
      demo: {
        demoId: 'constraint-editor',
        state: {
          v: 1,
          source: PLONKY2_GATE_DSL,
          field: '101',
          inputs: { a: '3', b: '4', q_mul: '1', q_add: '1', q_c: '5', out: '24' },
        },
        caption: 'The configurable gate with q_mul = q_add = 1, q_c = 5: out = ab + (a+b) + q_c',
        interactionHints: [
          'Set q_mul = 0 and repair out — the gate is now a pure adder',
          'Set q_add = 0, q_c = 0 and repair out — a pure multiplier',
          'Watch the constraint count: selector flexibility costs nothing extra per row',
        ],
      },
    },
    {
      id: 'kzg-to-fri',
      title: 'Swapping KZG for FRI: Transparency and Hash-Based Recursion',
      summary:
        'Vanilla PLONK opens its committed polynomials with KZG: constant-size proofs, but a trusted setup and pairing arithmetic that is miserable to verify inside a circuit. Plonky2 replaces KZG with FRI: no setup, only hash operations — and hashes are exactly what arithmetic circuits over a small field do efficiently. Proofs grow to ~100KB, but the verifier becomes recursion-friendly. The FRI demo shows the machinery that replaced the pairing check: fold, commit, query.',
      keyInsight:
        'The commitment swap trades proof size for a verifier made of hashes — the currency recursion actually spends.',
      citations: ['plonky2', 'fri-2018'],
      demo: {
        demoId: 'fri',
        state: { degree: 8, coefficients: ['3', '1', '4', '1', '5', '9', '2', '6'], phase: 'complete' },
        caption: 'FRI\'s fold-commit-query cycle: the hash-based opening argument inside Plonky2',
        interactionHints: [
          'Run commit and query phases end to end',
          'Every check here is hashing and field arithmetic — no pairings anywhere',
        ],
      },
    },
    {
      id: 'goldilocks',
      title: 'The Goldilocks Field and Fast NTTs',
      summary:
        'Plonky2 works over p = 2⁶⁴ − 2³² + 1, the "Goldilocks" prime: elements fit in one machine word, reduction is a few adds and shifts, and the field has 2³²-th roots of unity, so the NTT — the FFT over a finite field that dominates prover time — runs on power-of-two domains with tiny twiddle factors. The butterfly diagram below is the same recursive structure at toy scale: log n layers of paired operations turning coefficients into evaluations.',
      keyInsight:
        'Field choice is prover engineering: one-word arithmetic plus deep two-adic roots make the NTT — and thus the prover — fast.',
      citations: ['plonky2'],
      demo: {
        demoId: 'polynomial',
        state: {
          mode: 'ntt',
          coefficients: [3, 1, 4, 1],
          ntt: { coefficients: [3, 1, 4, 1, 5, 9, 2, 6], n: 8, direction: 'forward', activeLayer: 1 },
        },
        caption: 'NTT butterflies: log n layers from coefficients to evaluations',
        interactionHints: [
          'Step through the butterfly layers one at a time',
          'Run the inverse direction to recover the coefficients exactly',
        ],
      },
    },
    {
      id: 'recursion',
      title: 'Recursion via FRI-Friendly Hashing',
      summary:
        'A recursive proof verifies another proof inside a circuit, so the verifier\'s operations must be circuit-cheap. Plonky2\'s FRI verifier is mostly Merkle path checks, so the hash function dominates — which is why Plonky2 uses Poseidon over Goldilocks natively: its round function is low-degree field arithmetic, nearly free in PLONKish rows. The result was a recursion breakthrough: shrinking any proof to a fixed ~45KB in under 20 seconds, and aggregating proofs in trees like the one below.',
      keyInsight:
        'Recursion cost = verifier ops × circuit cost per op; Plonky2 minimized the product by making every verifier op a hash and every hash cheap.',
      citations: ['plonky2', 'poseidon'],
      demo: {
        demoId: 'recursive',
        state: { mode: 'tree', depth: 3, showPasta: false, showProofSize: true },
        caption: 'Proof aggregation trees: each node verifies its children inside a circuit',
        interactionHints: [
          'Run verification bottom-up and watch constant-size proofs compose',
          'Double the depth: the root proof stays the same size',
        ],
      },
    },
    {
      id: 'linearization-cost',
      title: 'What the Verifier Actually Checks: Linearization',
      summary:
        'At proof time all the committed polynomials meet in one linearized identity evaluated at a random challenge point: gate identity plus permutation argument, batched by challenge powers into a single equation the verifier checks against the openings. Plonky2 inherits this PLONK machinery unchanged — the FRI swap only changes *how* openings are proven, not *what* is opened. Step through the linearization to see exactly which evaluations a verifier consumes.',
      keyInsight:
        'One random point, one batched identity: the verifier never sees polynomials, only their openings stitched by challenges.',
      citations: ['plonk-2019'],
      demo: {
        demoId: 'plonk',
        state: { tab: 'linearization', selectedStep: 2 },
        caption: 'The linearized identity: every commitment meets at the challenge point',
        interactionHints: [
          'Step through the terms entering the linearization',
          'Note which openings the verifier needs — these are what FRI proves in Plonky2',
        ],
      },
    },
    {
      id: 'plonky3',
      title: 'Plonky3: The Modular Toolkit',
      summary:
        'Plonky3 decomposes Plonky2 into interchangeable parts: pick your small field (Goldilocks, BabyBear, Mersenne31), your hash (Poseidon2, Keccak), your commitment (FRI variants), and compose a proving stack tuned to your workload — the architecture behind several production zkVMs. The engineering lesson of the lineage is visible in the cost model: gate degree, wire count, and commitment choice trade against each other, and no single point in that space wins every workload.',
      keyInsight:
        'The endpoint of the lineage is a component market: fields, hashes, and commitment schemes chosen per workload, not per paper.',
      citations: ['plonky2'],
      demo: {
        demoId: 'plonk',
        state: { tab: 'cost' },
        caption: 'The cost model: gates, wires, and commitments as tunable engineering trade-offs',
        interactionHints: [
          'Vary the circuit shape and compare proving cost components',
          'Consider which components a small-field FRI stack makes cheaper',
        ],
      },
    },
  ],
  references: [
    {
      id: 'plonky2',
      authors: 'Polygon Zero Team',
      title: 'Plonky2: Fast Recursive Arguments with PLONK and FRI',
      year: 2022,
      url: 'https://github.com/0xPolygonZero/plonky2/blob/main/plonky2/plonky2.pdf',
      note: 'The whitepaper this walkthrough follows.',
    },
    {
      id: 'plonk-2019',
      authors: 'Ariel Gabizon, Zachary J. Williamson, Oana Ciobotaru',
      title: 'PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge',
      year: 2019,
      url: 'https://eprint.iacr.org/2019/953',
      note: 'The arithmetization and permutation argument the lineage builds on.',
    },
    {
      id: 'fri-2018',
      authors: 'Eli Ben-Sasson, Iddo Bentov, Yinon Horesh, Michael Riabzev',
      title: 'Fast Reed-Solomon Interactive Oracle Proofs of Proximity',
      year: 2018,
      url: 'https://eccc.weizmann.ac.il/report/2017/134/',
      note: 'The low-degree test replacing KZG openings in Plonky2.',
    },
    {
      id: 'poseidon',
      authors: 'Lorenzo Grassi, Dmitry Khovratovich, Christian Rechberger, Arnab Roy, Markus Schofnegger',
      title: 'Poseidon: A New Hash Function for Zero-Knowledge Proof Systems',
      year: 2021,
      url: 'https://eprint.iacr.org/2019/458',
      note: 'The circuit-friendly hash that makes Plonky2 recursion cheap.',
    },
  ],
  generatedBy: 'curated',
};
