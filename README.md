# Theora

Interactive cryptographic visualizer. Merkle trees, polynomial commitments, RSA accumulators, recursive proofs, elliptic curves, Fiat-Shamir transcripts, R1CS circuits, and lookup arguments — animated, shareable, and embeddable.

\---

## Why This Exists

The ZK/crypto visualization landscape is thin. zkREPL is a code playground, not a visualizer. Merkle tree demos are static and single-purpose. Conference talks rely on terminal output. Blog posts use static diagrams. Built this due to a lack of a  unified, interactive, animated tool that lets you poke at the actual cryptographic primitives and build intuition.

---

## Demos

### Merkle Tree

Build a binary hash tree from arbitrary data, generate inclusion proofs, and step through verification one hash at a time.

- **Add, edit, remove leaves** in real time: tree rebuilds automatically
- **Two hash functions**: SHA-256 (cryptographic) and FNV-1a (fast, for large trees >64 leaves)
- **Proof generation**: Click any leaf to generate a Merkle proof with sibling hashes
- **Step-through verification**: Walk forward/backward through proof steps, watching the running hash update at each level
- **Proof export**: Copy as JSON, download as `.json` file, or copy an audit summary
- **Animated canvas**: Spring-physics node positioning, proof path highlighting in purple with glow effects, hover tooltips showing full hashes

### Polynomial Commitments (KZG)

Visualize polynomial evaluation, Lagrange interpolation, and a simulated KZG commitment scheme.

- **Coefficients mode**: Drag sliders to reshape the polynomial curve in real time
- **Lagrange mode**: Click the canvas to place interpolation points, polynomial fits automatically
- **Add/remove terms** dynamically (constant through arbitrary degree)
- **Evaluate at any x**: Mark evaluation points on the curve with labels
- **Polynomial comparison**: Overlay a second polynomial to see intersections (the count hints at the Schwartz-Zippel bound)
- **KZG flow** (4-step simulation):
  1. **Commit**: hash coefficients to create a binding commitment
  2. **Challenge**: verifier picks a random evaluation point z
  3. **Reveal & Prove**: compute p(z), build quotient polynomial q(x) via synthetic division, hash as proof
  4. **Verify**:  check that commitment, revealed value, and proof are consistent
- **Auto-scale**: Adjusts view bounds to fit the polynomial

### RSA Accumulator

Add prime numbers to a cryptographic accumulator and prove membership or non-membership.

- **Accumulator mechanics**: g^(product of all primes) mod n, using modular exponentiation with a 128-bit composite modulus
- **Add elements**: Enter a specific prime or generate a random one (3–997)
- **Batch add**: Paste comma-separated primes to add in a single exponentiation
- **Membership witness**: Select an element, compute a witness, verify that witness^element = accumulator (mod n)
- **Non-membership proof**: Target a prime not in the set, compute witness via extended GCD, verify using the Bezout identity
- **Orbital visualization**: Elements orbit the accumulator on concentric rings with spring-physics animation, fade-in on creation
- **Operation history**: Right panel tracks every add, remove, batch-add, and verify with before/after accumulator values and relative timestamps
- **Inline error handling**: Invalid input shows an auto-dismissing error banner (no alert() popups)

### Recursive Proofs

Visualize proof composition trees and incremental verifiable computation (IVC) chains.

- **Tree mode**:
  - Build a binary proof tree (depth 2–5)
  - Each node is a proof that verifies its children
  - Pallas/Vesta curve cycle alternates at each depth level (Pasta curves)
  - Bottom-up verification: auto-run or step manually
  - **Follow camera**: spring-animated camera tracks each node during auto-verification, then zooms out to show the full tree on completion
  - **Bad proof injection**: Select a leaf node from the dropdown to mark it invalid, rebuild, and watch failure propagate upward through the tree; shared URLs and embeds restore the injected fault
  - **Node ID tooltips**: Hover any node to see its display label and internal ID (e.g. `π_2_1 (id: node_2_1)`) in the info panel
  - Adjustable verification speed (100–1000ms per step)
  - **Replay**: press play again after completion to rebuild and re-run the verification sequence
- **IVC mode**:
  - Build a chain of computation steps (length 3–10)
  - Fold steps one at a time, compressing the chain into an accumulator
  - Each fold updates the accumulator hash incorporating the previous step
  - Pasta curve cycle applies to each step
- **Statistics panel**: Total nodes, verified/failed counts, current step, accumulator hash, and constant proof size (~288 bytes regardless of depth)
- **Status legend**: bold color-coded indicators (Pending, Verifying, Verified, Failed) fixed at the bottom of the canvas, centered regardless of pan/zoom
- **Display toggles**: Show/hide Pasta curve labels and proof size annotations

### Elliptic Curves

