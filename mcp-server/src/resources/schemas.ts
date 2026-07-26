import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_CIRCUITS } from "../lib/dsl/defaults.js";
import { TRACE_HASH_PREFIX } from "../lib/traceSchema.js";

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
  { id: "constraint-editor", name: "Constraint Editor", description: "Author R1CS circuits in the theora DSL: parse, compile, analyze for underconstraint bugs, check witnesses, enumerate exhaustively" },
  { id: "proof-trace", name: "Proof Trace", description: "Validate trace.json proof transcripts and compute canonical transcript fingerprints" },
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
  "constraint-editor": ["dsl_parse", "dsl_compile", "dsl_analyze", "dsl_witness_check", "dsl_exhaustive", "build_editor_url"],
  "proof-trace": ["trace_validate", "trace_fingerprint"],
};

// Tools that are not tied to a single demo.
const GENERAL_TOOLS = ["build_demo_url"];

const DSL_GRAMMAR_DOC = `# theora constraint DSL

Arithmetic circuits over a prime field (default GF(101)), compiled to R1CS.

## Grammar

\`\`\`
program    := statement*
statement  := 'input'  IDENT
            | 'public' IDENT
            | 'wire'   IDENT '=' expr
            | 'assert' expr '==' expr
            | '//' comment-to-end-of-line
expr       := term (('+' | '-') term)*
term       := factor ('*' factor)?          // at most ONE multiplication per expression
factor     := NUMBER | IDENT | '(' expr ')' | '-' factor
\`\`\`

Literals are non-negative integers, reduced mod p.

## Semantics

- Wire 0 is the constant \`one\`.
- Only a true multiplication (non-constant x non-constant) emits an R1CS
  multiplication constraint A*B=C; additions, subtractions, and scalar
  multiplications are free linear combinations.
- \`wire x = expr\` emits a definition constraint binding x.
- \`assert L == R\` emits an assertion constraint (L-R)*1 = 0.
- Expressions with more than one multiplication are rejected: split them
  into intermediate wires (this enforces R1CS degree-2 form).

## Example circuits

${DEFAULT_CIRCUITS.map((c) => `### ${c.name} (\`${c.id}\`)\n\n\`\`\`\n${c.source}\n\`\`\`\n\nDefault inputs: ${JSON.stringify(c.defaultInputs)}`).join("\n\n")}

## Live editor links

Use the \`build_editor_url\` tool (or \`dsl_analyze\` / \`dsl_witness_check\`,
which include an \`editorUrl\`) to open any circuit in the theora web app.
`;

const TRACE_SCHEMA_DOC = {
  description: "theora trace.json v1 — proof-execution transcript format. See /llms.txt and DESIGN-PROOF-TRACE.md in the theora repo.",
  hashContract: {
    preimage: `${TRACE_HASH_PREFIX}|<meta.protocol>|<meta.field>|<canonicalJSON(normalized transcript)>`,
    algorithm: "sha256, hex output",
    canonicalization: "object keys sorted lexicographically, arrays in order, no whitespace, undefined omitted; normalization drops empty data arrays and ok flags on non-check events",
    excluded: ["meta.system", "meta.label", "meta.createdAt", "constraints", "rounds"],
    pinnedVector: {
      note: "worked sumcheck example from DESIGN-PROOF-TRACE.md",
      hash: "227124dcc5e09f7f1efcff1a80f856871031f36c8cc1ba75f9c40523214a9a42",
    },
  },
  schema: {
    type: "object",
    required: ["version", "meta", "transcript"],
    properties: {
      version: { const: 1 },
      meta: {
        type: "object",
        required: ["system", "protocol", "field"],
        properties: {
          system: { type: "string" },
          protocol: { type: "string" },
          field: { type: "string", pattern: "^\\d+$", description: "decimal prime modulus >= 2" },
          label: { type: "string" },
          createdAt: { type: "string" },
        },
      },
      transcript: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["t", "round", "label"],
          properties: {
            t: { enum: ["absorb", "challenge", "commit", "fold", "query", "check"] },
            round: { type: "integer", minimum: 0 },
            label: { type: "string" },
            data: { type: "array", items: { type: "string" } },
            ok: { type: "boolean", description: "only on check events" },
          },
        },
      },
      constraints: {
        type: "object",
        required: ["wires", "constraints"],
        properties: {
          wires: { type: "array", items: { type: "object", required: ["id", "name", "type"], properties: { id: { type: "integer" }, name: { type: "string" }, type: { enum: ["input", "public", "intermediate", "one"] } } } },
          constraints: { type: "array", items: { type: "object", required: ["id", "a", "b", "c"], description: "a/b/c are arrays of [wireId, decimalCoeff] pairs sorted by wireId" } },
          witness: { type: "object", description: "wireId (string) -> decimal value" },
        },
      },
      rounds: { type: "array", items: { type: "object", required: ["round"], properties: { round: { type: "integer" }, label: { type: "string" }, stats: { type: "object" } } } },
    },
  },
};

const THEORA_JSON_SCHEMA = {
  type: "object",
  properties: {
    demo: { type: "string", enum: DEMOS.map(d => d.id) },
    state: { type: "object", description: "Demo-specific state payload" },
  },
  required: ["demo", "state"],
  description: "theora import/export envelope for sharing demo states",
};

export function registerResources(server: McpServer) {
  server.resource(
    "demos-list",
    "theora://demos/list",
    async () => ({
      contents: [{
        uri: "theora://demos/list",
        mimeType: "application/json",
        text: JSON.stringify({ demos: DEMOS, totalTools: Object.values(DEMO_TOOLS).flat().length + GENERAL_TOOLS.length, generalTools: GENERAL_TOOLS }, null, 2),
      }],
    })
  );

  server.resource(
    "dsl-grammar",
    "theora://dsl/grammar",
    async () => ({
      contents: [{
        uri: "theora://dsl/grammar",
        mimeType: "text/markdown",
        text: DSL_GRAMMAR_DOC,
      }],
    })
  );

  server.resource(
    "trace-schema",
    "theora://trace/schema",
    async () => ({
      contents: [{
        uri: "theora://trace/schema",
        mimeType: "application/json",
        text: JSON.stringify(TRACE_SCHEMA_DOC, null, 2),
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
