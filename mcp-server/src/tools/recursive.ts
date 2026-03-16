import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fnv1a } from "../lib/hash.js";
import type { ProofNode, ProofStatus, Curve, IvcChain, IvcStep } from "../lib/types.js";

function buildProofTree(depth: number, badProofTarget: string | null): ProofNode {
  function buildNode(currentDepth: number, index: number): ProofNode {
    const id = `node_${currentDepth}_${index}`;
    const curve: Curve = currentDepth % 2 === 0 ? 'pallas' : 'vesta';
    const label = `π_${currentDepth}_${index}`;
    return { id, depth: currentDepth, index, curve, status: 'pending', label, children: currentDepth < depth ? [buildNode(currentDepth + 1, index * 2), buildNode(currentDepth + 1, index * 2 + 1)] : [], isBadProof: badProofTarget === id };
  }
  return buildNode(0, 0);
}

function getAllNodes(root: ProofNode): Map<string, ProofNode> {
  const nodes = new Map<string, ProofNode>();
  function traverse(node: ProofNode): void { nodes.set(node.id, node); for (const child of node.children) traverse(child); }
  traverse(root);
  return nodes;
}

function getVerificationOrder(root: ProofNode): string[] {
  const nodesByDepth: Map<number, ProofNode[]> = new Map();
  let maxDepth = 0;
  function traverse(node: ProofNode): void { const nodes = nodesByDepth.get(node.depth) ?? []; nodes.push(node); nodesByDepth.set(node.depth, nodes); maxDepth = Math.max(maxDepth, node.depth); for (const child of node.children) traverse(child); }
  traverse(root);
  const order: string[] = [];
  for (let d = maxDepth; d >= 0; d--) { const nodes = nodesByDepth.get(d) ?? []; for (const node of nodes) order.push(node.id); }
  return order;
}

function verifyNode(node: ProofNode, allNodes: Map<string, ProofNode>): ProofStatus {
  if (node.isBadProof) return 'failed';
  if (node.children.length === 0) return 'verified';
  for (const child of node.children) {
    const childNode = allNodes.get(child.id);
    if (!childNode) continue;
    if (childNode.status === 'failed') return 'failed';
    if (childNode.status !== 'verified') return 'pending';
  }
  return 'verified';
}

function cloneTree(node: ProofNode): ProofNode {
  return { ...node, children: node.children.map(c => cloneTree(c)) };
}

function setNodeStatus(root: ProofNode, nodeId: string, status: ProofStatus): void {
  if (root.id === nodeId) { root.status = status; return; }
  for (const child of root.children) setNodeStatus(child, nodeId, status);
}

function countNodes(root: ProofNode): { total: number; pallas: number; vesta: number } {
  let total = 0, pallas = 0, vesta = 0;
  function traverse(n: ProofNode) { total++; if (n.curve === 'pallas') pallas++; else vesta++; for (const c of n.children) traverse(c); }
  traverse(root);
  return { total, pallas, vesta };
}

function serializeTree(node: ProofNode): object {
  return { id: node.id, depth: node.depth, index: node.index, curve: node.curve, status: node.status, label: node.label, isBadProof: node.isBadProof, children: node.children.map(c => serializeTree(c)) };
}

function buildIvcChain(length: number): IvcChain {
  const steps: IvcStep[] = [];
  for (let i = 0; i < length; i++) {
    const curve: Curve = i % 2 === 0 ? 'pallas' : 'vesta';
    const inputValue = Math.floor(Math.random() * 100) + 1;
    steps.push({ id: `ivc_step_${i}`, index: i, curve, status: 'pending', accumulatorHash: fnv1a(`step_${i}_input_${inputValue}`), inputValue, folded: false });
  }
  return { steps, currentFoldIndex: -1 };
}

function foldIvcStep(chain: IvcChain): IvcChain {
  const steps = chain.steps.map(s => ({ ...s }));
  const nextIndex = chain.currentFoldIndex + 1;
  if (nextIndex >= steps.length) return chain;
  const currentStep = steps[nextIndex];
  if (!currentStep) return chain;
  steps[nextIndex] = { ...currentStep, folded: true, status: 'verified' };
  if (nextIndex > 0) {
    const prevHash = steps[nextIndex - 1]?.accumulatorHash ?? '';
    steps[nextIndex] = { ...steps[nextIndex]!, accumulatorHash: fnv1a(`${prevHash}_${currentStep.inputValue}`) };
  }
  return { steps, currentFoldIndex: nextIndex };
}

