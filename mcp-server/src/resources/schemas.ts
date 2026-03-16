import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEMOS = [
  { id: "merkle", name: "Merkle Tree", description: "Build hash trees, generate inclusion proofs, step-through verification" },
  { id: "polynomial", name: "Polynomial Commitments (KZG)", description: "Polynomial evaluation, Lagrange interpolation, simulated KZG commitment scheme" },
  { id: "accumulator", name: "RSA Accumulator", description: "Cryptographic accumulator with membership and non-membership proofs" },
  { id: "recursive", name: "Recursive Proofs", description: "Proof composition trees and IVC chains with Pallas/Vesta curve cycling" },
  { id: "elliptic", name: "Elliptic Curves", description: "Finite-field point enumeration, addition, scalar multiplication" },
  { id: "fiat-shamir", name: "Fiat-Shamir", description: "Interactive vs non-interactive transcript comparison, forgery detection" },
  { id: "circuit", name: "R1CS Circuits", description: "Constraint evaluation, witness satisfaction, underconstrained exploit detection" },
  { id: "lookup", name: "Lookup Arguments", description: "Table/wire multiset containment checking" },
  { id: "pipeline", name: "Proof Pipeline", description: "End-to-end 7-stage proof flow with fault injection" },
];

const DEMO_TOOLS: Record<string, string[]> = {
  merkle: ["merkle_build", "merkle_prove", "merkle_verify"],
  polynomial: ["polynomial_evaluate", "polynomial_interpolate", "polynomial_kzg_commit", "polynomial_kzg_open", "polynomial_kzg_verify"],
  accumulator: ["accumulator_create", "accumulator_add", "accumulator_membership_witness", "accumulator_nonmembership_proof", "accumulator_batch_add"],
  recursive: ["recursive_build_tree", "recursive_verify_step", "recursive_verify_all", "recursive_inject_bad_proof", "recursive_ivc_fold"],
  elliptic: ["elliptic_enumerate", "elliptic_add", "elliptic_scalar_multiply"],
  "fiat-shamir": ["fiat_shamir_interactive", "fiat_shamir_noninteractive", "fiat_shamir_forge"],
  circuit: ["circuit_evaluate", "circuit_find_exploit"],
  lookup: ["lookup_check"],
  pipeline: ["pipeline_run"],
};

const THEORA_JSON_SCHEMA = {
  type: "object",
  properties: {
    demo: { type: "string", enum: DEMOS.map(d => d.id) },
    state: { type: "object", description: "Demo-specific state payload" },
  },
  required: ["demo", "state"],
  description: "Theora import/export envelope for sharing demo states",
};

export function registerResources(server: McpServer) {
  server.resource(
    "demos-list",
    "theora://demos/list",
    async () => ({
      contents: [{
        uri: "theora://demos/list",
        mimeType: "application/json",
        text: JSON.stringify({ demos: DEMOS, totalTools: Object.values(DEMO_TOOLS).flat().length }, null, 2),
      }],
    })
  );

  for (const demo of DEMOS) {
    server.resource(
      `demo-${demo.id}`,
      `theora://demos/${demo.id}/info`,
      async () => ({
        contents: [{
          uri: `theora://demos/${demo.id}/info`,
          mimeType: "application/json",
          text: JSON.stringify({
            ...demo,
            tools: DEMO_TOOLS[demo.id] ?? [],
            importExportSchema: THEORA_JSON_SCHEMA,
          }, null, 2),
        }],
      })
    );
  }
}
