import { describe, it, expect } from 'vitest';
import {
  buildProofTree,
  getVerificationOrder,
  verifyNode,
  buildIvcChain,
  foldIvcStep,
  getConstantProofSize,
  getAllNodes,
  computeTreeLayout,
} from '@/demos/recursive/logic';

describe('buildProofTree', () => {
  it('builds a tree of correct depth', () => {
    const root = buildProofTree(2, null);
    expect(root.depth).toBe(0);
    expect(root.children).toHaveLength(2);
    expect(root.children[0]!.children).toHaveLength(2);
  });

  it('leaf nodes have no children', () => {
    const root = buildProofTree(1, null);
    for (const child of root.children) {
      expect(child.children).toHaveLength(0);
    }
  });

  it('alternates Pallas/Vesta curves by depth', () => {
    const root = buildProofTree(2, null);
    expect(root.curve).toBe('pallas'); // depth 0 = even
    expect(root.children[0]!.curve).toBe('vesta'); // depth 1 = odd
    expect(root.children[0]!.children[0]!.curve).toBe('pallas'); // depth 2 = even
  });

  it('all nodes start as pending', () => {
    const root = buildProofTree(2, null);
    const nodes = getAllNodes(root);
    for (const node of nodes.values()) {
      expect(node.status).toBe('pending');
    }
  });

  it('injects bad proof at target node', () => {
    const root = buildProofTree(1, 'node_1_0');
    const nodes = getAllNodes(root);
    expect(nodes.get('node_1_0')!.isBadProof).toBe(true);
    expect(nodes.get('node_1_1')!.isBadProof).toBe(false);
  });

  it('depth-0 tree is a single node', () => {
    const root = buildProofTree(0, null);
    expect(root.children).toHaveLength(0);
  });
});

describe('getVerificationOrder', () => {
  it('returns bottom-up order', () => {
    const root = buildProofTree(2, null);
    const order = getVerificationOrder(root);
    const nodes = getAllNodes(root);

    // First ID should be a leaf (max depth)
    const firstNode = nodes.get(order[0]!)!;
    expect(firstNode.children).toHaveLength(0);

    // Last ID should be the root
    expect(order[order.length - 1]).toBe(root.id);
  });

  it('includes all nodes', () => {
    const root = buildProofTree(2, null);
    const order = getVerificationOrder(root);
    const nodes = getAllNodes(root);
    expect(order).toHaveLength(nodes.size);
  });

  it('leaves come before their parents', () => {
    const root = buildProofTree(1, null);
    const order = getVerificationOrder(root);
    const rootIndex = order.indexOf(root.id);
    const childIndex = order.indexOf(root.children[0]!.id);
    expect(childIndex).toBeLessThan(rootIndex);
  });
});

describe('verifyNode', () => {
  it('leaf node verifies successfully', () => {
    const root = buildProofTree(1, null);
    const nodes = getAllNodes(root);
    const leaf = nodes.get(root.children[0]!.id)!;
    expect(verifyNode(leaf, nodes)).toBe('verified');
  });

  it('bad proof node fails', () => {
    const root = buildProofTree(0, 'node_0_0');
    const nodes = getAllNodes(root);
    expect(verifyNode(root, nodes)).toBe('failed');
  });

  it('parent with unverified children returns pending', () => {
    const root = buildProofTree(1, null);
    const nodes = getAllNodes(root);
    // Children are still 'pending'
    expect(verifyNode(root, nodes)).toBe('pending');
  });

  it('parent with all verified children returns verified', () => {
    const root = buildProofTree(1, null);
    const nodes = getAllNodes(root);
    // Manually verify children
    for (const child of root.children) {
      const childNode = nodes.get(child.id)!;
      childNode.status = 'verified';
    }
    expect(verifyNode(root, nodes)).toBe('verified');
  });

  it('parent with a failed child returns failed', () => {
    const root = buildProofTree(1, null);
    const nodes = getAllNodes(root);
    nodes.get(root.children[0]!.id)!.status = 'verified';
    nodes.get(root.children[1]!.id)!.status = 'failed';
    expect(verifyNode(root, nodes)).toBe('failed');
  });
});

describe('buildIvcChain', () => {
  it('creates chain of correct length', () => {
    const chain = buildIvcChain(5);
    expect(chain.steps).toHaveLength(5);
  });

  it('alternates Pallas/Vesta curves', () => {
    const chain = buildIvcChain(4);
    expect(chain.steps[0]!.curve).toBe('pallas');
    expect(chain.steps[1]!.curve).toBe('vesta');
    expect(chain.steps[2]!.curve).toBe('pallas');
    expect(chain.steps[3]!.curve).toBe('vesta');
  });

  it('all steps start pending and unfolded', () => {
    const chain = buildIvcChain(3);
    for (const step of chain.steps) {
      expect(step.status).toBe('pending');
      expect(step.folded).toBe(false);
    }
  });

  it('currentFoldIndex starts at -1', () => {
    const chain = buildIvcChain(3);
    expect(chain.currentFoldIndex).toBe(-1);
  });
});

describe('foldIvcStep', () => {
  it('folds the next step', () => {
    const chain = buildIvcChain(3);
    const folded = foldIvcStep(chain);
    expect(folded.currentFoldIndex).toBe(0);
    expect(folded.steps[0]!.folded).toBe(true);
    expect(folded.steps[0]!.status).toBe('verified');
  });

  it('updates accumulator hash after first step', () => {
    const chain = buildIvcChain(3);
    const once = foldIvcStep(chain);
    const twice = foldIvcStep(once);
    expect(twice.steps[1]!.accumulatorHash).not.toBe(chain.steps[1]!.accumulatorHash);
  });

  it('returns same chain when fully folded', () => {
    let chain = buildIvcChain(2);
    chain = foldIvcStep(chain);
    chain = foldIvcStep(chain);
    const extra = foldIvcStep(chain);
    expect(extra.currentFoldIndex).toBe(chain.currentFoldIndex);
  });
});

describe('getConstantProofSize', () => {
  it('returns 288 bytes', () => {
    const size = getConstantProofSize();
    expect(size.bytes).toBe(288);
    expect(size.description).toContain('288');
  });
});

describe('getAllNodes', () => {
  it('returns all nodes in tree', () => {
    const root = buildProofTree(2, null);
    const nodes = getAllNodes(root);
    // depth 2: 1 + 2 + 4 = 7 nodes
    expect(nodes.size).toBe(7);
  });

  it('includes the root', () => {
    const root = buildProofTree(1, null);
    const nodes = getAllNodes(root);
    expect(nodes.has(root.id)).toBe(true);
  });
});

describe('computeTreeLayout', () => {
  it('assigns positions to all nodes', () => {
    const root = buildProofTree(2, null);
    const layout = computeTreeLayout(root, 800, 600);
    const nodes = getAllNodes(root);
    expect(layout.size).toBe(nodes.size);
  });

  it('root is at top of layout', () => {
    const root = buildProofTree(2, null);
    const layout = computeTreeLayout(root, 800, 600);
    const rootPos = layout.get(root.id)!;
    // Root should be near the top (y close to padding=60)
    expect(rootPos.y).toBeLessThan(100);
  });

  it('leaves are below root', () => {
    const root = buildProofTree(1, null);
    const layout = computeTreeLayout(root, 800, 600);
    const rootY = layout.get(root.id)!.y;
    const leafY = layout.get(root.children[0]!.id)!.y;
    expect(leafY).toBeGreaterThan(rootY);
  });
});
