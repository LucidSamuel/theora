import type { Spring2D } from '@/lib/animation';

export interface MerkleNode {
  id: string;
  hash: string;
  data?: string;
  left?: MerkleNode;
  right?: MerkleNode;
  depth: number;
  index: number;
  spring: Spring2D;
  highlightIntensity: number;
  isProofPath: boolean;
}

export interface MerkleTree {
  root: MerkleNode;
  leaves: MerkleNode[];
  depth: number;
  nodeCount: number;
}

export interface MerkleProof {
  leafIndex: number;
  leafHash: string;
  siblings: { hash: string; position: 'left' | 'right' }[];
  root: string;
}

export type HashMode = 'sha256' | 'fnv1a';

export interface MerkleState {
  leaves: string[];
  tree: MerkleTree | null;
  hashMode: HashMode;
  selectedLeaf: number | null;
  proof: MerkleProof | null;
  proofStep: number;
  proofValid: boolean | null;
  isBuilding: boolean;
}