export function registerRecursiveTools(server: McpServer) {
  server.tool(
    "recursive_build_tree",
    "Build a binary recursive proof tree with alternating Pallas/Vesta curves",
    {
      depth: z.number().int().min(1).max(6).describe("Tree depth (1-6)"),
      badProofNode: z.string().optional().describe("Node ID to mark as a bad proof (e.g., 'node_2_1')"),
    },
    async ({ depth, badProofNode }) => {
      const tree = buildProofTree(depth, badProofNode ?? null);
      const counts = countNodes(tree);
      return { content: [{ type: "text" as const, text: JSON.stringify({ tree: serializeTree(tree), totalNodes: counts.total, curves: { pallas: counts.pallas, vesta: counts.vesta } }, null, 2) }] };
    }
  );

  server.tool(
    "recursive_verify_step",
    "Verify the next unverified node in bottom-up order",
    {
      tree: z.any().describe("The proof tree object"),
    },
    async ({ tree: treeInput }) => {
      try {
        const root = treeInput as ProofNode;
        const clone = cloneTree(root);
        const order = getVerificationOrder(clone);
        const allNodes = getAllNodes(clone);
        let verifiedNode: string | null = null;
        for (const nodeId of order) {
          const node = allNodes.get(nodeId);
          if (node && node.status === 'pending') {
            const result = verifyNode(node, allNodes);
            setNodeStatus(clone, nodeId, result);
            allNodes.get(nodeId)!.status = result;
            verifiedNode = nodeId;
            break;
          }
        }
        const remaining = [...allNodes.values()].filter(n => n.status === 'pending').length;
        return { content: [{ type: "text" as const, text: JSON.stringify({ tree: serializeTree(clone), verifiedNode, remainingCount: remaining }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(e) }) }] };
      }
    }
  );

  server.tool(
    "recursive_verify_all",
    "Verify all nodes in the tree in bottom-up order and return the final result",
    {
      tree: z.any().describe("The proof tree object"),
    },
    async ({ tree: treeInput }) => {
      try {
        const root = treeInput as ProofNode;
        const clone = cloneTree(root);
        const order = getVerificationOrder(clone);
        const allNodes = getAllNodes(clone);
        const verifiedOrder: string[] = [];
        for (const nodeId of order) {
          const node = allNodes.get(nodeId);
          if (node && node.status === 'pending') {
            const result = verifyNode(node, allNodes);
            setNodeStatus(clone, nodeId, result);
            allNodes.get(nodeId)!.status = result;
            verifiedOrder.push(nodeId);
          }
        }
        const allValid = clone.status === 'verified';
        return { content: [{ type: "text" as const, text: JSON.stringify({ tree: serializeTree(clone), order: verifiedOrder, allValid, rootStatus: clone.status }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(e) }) }] };
      }
    }
  );

  server.tool(
    "recursive_inject_bad_proof",
    "Rebuild a tree with a specific node marked as a bad proof, then verify to show failure propagation",
    {
      depth: z.number().int().min(1).max(6).describe("Tree depth"),
      nodeId: z.string().describe("Node ID to mark as bad (e.g., 'node_2_1')"),
    },
    async ({ depth, nodeId }) => {
      const tree = buildProofTree(depth, nodeId);
      const clone = cloneTree(tree);
      const order = getVerificationOrder(clone);
      const allNodes = getAllNodes(clone);
      for (const nid of order) {
        const node = allNodes.get(nid);
        if (node && node.status === 'pending') {
          const result = verifyNode(node, allNodes);
          setNodeStatus(clone, nid, result);
          allNodes.get(nid)!.status = result;
        }
      }
      const failedNodes = [...allNodes.values()].filter(n => n.status === 'failed').map(n => n.id);
      const unaffectedNodes = [...allNodes.values()].filter(n => n.status === 'verified').map(n => n.id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ tree: serializeTree(clone), injectedBadProof: nodeId, affectedPath: failedNodes, unaffectedNodes, rootStatus: clone.status }, null, 2) }] };
    }
  );

  server.tool(
    "recursive_ivc_fold",
    "Build and fold an IVC chain, returning the final accumulator state",
    {
      chainLength: z.number().int().min(2).max(20).describe("Number of IVC steps"),
      foldUpTo: z.number().int().min(0).optional().describe("Number of steps to fold (default: all)"),
    },
    async ({ chainLength, foldUpTo }) => {
      let chain = buildIvcChain(chainLength);
      const stepsToFold = foldUpTo ?? chainLength;
      for (let i = 0; i < stepsToFold; i++) {
        chain = foldIvcStep(chain);
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            steps: chain.steps.map(s => ({ id: s.id, curve: s.curve, inputValue: s.inputValue, folded: s.folded, accumulatorHash: s.accumulatorHash })),
            currentFoldIndex: chain.currentFoldIndex,
            foldedCount: chain.steps.filter(s => s.folded).length,
            proofSizeBytes: 288,
          }, null, 2),
        }],
      };
    }
  );
}
