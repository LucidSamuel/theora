import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const PRIMITIVES: Record<string, { beginner: string; intermediate: string; advanced: string }> = {
  merkle: {
    beginner: "A Merkle tree is like a fingerprint for a list of data. Each piece of data gets hashed, then pairs of hashes are combined and hashed again, building up to a single 'root' hash. If any data changes, the root changes. You can prove a specific item is in the tree by showing just a few hashes (the 'proof path') instead of the entire list — this is O(log n) efficient.",
    intermediate: "A Merkle tree is a binary hash tree where leaves are H(data) and internal nodes are H(left || right). The root commits to all leaves. An inclusion proof consists of O(log n) sibling hashes along the path from leaf to root. Verification recomputes hashes bottom-up and checks against the known root. Domain separation (\\x00 for leaves, \\x01 for internals) prevents second-preimage attacks.",
    advanced: "Merkle trees provide binding vector commitments with O(log n) opening proofs. The security reduction is to collision resistance of the hash function. Variants include sparse Merkle trees (for key-value maps with non-membership proofs), Merkle Mountain Ranges (append-only), and Verkle trees (using vector commitments like KZG for O(1) proof size at the cost of trusted setup). In ZK systems, Merkle proofs are circuit-expensive due to hash constraints — Poseidon/Rescue are preferred over SHA-256 for in-circuit use.",
  },
  polynomial: {
    beginner: "A polynomial commitment scheme lets you 'lock in' a polynomial (like a math formula) and later prove what value it gives at any point, without revealing the whole formula. Think of it like sealing an answer in an envelope — you can prove what the answer is at specific points without opening the whole envelope.",
    intermediate: "KZG commitments use elliptic curve pairings: commit C = [p(s)]₁ using a trusted setup {[sⁱ]₁}. To prove p(z) = v, compute quotient q(x) = (p(x) - v)/(x - z) and send π = [q(s)]₁. Verification: e(C - [v]₁, [1]₂) = e(π, [s - z]₂). The binding property reduces to discrete log; hiding requires randomization.",
    advanced: "KZG provides O(1) commitment and proof size with O(n) prover time. The trusted setup produces structured reference string (SRS) {[sⁱ]₁, [s]₂}. Batch opening via random evaluation reduces k proofs to 1. KZG underpins PLONK (where the polynomial encodes the entire circuit trace), Verkle trees, and data availability sampling (DAS) in Ethereum's danksharding. Alternatives: FRI (no trusted setup, O(log² n) proofs), IPA (no pairings, O(n) verification), Bulletproofs (logarithmic proof size).",
  },
  accumulator: {
    beginner: "An RSA accumulator is like a single number that 'contains' a whole set of values. You can prove any value is in the set (membership proof) or not in the set (non-membership proof) using just this one number and a short proof — without revealing the rest of the set.",
    intermediate: "An RSA accumulator computes acc = g^(∏ primes) mod n where n = p·q is an RSA modulus. Membership witness for element e: w = g^(∏ primes except e) mod n, verified by w^e ≡ acc (mod n). Non-membership uses Bezout's identity: given gcd(e, ∏primes) = 1, find a,b such that a·e + b·∏primes = 1, then w = g^a, verified by w^e · acc^b ≡ g (mod n).",
    advanced: "RSA accumulators provide constant-size set commitments under the strong RSA assumption (hardness of finding arbitrary roots mod n). Dynamic accumulators support efficient updates: adding element e' multiplies the exponent, and existing witnesses update via w' = w^(e'). Batching uses the product of exponents. Limitations: requires trusted setup for n (unknown factorization), and non-membership proofs need extended GCD which is O(n) in set size. Alternatives: bilinear accumulators (from pairings), Merkle trees (hash-based, no trusted setup).",
  },
  recursive: {
    beginner: "Recursive proofs are proofs that verify other proofs. Imagine a chain: proof A proves something, then proof B proves that proof A is valid, then proof C proves proof B is valid. Each link in the chain is constant-size, so you can compress unlimited computation into a single small proof.",
    intermediate: "Recursive proof composition uses a cycle of elliptic curves (e.g., Pasta: Pallas and Vesta) where each curve's scalar field equals the other's base field. This allows the verifier circuit of one proof system to be efficiently expressed in the other. IVC (Incrementally Verifiable Computation) folds proofs step-by-step, maintaining a constant-size accumulator regardless of computation length.",
    advanced: "Nova-style IVC uses folding schemes instead of full recursive SNARKs: the prover folds two R1CS instances into one of the same size, deferring the expensive SNARK to the final step. This gives O(1) prover overhead per step (vs O(n log n) for recursive SNARKs). The Pasta cycle (Pallas: y² = x³ + 5 over F_p, Vesta: y² = x³ + 5 over F_q where p = scalar field of Vesta, q = scalar field of Pallas) enables efficient in-circuit verification. Supernova extends to non-uniform IVC. ProtoStar and HyperNova generalize to higher-degree constraints.",
  },
  elliptic: {
    beginner: "Elliptic curves are special math curves used in cryptography. Points on the curve can be 'added' together following specific rules, and this addition is easy to do forward but extremely hard to reverse — this one-way property is what makes encryption secure.",
    intermediate: "Over a finite field F_p, an elliptic curve E: y² = x³ + ax + b defines a group where point addition uses the chord-and-tangent rule. The group order #E(F_p) ≈ p (Hasse bound). Scalar multiplication kP (double-and-add) is the one-way function: given P and kP, finding k is the Elliptic Curve Discrete Logarithm Problem (ECDLP). Used in ECDSA, EdDSA, Diffie-Hellman, and pairing-based cryptography.",
    advanced: "For ZK proof systems, curve choice impacts efficiency: BN254 (pairing-friendly, 128-bit security debated), BLS12-381 (128-bit security, used in Ethereum), Pasta cycle (Pallas/Vesta, no pairings, designed for recursive proofs). The embedding degree determines pairing efficiency. Curve arithmetic in circuits is expensive — a single EC addition costs ~thousands of R1CS constraints, motivating cycle-of-curves approaches where the verifier operates natively over the scalar field.",
  },
  "fiat-shamir": {
    beginner: "Fiat-Shamir is a trick that turns an interactive proof (where a verifier asks questions) into a non-interactive one (where no verifier is needed). Instead of waiting for a random challenge from a verifier, the prover generates the challenge by hashing their own commitment — making it impossible to cheat by choosing the challenge first.",
    intermediate: "The Fiat-Shamir heuristic replaces the verifier's random challenge with H(transcript) where the transcript includes all prior messages (statement, public key, commitment). Security requires the hash to behave as a random oracle. A 'Frozen Heart' vulnerability occurs when the commitment is omitted from the hash input — the challenge becomes predictable, enabling forgery.",
    advanced: "Fiat-Shamir in the random oracle model transforms any public-coin interactive proof into a non-interactive one. The transform preserves soundness (with tighter bounds) and zero-knowledge. Weak Fiat-Shamir (incomplete transcript hashing) has led to real-world vulnerabilities in Plonk, Bulletproofs, and other systems — see the 'Frozen Heart' disclosure series. In practice, use a domain-separated hash (e.g., STROBE, Merlin transcripts) and include all public inputs in the transcript. The Fiat-Shamir transform does not apply to non-public-coin protocols.",
  },
  circuit: {
    beginner: "An arithmetic circuit is a way to express a computation as a series of addition and multiplication gates — like a flowchart for math. R1CS (Rank-1 Constraint System) encodes these gates as matrix equations. A 'witness' is the set of all values that flow through the circuit. If the witness satisfies all constraints, the computation is valid.",
    intermediate: "R1CS encodes constraints as (A·w) ⊙ (B·w) = (C·w) where w is the witness vector and A, B, C are sparse matrices. Each row represents one multiplication gate. An underconstrained circuit is missing constraints — it accepts witnesses that don't correspond to valid computations. This is a critical soundness bug: a malicious prover can forge proofs for false statements.",
    advanced: "R1CS is the constraint system used by Groth16 and early SNARKs. PLONK uses a more flexible arithmetization (PLONKish: custom gates + lookup tables). R1CS requires O(n) constraints per multiplication gate; additions are 'free' (linear combinations). Common vulnerabilities: underconstrained intermediate wires, missing range checks, incorrect handling of field overflow. Tools like Circom's --inspect flag and formal verification (e.g., Ecne, Picus) help catch underconstraint bugs.",
  },
  lookup: {
    beginner: "A lookup argument proves that certain values come from an approved list (the 'table'), without revealing which specific entries were used. It's like showing that every answer on your test matches one of the valid answers in the answer key, without revealing the key itself.",
    intermediate: "Lookup arguments (Plookup, LogUp, Lasso) prove that a vector of wire values is a subset of a table. The prover shows that the multiset of wire values is contained in the multiset of table values. This is more efficient than encoding range checks or bitwise operations as R1CS constraints — a single lookup replaces hundreds of constraints.",
    advanced: "Modern lookup arguments (LogUp, Lasso) achieve O(n log n) prover time and O(1) proof overhead. LogUp uses logarithmic derivatives: ∑ 1/(X - wᵢ) = ∑ mⱼ/(X - tⱼ) where mⱼ are multiplicities. Lasso uses offline memory checking for structured tables (e.g., AND, XOR) decomposed via subtables, avoiding materialization of the full table. CCS (Customizable Constraint System) unifies R1CS and lookup-based arithmetization. Lookup singularity: recent work shows lookups alone can replace all arithmetic constraints.",
  },
  pipeline: {
    beginner: "A proof pipeline chains together multiple cryptographic steps to create a complete zero-knowledge proof. Starting from a secret input, it goes through: computing the answer, checking constraints, encoding as a polynomial, committing, generating a challenge, opening the commitment, and finally verifying everything matches up.",
    intermediate: "The pipeline implements: (1) Witness computation: f(x) = x² + x + 5 with intermediate wires, (2) R1CS constraint checking, (3) Lagrange interpolation encoding wires as a polynomial, (4) Polynomial commitment via hashing, (5) Fiat-Shamir challenge derivation, (6) Polynomial opening with quotient computation, (7) Verification of commitment + evaluation + quotient consistency. Fault injection at each stage demonstrates how different attacks are caught.",
    advanced: "This pipeline mirrors real SNARK constructions (simplified): arithmetization → polynomial encoding → commitment → random evaluation → opening proof → verification. The four fault modes correspond to real vulnerability classes: bad witness (prover cheating), polynomial corruption (commitment manipulation), weak Fiat-Shamir (Frozen Heart), bad opening (proof forgery). In production systems, each stage involves finite field arithmetic, FFTs for polynomial multiplication, and elliptic curve multi-scalar multiplication.",
  },
};

