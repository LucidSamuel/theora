# Theora

Interactive cryptographic primitive visualizer. Merkle trees, polynomial commitments, RSA accumulators, and recursive proof composition — animated, shareable, and embeddable.

---

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
  - **Bad proof injection**: Name any node to mark it invalid, rebuild, and watch failure propagate upward through the tree
  - Adjustable verification speed (100–1000ms per step)
- **IVC mode**:
  - Build a chain of computation steps (length 3–10)
  - Fold steps one at a time, compressing the chain into an accumulator
  - Each fold updates the accumulator hash incorporating the previous step
  - Pasta curve cycle applies to each step
- **Statistics panel**: Total nodes, verified/failed counts, current step, accumulator hash, and constant proof size (~288 bytes regardless of depth)
- **Display toggles**: Show/hide Pasta curve labels and proof size annotations

---

## Features

### Sharing & Embedding

Every demo state encodes into the URL. Share a link and the recipient sees exactly what you see.

- **Share URL**: Full state in query parameters (Base64-encoded)
- **Hash URL**: Cleaner format using URL fragment (`#merkle|{...}`)
- **Embed iframe**: One-click copy of an `<iframe>` snippet for embedding in docs, blog posts, or Notion pages
- **PNG export**: Screenshot the canvas to a downloadable image
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

Embed mode hides the sidebar and header, showing only the canvas and controls. Works for all four demos (`merkle`, `polynomial`, `accumulator`, `recursive`).

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

## Tech Stack

No external state management libraries. No charting libraries. All visualizations are hand-rendered on `<canvas>` for full control over animation and interaction.

## License

MIT