- **Finite-field point arithmetic**: Enumerate curve points over a small prime field and verify addition stays on-curve
- **Point addition / doubling**: Pick two points and inspect their sum
- **Scalar multiplication**: Step through double-and-add
- **Pasta cycle bridge**: Quick summary of how Pallas and Vesta line up for recursion

### Fiat-Shamir

- **Interactive vs non-interactive**: Compare verifier randomness against transcript hashing
- **Broken transcript mode**: Omit the commitment from the hash and watch the challenge become predictable
- **Forgery demo**: Construct a proof that only verifies in the broken mode

### R1CS Circuits

- **Witness controls**: Adjust `x`, `y`, and `z` for a small arithmetic circuit
- **Constraint inspection**: See which equations pass or fail
- **Underconstrained example**: Toggle a broken circuit where the output relation is missing

### Lookup Arguments

- **Editable tables and wires**: Enter comma-separated values
- **Multiset comparison**: Sort and compare table rows against queried wires
- **Failure cases**: Detect missing values and multiplicity mismatches

### Proof Pipeline

End-to-end walkthrough of a complete proof system: Witness, Constraints, Polynomial, Commit, Challenge, Open, Verify.

- **7-stage flow**: f(x) = x² + x + 5 with R1CS encoding, Lagrange interpolation, simulated KZG, Fiat-Shamir challenge
- **Fault injection**: 4 attack modes (bad witness, corrupted polynomial, weak Fiat-Shamir, bad opening) — step through to see exactly where verification breaks
- **Fault propagation visualization**: connections and flow particles downstream of a fault turn red, tracing corruption through the pipeline
- **Linked state**: each stage links to its underlying demo (Circuit, Polynomial, Fiat-Shamir) with exact state handoff
- **Auto-play** with speed control, stage map navigation

---

## Features

### Sharing & Embedding

Every demo state encodes into the URL. Share a link and the recipient sees exactly what you see.

- **Share URL**: Full state in query parameters (Base64-encoded)
- **Hash URL**: Cleaner format using URL fragment (`#merkle|{...}`)
- **Embed iframe**: One-click copy of an `<iframe>` snippet for embedding in docs, blog posts, or Notion pages
- **PNG export**: Screenshot the canvas to a downloadable image (auto-fits content to view before capture)
- **Audit summary**: Copy a timestamped JSON payload of the entire demo state

#### Embedding

Add an interactive diagram to any page:

```html
<iframe
  src="https://lucidsamuel.github.io/theora?embed=merkle&m=..."
  width="100%"
  height="620"
  style="border:0; border-radius:16px;">
</iframe>
```

Embed mode hides the sidebar and header, showing only the canvas with a floating toolbar (play/pause + settings). Works for every demo, including `elliptic`, `fiat-shamir`, `circuit`, and `lookup`. On the main view, the sidebar is collapsible via a floating settings icon on the canvas.

### GitHub Import

Theora now supports structured import from public GitHub and Gist sources.

Available in v1:

- **Import from public raw GitHub URLs**
- **Import from GitHub blob URLs** (`github.com/.../blob/...`) via automatic raw URL conversion
- **Import from public Gists** by reading `theora.json` or the first JSON file
- **Export current supported demos** as `theora.json`
- **Copy JSON + open Gist** helper workflow for manual public gist creation
- **Strict schema**: `{"demo":"...","state":{...}}`
- **Supported demos**: all 9 — `merkle`, `polynomial`, `accumulator`, `recursive`, `pipeline`, `fiat-shamir`, `circuit`, `elliptic`, `lookup`

Still intentionally out of scope:

- Full repo ingestion
- Private repo auth
- Arbitrary codebase parsing
- "Connect GitHub and auto-detect everything"

Example import payload:

```json
{
  "demo": "merkle",
  "state": {
    "leaves": ["alpha", "beta", "gamma", "delta"],
    "selectedLeafIndex": 2
  }
}
```

The goal is reproducibility, collaboration, and easy sharing of canonical examples for teaching, audits, and research.

### Dark/Light Theme

- Toggle between dark and light mode from the header
- Persists to `localStorage`
- Falls back to system preference (`prefers-color-scheme`)
- All UI elements respond via CSS custom properties on the `data-theme` attribute — no Tailwind `dark:` classes

### Contextual Info Panel

A toggleable right-side panel that updates based on what you're doing:

- Hover a Merkle node: see its hash and whether it's on the proof path
- Select an accumulator element: see its prime and suggested next steps
- Step through a KZG flow: panel explains the current stage
- Includes next-step suggestions so you always know what to try

### Canvas Rendering

