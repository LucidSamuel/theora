import { hashLeaf, hashInternal, type HashFunction } from '@/lib/hash';
import { createSpring2D } from '@/lib/animation';
import type { MerkleNode, MerkleTree, MerkleProof } from '@/types/merkle';

// Build tree bottom-up. If odd leaf count, duplicate last leaf.
export async function buildMerkleTree(leaves: string[], mode: HashFunction): Promise<MerkleTree | null> {
  if (leaves.length === 0) return null;

  // Hash all leaves
  let nodes: MerkleNode[] = [];
  for (let i = 0; i < leaves.length; i++) {
    const leafData = leaves[i];
    if (!leafData) continue;
    const hash = await hashLeaf(leafData, mode);
    nodes.push({
      id: `leaf-${i}`,
      hash,
      data: leafData,
      depth: 0, // will be recalculated
      index: i,
      spring: createSpring2D(0, 0),
      highlightIntensity: 0,
      isProofPath: false,
    });
  }

  // Duplicate last if odd
  if (nodes.length > 1 && nodes.length % 2 !== 0) {
    const last = nodes[nodes.length - 1];
    if (last) {
      nodes.push({ ...last, id: `leaf-${nodes.length}-dup`, index: nodes.length });
    }
  }

  let depth = 0;
  let currentLevel = nodes;
  const allLeaves = [...nodes];

  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1];
      if (!left) continue;
      const rightNode = right ?? left;
      const hash = await hashInternal(left.hash, rightNode.hash, mode);
      nextLevel.push({
        id: `node-${depth + 1}-${i / 2}`,
        hash,
        left,
        right: rightNode,
        depth: depth + 1,
        index: Math.floor(i / 2),
        spring: createSpring2D(0, 0),
        highlightIntensity: 0,
        isProofPath: false,
      });
    }
    depth++;
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];
  if (!root) return null;

  // Fix depths (root should be 0, leaves at max)
  const treeDepth = depth;
  function fixDepth(node: MerkleNode, d: number) {
    node.depth = d;
    if (node.left) fixDepth(node.left, d + 1);
    if (node.right) fixDepth(node.right, d + 1);
  }
  fixDepth(root, 0);

  return { root, leaves: allLeaves, depth: treeDepth, nodeCount: allLeaves.length * 2 - 1 };
}

export function generateProof(tree: MerkleTree, leafIndex: number, _mode: HashFunction): MerkleProof | null {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) return null;
  const leaf = tree.leaves[leafIndex];
  if (!leaf) return null;

  // Walk from leaf to root, collecting siblings
  const siblings: { hash: string; position: 'left' | 'right' }[] = [];

  function findPath(node: MerkleNode, targetId: string): MerkleNode[] | null {
    if (node.id === targetId) return [node];
    if (node.left) {
      const path = findPath(node.left, targetId);
      if (path) return [node, ...path];
    }
    if (node.right) {
      const path = findPath(node.right, targetId);
      if (path) return [node, ...path];
    }
    return null;
  }

  const path = findPath(tree.root, leaf.id);
  if (!path) return null;

  // For each node on path (except leaf), find the sibling
  for (let i = 1; i < path.length; i++) {
    const parent = path[i - 1];
    const current = path[i];
    if (!parent || !current) continue;
    if (parent.left && parent.right) {
      if (parent.left.id === current.id) {
        siblings.push({ hash: parent.right.hash, position: 'right' });
      } else {
        siblings.push({ hash: parent.left.hash, position: 'left' });
      }
    }
  }

  return {
    leafIndex,
    leafHash: leaf.hash,
    siblings,
    root: tree.root.hash,
  };
}

export async function verifyProof(proof: MerkleProof, mode: HashFunction): Promise<boolean> {
  let currentHash = proof.leafHash;
  for (const sibling of proof.siblings) {
    if (sibling.position === 'right') {
      currentHash = await hashInternal(currentHash, sibling.hash, mode);
    } else {
      currentHash = await hashInternal(sibling.hash, currentHash, mode);
    }
  }
  return currentHash === proof.root;
}

// Layout: root at top, leaves at bottom
export function computeTreeLayout(tree: MerkleTree, w: number, h: number): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const padding = 60;
  const usableW = w - padding * 2;
  const usableH = h - padding * 2;

  function layout(node: MerkleNode, left: number, right: number) {
    const x = padding + (left + right) / 2 * usableW;
    const y = padding + (node.depth / Math.max(tree.depth, 1)) * usableH;
    positions.set(node.id, { x, y });
    if (node.left && node.right) {
      const mid = (left + right) / 2;
      layout(node.left, left, mid);
      layout(node.right, mid, right);
    }
  }

  layout(tree.root, 0, 1);
  return positions;
}

export function getProofSteps(proof: MerkleProof): { description: string; hash: string; siblingHash: string; position: string }[] {
  return proof.siblings.map((s, i) => ({
    description: `Step ${i + 1}: Hash with ${s.position} sibling`,
    hash: i === 0 ? proof.leafHash : `(result of step ${i})`,
    siblingHash: s.hash,
    position: s.position,
  }));
}

export function getProofPathNodes(tree: MerkleTree, leafIndex: number): MerkleNode[] | null {
  const leaf = tree.leaves[leafIndex];
  if (!leaf) return null;

  function findPath(node: MerkleNode, targetId: string): MerkleNode[] | null {
    if (node.id === targetId) return [node];
    if (node.left) {
      const path = findPath(node.left, targetId);
      if (path) return [node, ...path];
    }
    if (node.right) {
      const path = findPath(node.right, targetId);
      if (path) return [node, ...path];
    }
    return null;
  }

  return findPath(tree.root, leaf.id);
}
