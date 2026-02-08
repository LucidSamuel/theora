import { fnv1a } from '@/lib/hash';
import { createSpring2D } from '@/lib/animation';
import type { ProofNode, IvcChain, IvcStep, ProofStatus, Curve } from '@/types/recursive';

/**
 * Builds a complete binary proof tree of given depth
 * Even depths use Pallas curve, odd depths use Vesta curve
 */
export function buildProofTree(depth: number, badProofTarget: string | null): ProofNode {
  function buildNode(currentDepth: number, index: number): ProofNode {
    const id = `node_${currentDepth}_${index}`;
    const curve: Curve = currentDepth % 2 === 0 ? 'pallas' : 'vesta';
    const label = `π_${currentDepth}_${index}`;
    const isBadProof = badProofTarget === id;

    const node: ProofNode = {
      id,
      depth: currentDepth,
      index,
      curve,
      status: 'pending',
      label,
      children: [],
      isBadProof,
      spring: createSpring2D(0, 0),
    };

    // Recursively build children if not at leaf level
    if (currentDepth < depth) {
      node.children = [
        buildNode(currentDepth + 1, index * 2),
        buildNode(currentDepth + 1, index * 2 + 1),
      ];
    }

    return node;
  }

  return buildNode(0, 0);
}

/**
 * Returns node IDs in bottom-up, left-to-right verification order
 * (leaves first, then their parents, up to root)
 */
export function getVerificationOrder(root: ProofNode): string[] {
  const nodesByDepth: Map<number, ProofNode[]> = new Map();
  let maxDepth = 0;

  // Collect all nodes organized by depth
  function traverse(node: ProofNode): void {
    const nodes = nodesByDepth.get(node.depth) ?? [];
    nodes.push(node);
    nodesByDepth.set(node.depth, nodes);
    maxDepth = Math.max(maxDepth, node.depth);

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);

  // Build order from deepest to shallowest (bottom-up)
  const order: string[] = [];
  for (let depth = maxDepth; depth >= 0; depth--) {
    const nodes = nodesByDepth.get(depth) ?? [];
    // Left to right within each depth
    for (const node of nodes) {
      order.push(node.id);
    }
  }

  return order;
}

/**
 * Verifies a node based on its children's status and bad proof flag
 */
export function verifyNode(node: ProofNode, allNodes: Map<string, ProofNode>): ProofStatus {
  // If this is marked as a bad proof, it fails
  if (node.isBadProof) {
    return 'failed';
  }

  // If no children (leaf node), it verifies successfully
  if (node.children.length === 0) {
    return 'verified';
  }

  // Check all children
  for (const child of node.children) {
    const childNode = allNodes.get(child.id);
    if (!childNode) continue;

    // If any child failed, this node fails
    if (childNode.status === 'failed') {
      return 'failed';
    }

    // If any child is not yet verified, we can't verify this node
    if (childNode.status !== 'verified') {
      return 'pending';
    }
  }

  // All children verified and no bad proof flag
  return 'verified';
}

/**
 * Builds an IVC (Incrementally Verifiable Computation) chain
 */
export function buildIvcChain(length: number): IvcChain {
  const steps: IvcStep[] = [];

  for (let i = 0; i < length; i++) {
    const curve: Curve = i % 2 === 0 ? 'pallas' : 'vesta';
    const inputValue = Math.floor(Math.random() * 100) + 1;
    const accumulatorHash = fnv1a(`step_${i}_input_${inputValue}`);

    steps.push({
      id: `ivc_step_${i}`,
      index: i,
      curve,
      status: 'pending',
      accumulatorHash,
      inputValue,
      folded: false,
    });
  }

  return {
    steps,
    currentFoldIndex: -1,
  };
}

/**
 * Folds the next unfolded step in the IVC chain
 */
export function foldIvcStep(chain: IvcChain): IvcChain {
  const steps = [...chain.steps];
  const nextIndex = chain.currentFoldIndex + 1;

  if (nextIndex >= steps.length) {
    return chain; // Already all folded
  }

  // Mark current step as folded
  const currentStep = steps[nextIndex];
  if (!currentStep) return chain;
  steps[nextIndex] = { ...currentStep, folded: true, status: 'verified' };

  // Update accumulator hash to include previous step's hash
  if (nextIndex > 0) {
    const prevHash = steps[nextIndex - 1]?.accumulatorHash ?? '';
    const currentInput = steps[nextIndex]?.inputValue ?? 0;
    steps[nextIndex] = {
      ...steps[nextIndex]!,
      accumulatorHash: fnv1a(`${prevHash}_${currentInput}`),
    };
  }

  return {
    steps,
    currentFoldIndex: nextIndex,
  };
}

/**
 * Returns constant proof size information for recursive proofs
 */
export function getConstantProofSize(): { bytes: number; description: string } {
  return {
    bytes: 288,
    description: '~288 bytes',
  };
}

/**
 * Flattens the proof tree into a map for easy lookup
 */
export function getAllNodes(root: ProofNode): Map<string, ProofNode> {
  const nodes = new Map<string, ProofNode>();

  function traverse(node: ProofNode): void {
    nodes.set(node.id, node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);
  return nodes;
}

/**
 * Computes layout positions for tree nodes
 * Root at top, leaves at bottom, evenly distributed
 */
export function computeTreeLayout(
  root: ProofNode,
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const padding = 60;

  // First pass: determine max depth
  let maxDepth = 0;
  function findMaxDepth(node: ProofNode): void {
    maxDepth = Math.max(maxDepth, node.depth);
    for (const child of node.children) {
      findMaxDepth(child);
    }
  }
  findMaxDepth(root);

  // Calculate vertical spacing
  const usableHeight = height - padding * 2;
  const verticalSpacing = maxDepth > 0 ? usableHeight / maxDepth : 0;

  // Count nodes at each depth for horizontal spacing
  const nodesAtDepth = new Map<number, number>();
  function countNodes(node: ProofNode): void {
    nodesAtDepth.set(node.depth, (nodesAtDepth.get(node.depth) ?? 0) + 1);
    for (const child of node.children) {
      countNodes(child);
    }
  }
  countNodes(root);

  // Second pass: assign positions
  const indexAtDepth = new Map<number, number>();

  function assignPosition(node: ProofNode): void {
    const currentIndex = indexAtDepth.get(node.depth) ?? 0;
    indexAtDepth.set(node.depth, currentIndex + 1);

    const totalAtDepth = nodesAtDepth.get(node.depth) ?? 1;
    const usableWidth = width - padding * 2;

    // Distribute nodes evenly across width
    const x = padding + (usableWidth / (totalAtDepth + 1)) * (currentIndex + 1);
    const y = padding + verticalSpacing * node.depth;

    positions.set(node.id, { x, y });

    for (const child of node.children) {
      assignPosition(child);
    }
  }

  assignPosition(root);
  return positions;
}
