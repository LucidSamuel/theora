import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hashLeaf, hashInternal, type HashFunction } from "../lib/hash.js";
import type { MerkleNode, MerkleTree, MerkleProof } from "../lib/types.js";

// ---------------------------------------------------------------------------
// Pure tree-building logic (no Spring2D animation objects)
// ---------------------------------------------------------------------------

function buildMerkleTree(leaves: string[], mode: HashFunction): MerkleTree | null {
  if (leaves.length === 0) return null;

  let nodes: MerkleNode[] = [];
  for (let i = 0; i < leaves.length; i++) {
    const leafData = leaves[i];
    if (!leafData) continue;
    const hash = hashLeaf(leafData, mode);
    nodes.push({ id: `leaf-${i}`, hash, data: leafData, depth: 0, index: i });
  }

  if (nodes.length > 1 && nodes.length % 2 !== 0) {
    const last = nodes[nodes.length - 1];
    if (last) nodes.push({ ...last, id: `leaf-${nodes.length}-dup`, index: nodes.length });
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
      const hash = hashInternal(left.hash, rightNode.hash, mode);
      nextLevel.push({
        id: `node-${depth + 1}-${i / 2}`,
        hash,
        left,
        right: rightNode,
        depth: depth + 1,
        index: Math.floor(i / 2),
      });
    }
    depth++;
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];
  if (!root) return null;

  const treeDepth = depth;

  function fixDepth(node: MerkleNode, d: number): void {
    node.depth = d;
    if (node.left) fixDepth(node.left, d + 1);
    if (node.right) fixDepth(node.right, d + 1);
  }
  fixDepth(root, 0);

  return {
    root,
    leaves: allLeaves,
    depth: treeDepth,
    nodeCount: allLeaves.length * 2 - 1,
  };
}

function generateProof(tree: MerkleTree, leafIndex: number): MerkleProof | null {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) return null;
  const leaf = tree.leaves[leafIndex];
  if (!leaf) return null;

  const siblings: { hash: string; position: "left" | "right" }[] = [];

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

  for (let i = 1; i < path.length; i++) {
    const parent = path[i - 1];
    const current = path[i];
    if (!parent || !current) continue;
    if (parent.left && parent.right) {
      if (parent.left.id === current.id) {
        siblings.push({ hash: parent.right.hash, position: "right" });
      } else {
        siblings.push({ hash: parent.left.hash, position: "left" });
      }
    }
  }

  return {
    leafIndex,
    leafHash: leaf.hash,
    siblings: siblings.reverse(),
    root: tree.root.hash,
  };
}

function verifyMerkleProof(proof: MerkleProof, mode: HashFunction): boolean {
  let currentHash = proof.leafHash;
  for (const sibling of proof.siblings) {
    if (sibling.position === "right") {
      currentHash = hashInternal(currentHash, sibling.hash, mode);
    } else {
      currentHash = hashInternal(sibling.hash, currentHash, mode);
    }
  }
  return currentHash === proof.root;
}

/** Strip any non-JSON-serialisable fields before returning tree data. */
function serializeNode(node: MerkleNode): object {
  const result: Record<string, unknown> = {
    id: node.id,
    hash: node.hash,
    depth: node.depth,
    index: node.index,
  };
  if (node.data !== undefined) result["data"] = node.data;
  if (node.left) result["left"] = serializeNode(node.left);
  if (node.right) result["right"] = serializeNode(node.right);
  return result;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerMerkleTools(server: McpServer): void {
  server.tool(
    "merkle_build",
    "Build a Merkle tree from leaf data and return the root hash and full tree structure",
    {
      leaves: z
        .array(z.string())
        .min(1)
        .describe("Array of leaf data strings"),
      hashFunction: z
        .enum(["sha256", "fnv1a"])
        .default("sha256")
        .describe("Hash function to use"),
    },
    async ({ leaves, hashFunction }) => {
      try {
        const tree = buildMerkleTree(leaves, hashFunction);
        if (!tree) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Failed to build tree" }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  root: tree.root.hash,
                  depth: tree.depth,
                  leafCount: tree.leaves.length,
                  nodeCount: tree.nodeCount,
                  tree: serializeNode(tree.root),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: String(e) }) },
          ],
        };
      }
    }
  );

  server.tool(
    "merkle_prove",
    "Generate a Merkle inclusion proof for a specific leaf",
    {
      leaves: z.array(z.string()).min(1).describe("Array of leaf data strings"),
      leafIndex: z
        .number()
        .int()
        .min(0)
        .describe("Zero-based index of the leaf to prove"),
      hashFunction: z.enum(["sha256", "fnv1a"]).default("sha256"),
    },
    async ({ leaves, leafIndex, hashFunction }) => {
      try {
        const tree = buildMerkleTree(leaves, hashFunction);
        if (!tree) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Failed to build tree" }),
              },
            ],
          };
        }
        const proof = generateProof(tree, leafIndex);
        if (!proof) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Invalid leaf index: ${leafIndex}`,
                }),
              },
            ],
          };
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(proof, null, 2) },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: String(e) }) },
          ],
        };
      }
    }
  );

  server.tool(
    "merkle_verify",
    "Verify a Merkle inclusion proof",
    {
      proof: z
        .object({
          leafIndex: z.number().int(),
          leafHash: z.string(),
          siblings: z.array(
            z.object({
              hash: z.string(),
              position: z.enum(["left", "right"]),
            })
          ),
          root: z.string(),
        })
        .describe("The Merkle proof to verify"),
      hashFunction: z.enum(["sha256", "fnv1a"]).default("sha256"),
    },
    async ({ proof, hashFunction }) => {
      try {
        const valid = verifyMerkleProof(proof, hashFunction);

        // Re-run the hash chain to expose per-level intermediate values.
        const steps: { level: number; currentHash: string }[] = [];
        let currentHash = proof.leafHash;
        steps.push({ level: 0, currentHash });
        for (let i = 0; i < proof.siblings.length; i++) {
          const s = proof.siblings[i]!;
          currentHash =
            s.position === "right"
              ? hashInternal(currentHash, s.hash, hashFunction)
              : hashInternal(s.hash, currentHash, hashFunction);
          steps.push({ level: i + 1, currentHash });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { valid, steps, expectedRoot: proof.root },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: String(e) }) },
          ],
        };
      }
    }
  );
}
