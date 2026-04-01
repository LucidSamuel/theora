# theora

Interactive zero-knowledge proof visualizer. Demos across 4 categories, multiple interaction modes, and a paper-to-proof research workspace.

**Live at [www.theora.dev](https://www.theora.dev)**

## Demos

### Proof Systems
| Demo | What it visualizes |
|---|---|
| **Proof Pipeline** | End-to-end 7-stage flow with 4 fault injection modes |
| **Recursive Proofs** | Proof composition trees, IVC folding, Pasta curve cycle |
| **Split Accumulation** | Deferred IPA verification across recursive steps |
| **Groth16** | R1CS → QAP → trusted setup → proof → pairing verification |
| **PLONK** | Gate equations, selector polynomials, copy constraints |

### Commitment Schemes
| Demo | What it visualizes |
|---|---|
| **Polynomial Commitments** | KZG flow — commit, challenge, reveal, verify |
| **Pedersen Commitments** | Hiding commitments, homomorphic addition |
| **Merkle Tree** | Hash trees, inclusion proofs, step-through verification |
| **RSA Accumulator** | Modular exponentiation, membership/non-membership witnesses |

### Protocol Primitives
| Demo | What it visualizes |
|---|---|
| **Fiat-Shamir** | Interactive vs non-interactive proofs, transcript forgery |
| **Elliptic Curves** | Finite-field point addition, scalar multiplication, Pasta cycle |
| **R1CS Circuits** | Witness assignments, constraint satisfaction, underconstrained exploits |
| **Lookup Arguments** | Table/wire multiset checks, mismatch detection |

### Privacy Primitives
| Demo | What it visualizes |
|---|---|
| **Oblivious Sync** | Privacy-preserving nullifier synchronization |
| **Rerandomization** | Proof unlinkability via commitment rerandomization |
| **Constraint Counter** | Pedersen vs Poseidon in-circuit cost comparison |

Every demo is shareable (URL-encoded state), embeddable (`<iframe>`), and exportable (PNG, JSON).

## Interaction Modes

- **Explore** — full control over every parameter, drag sliders, inject faults
- **Predict** — guess what happens next, then watch the math play out
- **Attack** — forge proofs, exploit missing constraints, break transcripts

## Research Workspace

Upload a cryptography paper (PDF or eprint URL) and get an interactive walkthrough with live demos mapped to each section. 5 curated walkthroughs included (Halo, Groth16, PLONK, Bulletproofs, Ragu). Requires an Anthropic API key for AI-generated walkthroughs.

## Getting Started

```bash
npm install
npm run dev
```

## Save & Load

Connect a GitHub account to save and load demo states as unlisted Gists. Click "Connect" in the header for OAuth sign-in.

## MCP Server

An MCP server exposes every primitive as a callable tool for AI agents (Claude Code, Cursor, etc.).

```bash
cd mcp-server && npm install && npm run build
```

Add to your MCP config:

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

## Tech

Vite + React + TypeScript + Tailwind CSS. All visualizations hand-rendered on `<canvas>` with spring-physics animations at 60fps. No charting libraries, no external state management. 4 runtime dependencies: react, react-dom, react-router-dom, lucide-react.

## License

[MIT](LICENSE)