- **Spring physics**: All node positions use damped spring animations for smooth, natural movement
- **60fps animation loop**: `requestAnimationFrame` with delta-time physics (frame-rate independent)
- **HiDPI aware**: Renders at device pixel ratio for sharp output on retina displays
- **Responsive**: `ResizeObserver` recalculates layout when the container resizes
- **Interactive**: Mouse tracking, click-to-select, hover detection with visual feedback
- **Canvas toolbar**: compact frosted-glass bar with pointer/pan mode, zoom in/out, and fit-to-view reset; draggable to reposition
- **Follow camera**: spring-animated camera tracking for verification sequences (recursive demo)
- **Collapsible sidebar**: floating settings icon toggles the control panel for full-width canvas on any demo

---

## Who Is This For

### Engineers building on ZK systems
Open the polynomial demo, drag coefficients, step through the KZG flow, and see that two different degree-d polynomials can agree on at most d points. The abstract becomes concrete in 30 seconds. Useful for onboarding new hires, debugging intuition, and writing better SDK documentation.

### Cryptographers and researchers
The recursive proof tree with Pasta cycle coloring instantly communicates the curve cycle idea. Screenshot or screen-record for papers, conference talks, and grant proposals. Share a live link instead of a static PDF figure.

### Security auditors
The Merkle demo builds intuition for proof path construction ("if I change this leaf, which hashes cascade?"). The accumulator demo lets you inject a wrong witness and watch verification fail. The recursive tree's bad-proof injection shows exactly how a soundness failure propagates. All of this builds the mental model you need before auditing real circuits.

### Educators and DevRel
Embed interactive diagrams in blog posts, workshop materials, and documentation. The `?embed=` mode is purpose-built for this. "Everyone open this link and add a leaf to the tree" works in a live workshop.

### Students and self-learners
A sandbox where you can't break anything. Add leaves, drag points, inject failures. Build intuition before you write a line of Circom.

---

## MCP Server

Theora ships an MCP (Model Context Protocol) server that exposes every cryptographic primitive as a callable tool for AI agents. Claude Code, Claude Desktop, Cursor, and any MCP-compatible client can call Theora's math directly — no UI needed.

### Quick Start

```bash
cd mcp-server
npm install && npm run build
```

Connect to Claude Code by adding to your MCP config:

```json
{
  "mcpServers": {
    "theora": {
      "command": "node",
      "args": ["/path/to/theora/mcp-server/build/index.js"]
    }
  }
}
```

### Available Tools

| Tool Group | Tools | Description |
|---|---|---|
| **Merkle** | `merkle_build`, `merkle_prove`, `merkle_verify` | Build trees, generate proofs, verify inclusion |
| **Polynomial** | `polynomial_evaluate`, `polynomial_interpolate`, `polynomial_kzg_commit`, `polynomial_kzg_open`, `polynomial_kzg_verify` | Polynomial math and KZG commitment flow |
| **Accumulator** | `accumulator_create`, `accumulator_add`, `accumulator_membership_witness`, `accumulator_nonmembership_proof`, `accumulator_batch_add` | RSA accumulator with membership/non-membership proofs |
| **Recursive** | `recursive_build_tree`, `recursive_verify_step`, `recursive_verify_all`, `recursive_inject_bad_proof`, `recursive_ivc_fold` | Proof composition trees and IVC chains |
| **Elliptic** | `elliptic_enumerate`, `elliptic_add`, `elliptic_scalar_multiply` | Finite-field point arithmetic |
| **Fiat-Shamir** | `fiat_shamir_interactive`, `fiat_shamir_noninteractive`, `fiat_shamir_forge` | Interactive/non-interactive transcript comparison |
| **Circuit** | `circuit_evaluate`, `circuit_find_exploit` | R1CS constraint evaluation and exploit detection |
| **Lookup** | `lookup_check` | Lookup argument table/wire validation |
| **Pipeline** | `pipeline_run` | End-to-end proof pipeline with fault injection |

### Resources & Prompts

The server also exposes MCP resources (`theora://demos/list`, `theora://demos/{id}/info`) and prompt templates (`explain_primitive`, `audit_circuit`, `generate_test_vectors`) for guided agent interactions.

### Example Agent Interactions

```
You: "Build a Merkle tree with 8 leaves and prove leaf 3"
Agent: calls merkle_build → merkle_prove → returns structured proof

You: "Run the proof pipeline with input 7 and inject a Frozen Heart fault"
Agent: calls pipeline_run({secretInput: 7, fault: "weak_fiat_shamir"})
       → returns all 7 stages with exact divergence point

You: "Test if removing constraint 0 from the circuit creates an exploit"
Agent: calls circuit_evaluate → circuit_find_exploit → explains the vulnerability
```

---

## Tech Stack

No external state management libraries. No charting libraries. All visualizations are hand-rendered on `<canvas>` for full control over animation and interaction.

## License

MIT