export function registerPrompts(server: McpServer) {
  server.prompt(
    "explain_primitive",
    "Get a structured explanation of a cryptographic primitive at a chosen difficulty level",
    {
      primitive: z.enum(["merkle", "polynomial", "accumulator", "recursive", "elliptic", "fiat-shamir", "circuit", "lookup", "pipeline"]).describe("Which cryptographic primitive to explain"),
      level: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate").describe("Explanation depth"),
    },
    ({ primitive, level }) => {
      const content = PRIMITIVES[primitive];
      if (!content) return { messages: [{ role: "user", content: { type: "text", text: `Unknown primitive: ${primitive}` } }] };
      const explanation = content[level];
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Explain the "${primitive}" cryptographic primitive at the ${level} level.\n\nHere is context to ground your explanation:\n\n${explanation}\n\nUse this as a foundation. You may expand with examples, analogies, or connections to other primitives. If the user has follow-up questions, use the theora MCP tools to demonstrate concepts with concrete values.`,
          },
        }],
      };
    }
  );

  server.prompt(
    "audit_circuit",
    "Analyze a circuit description for common vulnerability patterns (underconstraint, missing range checks, etc.)",
    {
      circuitDescription: z.string().describe("Description of the circuit to audit (constraints, wire names, computation)"),
    },
    ({ circuitDescription }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are a ZK circuit auditor. Analyze the following circuit for vulnerabilities:\n\n${circuitDescription}\n\nCheck for:\n1. **Underconstrained wires** — intermediate values not fully determined by constraints\n2. **Missing range checks** — values that could overflow the field\n3. **Redundant constraints** — equations that don't add information\n4. **Soundness gaps** — witness assignments that satisfy constraints but don't correspond to valid computations\n\nUse the circuit_evaluate and circuit_find_exploit tools to test specific witness values if applicable. Provide a severity rating (Critical/High/Medium/Low) for each finding.`,
        },
      }],
    })
  );

  server.prompt(
    "generate_test_vectors",
    "Generate test vectors for a specific theora demo",
    {
      demo: z.enum(["merkle", "polynomial", "accumulator", "recursive", "elliptic", "fiat-shamir", "circuit", "lookup", "pipeline"]).describe("Which demo to generate test vectors for"),
      count: z.number().int().min(1).max(20).default(5).describe("Number of test vectors to generate"),
    },
    ({ demo, count }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Generate ${count} test vectors for the theora "${demo}" demo. Each test vector should include:\n\n1. **Input** — the exact parameters to pass to the demo's MCP tools\n2. **Expected output** — what the tools should return\n3. **What it tests** — which property or edge case this vector exercises\n\nUse the actual theora MCP tools to compute the expected outputs — do not guess. Cover both happy paths and edge cases (empty inputs, boundary values, invalid inputs that should error gracefully).`,
        },
      }],
    })
  );
}
