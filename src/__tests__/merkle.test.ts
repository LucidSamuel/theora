import { describe, it, expect } from 'vitest';
import {
  buildMerkleTree,
  generateProof,
  verifyProof,
  getProofSteps,
  getProofPathNodes,
  computeTreeLayout,
} from '@/demos/merkle/logic';

describe('buildMerkleTree', () => {
  it('returns null for empty leaves', async () => {
    const tree = await buildMerkleTree([], 'fnv1a');
    expect(tree).toBeNull();
  });

  it('builds a tree with 1 leaf', async () => {
    const tree = await buildMerkleTree(['a'], 'fnv1a');
    expect(tree).not.toBeNull();
    expect(tree!.leaves).toHaveLength(1);
    expect(tree!.depth).toBe(0);
  });

  it('builds a tree with 2 leaves', async () => {
    const tree = await buildMerkleTree(['a', 'b'], 'fnv1a');
    expect(tree).not.toBeNull();
    expect(tree!.leaves).toHaveLength(2);
    expect(tree!.depth).toBe(1);
    expect(tree!.root.left).toBeDefined();
    expect(tree!.root.right).toBeDefined();
  });

  it('builds a tree with 4 leaves', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    expect(tree).not.toBeNull();
    expect(tree!.leaves).toHaveLength(4);
    expect(tree!.depth).toBe(2);
  });

  it('duplicates last leaf for odd count', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c'], 'fnv1a');
    expect(tree).not.toBeNull();
    // 3 leaves + 1 duplicate = 4 leaf nodes
    expect(tree!.leaves).toHaveLength(4);
    expect(tree!.depth).toBe(2);
  });

  it('root depth is 0', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    expect(tree!.root.depth).toBe(0);
  });

  it('produces deterministic trees', async () => {
    const tree1 = await buildMerkleTree(['x', 'y'], 'fnv1a');
    const tree2 = await buildMerkleTree(['x', 'y'], 'fnv1a');
    expect(tree1!.root.hash).toBe(tree2!.root.hash);
  });
});

describe('generateProof', () => {
  it('generates a valid proof for each leaf', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    expect(tree).not.toBeNull();

    for (let i = 0; i < tree!.leaves.length; i++) {
      const proof = generateProof(tree!, i, 'fnv1a');
      expect(proof).not.toBeNull();
      expect(proof!.leafIndex).toBe(i);
      expect(proof!.root).toBe(tree!.root.hash);
    }
  });

  it('returns null for out-of-range index', async () => {
    const tree = await buildMerkleTree(['a', 'b'], 'fnv1a');
    expect(generateProof(tree!, -1, 'fnv1a')).toBeNull();
    expect(generateProof(tree!, 5, 'fnv1a')).toBeNull();
  });

  it('proof has correct number of siblings', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const proof = generateProof(tree!, 0, 'fnv1a');
    // depth=2, so 2 siblings
    expect(proof!.siblings).toHaveLength(2);
  });
});

describe('verifyProof', () => {
  it('verifies a valid proof', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const proof = generateProof(tree!, 0, 'fnv1a');
    const valid = await verifyProof(proof!, 'fnv1a');
    expect(valid).toBe(true);
  });

  it('rejects a tampered leaf hash', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const proof = generateProof(tree!, 0, 'fnv1a');
    const tampered = { ...proof!, leafHash: 'deadbeef' };
    const valid = await verifyProof(tampered, 'fnv1a');
    expect(valid).toBe(false);
  });

  it('rejects a tampered sibling hash', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const proof = generateProof(tree!, 0, 'fnv1a');
    const tampered = {
      ...proof!,
      siblings: [{ hash: 'deadbeef', position: proof!.siblings[0]!.position }, ...proof!.siblings.slice(1)],
    };
    const valid = await verifyProof(tampered, 'fnv1a');
    expect(valid).toBe(false);
  });

  it('verifies proofs for all leaves in a tree', async () => {
    const tree = await buildMerkleTree(['w', 'x', 'y', 'z'], 'fnv1a');
    for (let i = 0; i < tree!.leaves.length; i++) {
      const proof = generateProof(tree!, i, 'fnv1a');
      const valid = await verifyProof(proof!, 'fnv1a');
      expect(valid).toBe(true);
    }
  });
});

describe('getProofSteps', () => {
  it('returns correct number of steps', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const proof = generateProof(tree!, 0, 'fnv1a');
    const steps = getProofSteps(proof!);
    expect(steps).toHaveLength(proof!.siblings.length);
  });

  it('step descriptions include position', async () => {
    const tree = await buildMerkleTree(['a', 'b'], 'fnv1a');
    const proof = generateProof(tree!, 0, 'fnv1a');
    const steps = getProofSteps(proof!);
    expect(steps[0]!.description).toContain('sibling');
    expect(steps[0]!.position).toMatch(/^(left|right)$/);
  });
});

describe('getProofPathNodes', () => {
  it('returns path from root to leaf', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const path = getProofPathNodes(tree!, 0);
    expect(path).not.toBeNull();
    // Path includes root + intermediate + leaf = depth + 1 nodes
    expect(path!.length).toBe(tree!.depth + 1);
    // First node is root
    expect(path![0]!.id).toBe(tree!.root.id);
  });

  it('returns null for invalid leaf index', async () => {
    const tree = await buildMerkleTree(['a', 'b'], 'fnv1a');
    expect(getProofPathNodes(tree!, 99)).toBeNull();
  });
});

describe('computeTreeLayout', () => {
  it('returns positions for all nodes', async () => {
    const tree = await buildMerkleTree(['a', 'b', 'c', 'd'], 'fnv1a');
    const layout = computeTreeLayout(tree!, 800, 600);
    // 4 leaves + 2 internals + 1 root = 7 nodes
    expect(layout.size).toBe(7);
  });

  it('root is positioned near the top', async () => {
    const tree = await buildMerkleTree(['a', 'b'], 'fnv1a');
    const layout = computeTreeLayout(tree!, 800, 600);
    const rootPos = layout.get(tree!.root.id);
    expect(rootPos).toBeDefined();
    expect(rootPos!.y).toBeLessThan(300); // top half
  });
});
