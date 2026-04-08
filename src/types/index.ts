export const DEMO_IDS = [
  'merkle',
  'accumulator',
  'polynomial',
  'recursive',
  'split-accumulation',
  'rerandomization',
  'oblivious-sync',
  'elliptic',
  'fiat-shamir',
  'circuit',
  'lookup',
  'pedersen',
  'constraint-counter',
  'plonk',
  'groth16',
  'sumcheck',
  'fri',
  'nova',
  'mle',
  'gkr',
  'pipeline',
] as const;

export type DemoId = typeof DEMO_IDS[number];

export function isDemoId(value: string): value is DemoId {
  return (DEMO_IDS as readonly string[]).includes(value);
}

export interface DemoMeta {
  id: DemoId;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
}

export const DEMOS: DemoMeta[] = [
  {
    id: 'merkle',
    title: 'Merkle Tree',
    subtitle: 'Build hash trees and generate compact membership proofs.',
    description:
      'A Merkle tree is a binary hash tree where each leaf contains a hash of a data block, and each internal node contains the hash of its two children. This allows efficient and secure verification of data integrity. Any change to a leaf propagates up to the root, enabling compact proofs that a piece of data belongs to the tree.',
    accent: 'var(--merkle)',
  },
  {
    id: 'accumulator',
    title: 'RSA Accumulator',
    subtitle: 'Prove set membership without revealing the entire set.',
    description:
      'A cryptographic accumulator is a compact representation of a set that supports membership proofs. The RSA accumulator uses modular exponentiation: the accumulator value is g raised to the product of all set elements, mod n. Witnesses prove membership without revealing other elements, enabling privacy-preserving set operations.',
    accent: 'var(--accumulator)',
  },
  {
    id: 'polynomial',
    title: 'Polynomial Commitments',
    subtitle: 'Explore KZG commitments with interactive coefficient manipulation.',
    description:
      'Polynomial commitment schemes let a prover commit to a polynomial and later prove evaluations at specific points without revealing the full polynomial. The KZG scheme uses elliptic curve pairings to achieve this with constant-size proofs. This is foundational to modern zk-SNARKs and data availability sampling.',
    accent: 'var(--polynomial)',
  },
  {
    id: 'circuit',
    title: 'R1CS Circuits',
    subtitle: 'Trace arithmetic circuits, witness assignments, and underconstrained failures.',
    description:
      'Arithmetic circuits compile computations into Rank-1 Constraint Systems. This demo maps gates to constraints, shows witness assignments, and highlights what happens when a signal is assigned but never properly constrained.',
    accent: '#84cc16',
  },
  {
    id: 'lookup',
    title: 'Lookup Arguments',
    subtitle: 'Show wires proving membership in a table via multiset-style checks.',
    description:
      'Lookup arguments let circuits prove that wire values belong to an allowed table without expanding many constraints by hand. This demo compares a table and queried wires, then visualizes the permutation-style check that modern lookup schemes rely on.',
    accent: '#38bdf8',
  },
  {
    id: 'elliptic',
    title: 'Elliptic Curves',
    subtitle: 'Visualize point addition, scalar multiplication, and the Pasta cycle.',
    description:
      'Elliptic curve arithmetic powers pairings, KZG commitments, and many recursive proof systems. This demo shows point addition geometrically over a finite field, then steps through double-and-add scalar multiplication and the Pallas/Vesta cycle intuition.',
    accent: '#2dd4bf',
  },
  {
    id: 'fiat-shamir',
    title: 'Fiat-Shamir',
    subtitle: 'Compare interactive proofs against correct and broken transcript hashing.',
    description:
      'The Fiat-Shamir transform replaces a verifier challenge with a hash of the transcript. When the transcript is complete, the challenge behaves like fresh randomness. When messages are omitted, attackers can precompute or bias challenges and forge convincing proofs.',
    accent: '#f97316',
  },
  {
    id: 'recursive',
    title: 'Recursive Proofs',
    subtitle: 'Watch proofs verify other proofs using IVC and Pasta curves.',
    description:
      'Recursive proof composition allows a proof to verify another proof inside itself, enabling incremental verifiable computation (IVC). The Pasta curves (Pallas and Vesta) form a cycle that makes this efficient: a proof on one curve can verify a proof from the other. This powers systems like Nova, Halo2, and Mina.',
    accent: 'var(--recursive)',
  },
  {
    id: 'split-accumulation',
    title: 'Split Accumulation',
    subtitle: 'See why Halo-style recursion works without pairings.',
    description:
      'Split accumulation defers expensive multi-scalar multiplications into a running accumulator. Each recursive step does only cheap field operations, and a single final MSM settles everything. This is the core insight behind Halo, Nova, and Sangria — and the reason Ragu achieves recursion without trusted setup.',
    accent: '#6ee7b7',
  },
  {
    id: 'rerandomization',
    title: 'Proof Rerandomization',
    subtitle: 'Watch proof bytes change while the verified statement stays fixed.',
    description:
      'Rerandomization blinds the transcript of an existing proof so that every byte-level component changes while the public statement and verifier acceptance remain the same. This is a concrete way to explain unlinkability in proof-carrying systems.',
    accent: '#a78bfa',
  },
  {
    id: 'oblivious-sync',
    title: 'Oblivious Sync',
    subtitle: 'Show a wallet proving spent-note disjointness without revealing its notes.',
    description:
      'Oblivious synchronization lets a wallet query a remote spent-note service without exposing its real nullifiers. The wallet blinds its note identifiers, the service proves disjointness against the spent set, and the wallet learns only whether the sync is clean.',
    accent: '#38bdf8',
  },
  {
    id: 'pedersen',
    title: 'Pedersen Commitments',
    subtitle: 'Commit to a value with a blinding factor and verify homomorphic addition.',
    description:
      'A Pedersen commitment is a perfectly hiding and computationally binding commitment scheme. Given generators g and h of a cyclic group, C = g^v · h^r binds the prover to value v while r keeps v secret. The scheme is additively homomorphic: committing to two values and multiplying the commitments yields a valid commitment to their sum.',
    accent: '#a3e635',
  },
  {
    id: 'constraint-counter',
    title: 'Pedersen vs Poseidon vs SHA-256',
    subtitle: 'Quantify how Merkle-hash choice changes R1CS and Bootle16 cost on logarithmic bars.',
    description:
      'Pedersen hashing is viable inside zk circuits, Poseidon is purpose-built for them, and SHA-256 is dramatically more expensive. This demo compares all three side by side, then extrapolates the gap over Merkle paths and full trees so the savings are immediate and quantitative.',
    accent: '#38bdf8',
  },
  {
    id: 'plonk',
    title: 'PLONK Arithmetization',
    subtitle: 'Inspect gate equations, selector polynomials, and copy constraints.',
    description:
      'PLONK arithmetizes circuits into a uniform gate structure: each gate uses selector values (qL, qR, qO, qM, qC) to express addition, multiplication, or constant constraints via a single equation qL·a + qR·b + qO·c + qM·a·b + qC = 0. Copy constraints link shared wire values across gates via a permutation argument, forming the basis of PlonKish proof systems.',
    accent: '#c084fc',
  },
  {
    id: 'groth16',
    title: 'Groth16 zkSNARK',
    subtitle: 'Step through R1CS, QAP, trusted setup, proof, and pairing verification.',
    description:
      'Groth16 is the most efficient zkSNARK in practice. A computation is encoded as an R1CS, transformed to a QAP, and a trusted setup generates a common reference string. The prover computes three elliptic-curve elements (A, B, C) from the witness and trapdoor evaluations; the verifier checks a single pairing equation without learning the private witness.',
    accent: '#fb923c',
  },
  {
    id: 'sumcheck',
    title: 'Sumcheck Protocol',
    subtitle: 'Watch the prover send univariate round polynomials and the verifier check each one.',
    description:
      'The sumcheck protocol lets a verifier check the sum of a multilinear polynomial over the boolean hypercube {0,1}^n in O(n) rounds, each exchanging one univariate polynomial and one random challenge. The verifier only needs a single oracle query at the end, making it the backbone of many interactive and non-interactive proof systems including GKR, STARK arithmetization, and lookup arguments.',
    accent: '#38bdf8',
  },
  {
    id: 'fri',
    title: 'FRI Protocol',
    subtitle: 'Watch polynomial degree fold down through interactive oracle proofs.',
    description:
      'FRI (Fast Reed-Solomon Interactive Oracle Proof of Proximity) proves that a function is close to a low-degree polynomial by repeatedly folding the evaluation domain. Each round halves the domain and degree using a random verifier challenge, until a constant remains. FRI is the commitment scheme powering STARKs and transparent proof systems.',
    accent: '#06b6d4',
  },
  {
    id: 'nova',
    title: 'Nova Folding',
    subtitle: 'Fold relaxed R1CS instances into a running accumulator for IVC.',
    description:
      'Nova is an IVC (Incrementally Verifiable Computation) folding scheme that compresses two R1CS instances into one without full SNARK proving. The key insight is relaxed R1CS: Az \u2218 Bz = u\u00B7Cz + E, where u is a scalar and E is an error vector. Two instances fold via a random challenge into a single accumulated instance that is valid if and only if both originals were.',
    accent: '#f59e0b',
  },
  {
    id: 'mle',
    title: 'Multilinear Extensions',
    subtitle: 'Explore how functions on {0,1}^n extend to multilinear polynomials.',
    description:
      'A multilinear extension (MLE) uniquely extends a function f: {0,1}^n \u2192 F_p to a multilinear polynomial over the entire field. The extension uses the eq basis: f\u0303(r) = \u03A3_v f(v) \u00B7 eq(r,v). MLEs are the foundation of sumcheck-based proof systems, GKR, and many modern SNARKs. Partial evaluation\u2014fixing variables one at a time\u2014is the key operation in the sumcheck protocol.',
    accent: '#8b5cf6',
  },
  {
    id: 'gkr',
    title: 'GKR Protocol',
    subtitle: 'Verify layered circuit output through sumcheck-based layer reduction.',
    description:
      'The GKR protocol lets a verifier check the output of a layered arithmetic circuit without re-executing it. Starting from a claim about the output, each layer reduces the claim to the next layer down via a sumcheck argument. After d layers the verifier makes a single query to the input. GKR is the backbone of delegated computation and many SNARK constructions.',
    accent: '#ec4899',
  },
  {
    id: 'pipeline',
    title: 'Proof Pipeline',
    subtitle: 'See how primitives compose into a complete proof system.',
    description:
      'A proof system is not one primitive — it is a pipeline. A computation becomes constraints, constraints become a polynomial, the polynomial is committed to, a Fiat-Shamir challenge is derived, the polynomial is opened, and the verifier checks everything. This demo shows the full flow end-to-end, with fault injection to see exactly where and why verification breaks.',
    accent: '#a78bfa',
  },
];
