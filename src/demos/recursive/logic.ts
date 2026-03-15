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
 * Computes layout positions for tree nodes using a leaf-first centering approach.
 * Leaves get sequential horizontal slots; parents are centered above their children.
 * The virtual canvas expands as needed so nodes never overlap — the camera handles
 * showing the full tree via zoom/pan.
 */
export function computeTreeLayout(
  root: ProofNode,
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Node geometry constants (must stay in sync with renderer)
  const NODE_W = 118;
  const NODE_H = 58;
  const H_GAP = 22;  // min horizontal gap between sibling node edges
  const V_GAP = 72;  // vertical gap between node edges

  const slotW = NODE_W + H_GAP;  // horizontal distance between leaf centers

  // First pass: determine max depth
  let maxDepth = 0;
  function findMaxDepth(node: ProofNode): void {
    maxDepth = Math.max(maxDepth, node.depth);
    for (const child of node.children) findMaxDepth(child);
  }
  findMaxDepth(root);

  // Assign each leaf a sequential slot index
  let leafCounter = 0;
  const leafSlot = new Map<string, number>();
  function assignLeafSlots(node: ProofNode): void {
    if (node.children.length === 0) {
      leafSlot.set(node.id, leafCounter++);
    }
    for (const child of node.children) assignLeafSlots(child);
  }
  assignLeafSlots(root);

  const totalLeaves = Math.max(leafCounter, 1);

  // Total footprint: (n-1) gaps between centers + one node on each side
  const treeFootprintW = (totalLeaves - 1) * slotW + NODE_W;
  const treeFootprintH = (maxDepth + 1) * (NODE_H + V_GAP) - V_GAP;
  const hMargin = 60;
  const vMargin = 60;

  // Virtual canvas dimensions (may exceed physical canvas — camera zooms to fit)
  const vWidth = Math.max(width, treeFootprintW + hMargin * 2);
  const vHeight = Math.max(height, treeFootprintH + vMargin * 2);

  const levelH = NODE_H + V_GAP;
  // Leaf 0 center: placed so left edge is at hMargin, then centered in vWidth
  const treeLeft = (vWidth - treeFootprintW) / 2;
  const originX = treeLeft + NODE_W / 2;
  const originY = vMargin + NODE_H / 2;

  // Second pass: compute center x for each node bottom-up
  const centerX = new Map<string, number>();

  function assignX(node: ProofNode): number {
    if (node.children.length === 0) {
      const slot = leafSlot.get(node.id) ?? 0;
      const cx = originX + slot * slotW;
      centerX.set(node.id, cx);
      return cx;
    }
    // Parent is centered above children
    const childCenters = node.children.map(c => assignX(c));
    const cx = (Math.min(...childCenters) + Math.max(...childCenters)) / 2;
    centerX.set(node.id, cx);
    return cx;
  }
  assignX(root);

  // Third pass: assign final positions
  function assignPositions(node: ProofNode): void {
    const cx = centerX.get(node.id) ?? width / 2;
    const cy = originY + node.depth * levelH;  // originY already includes NODE_H/2
    positions.set(node.id, { x: cx, y: cy });
    for (const child of node.children) assignPositions(child);
  }
  assignPositions(root);

  void vHeight;
  return positions;
}
