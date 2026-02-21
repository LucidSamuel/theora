export type DemoId = 'merkle' | 'accumulator' | 'polynomial' | 'recursive';

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
];
