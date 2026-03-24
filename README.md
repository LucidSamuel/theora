# Theora

Interactive cryptography visualizer. 12 animated demos covering the primitives that compose a modern proof system — from Merkle trees to Groth16.

## Demos

| Demo | What it visualizes |
|---|---|
| **Merkle Tree** | Hash trees, inclusion proofs, step-through verification |
| **RSA Accumulator** | Modular exponentiation, membership/non-membership witnesses |
| **Polynomial Commitments** | KZG flow — commit, challenge, reveal, verify |
| **R1CS Circuits** | Witness assignments, constraint satisfaction, underconstrained exploits |
| **Lookup Arguments** | Table/wire multiset checks, mismatch detection |
| **Elliptic Curves** | Finite-field point addition, scalar multiplication, Pasta cycle |
| **Fiat-Shamir** | Interactive vs non-interactive proofs, transcript forgery |
| **Recursive Proofs** | Proof composition trees, IVC folding, Pasta curve cycle |
| **Pedersen Commitments** | Hiding commitments, homomorphic addition |
| **PLONK** | Gate equations, selector polynomials, copy constraints |
| **Groth16** | R1CS → QAP → trusted setup → proof → pairing verification |
| **Proof Pipeline** | End-to-end flow with 4 fault injection modes |

Every demo is shareable (URL-encoded state), embeddable (`<iframe>`), and exportable (PNG, JSON).

## Getting Started

```bash
npm install
npm run dev
```

## Save & Load

Connect a GitHub account to save and load demo states as public Gists. Click "Connect" in the header — OAuth sign-in or personal access token.

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

Vite + React + TypeScript + Tailwind CSS. All visualizations hand-rendered on `<canvas>` with spring-physics animations at 60fps. No charting libraries, no external state management.

## License

[MIT](LICENSE)
