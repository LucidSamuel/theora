export const DEMO_IDS = [
  'pipeline',
  'merkle',
  'accumulator',
  'polynomial',
  'recursive',
  'elliptic',
  'fiat-shamir',
  'circuit',
  'lookup',
  'pedersen',
  'plonk',
  'groth16',
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
    id: 'pipeline',
    title: 'Proof Pipeline',
    subtitle: 'See how primitives compose into a complete proof system.',
    description:
      'A proof system is not one primitive — it is a pipeline. A computation becomes constraints, constraints become a polynomial, the polynomial is committed to, a Fiat-Shamir challenge is derived, the polynomial is opened, and the verifier checks everything. This demo shows the full flow end-to-end, with fault injection to see exactly where and why verification breaks.',
    accent: '#a78bfa',
  },
  {
    id: 'merkle',
    title: 'Merkle Tree',
    subtitle: 'Build hash trees and generate compact membership proofs.',
    description:
      'A Merkle tree is a binary hash tree where each leaf contains a hash of a data block, and each internal node contains the hash of its two children. This allows efficient and secure verification of data integrity. Any change to a leaf propagates up to the root, enabling compact proofs that a piece of data belongs to the tree.',
    accent: 'var(--merkle)',
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
    id: 'accumulator',
    title: 'Accumulator',
    subtitle: 'Prove set membership without revealing the entire set.',
    description:
      'A cryptographic accumulator is a compact representation of a set that supports membership proofs. The RSA accumulator uses modular exponentiation: the accumulator value is g raised to the product of all set elements, mod n. Witnesses prove membership without revealing other elements, enabling privacy-preserving set operations.',
    accent: 'var(--accumulator)',
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
    id: 'pedersen',
    title: 'Pedersen Commitments',
    subtitle: 'Commit to a value with a blinding factor and verify homomorphic addition.',
    description:
      'A Pedersen commitment is a perfectly hiding and computationally binding commitment scheme. Given generators g and h of a cyclic group, C = g^v · h^r binds the prover to value v while r keeps v secret. The scheme is additively homomorphic: committing to two values and multiplying the commitments yields a valid commitment to their sum.',
    accent: '#a3e635',
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
];
