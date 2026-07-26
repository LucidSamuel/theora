# Design: Proof Trace Demo (`proof-trace`)

The proof-trace demo loads a `trace.json` describing one execution of an interactive (or Fiat-Shamir'd) proof protocol and renders three views of it:

1. **Fingerprint** — a deterministic generative visual derived from a hash of the transcript. Same trace → identical image; any transcript change → visibly different image. An identicon for a proof run.
2. **Constraint graph** — wires and R1CS constraints from the optional `constraints` section, with satisfied/failed states.
3. **Iteration trace** — a step-through timeline of transcript events with scrubber and auto-play.

Visual language follows [DESIGN.md](DESIGN.md): dark-first, border-based depth, JetBrains Mono labels, 8px grid.

## 1. trace.json schema (version 1)

Defined and validated in `src/demos/proof-trace/schema.ts`. All field elements are **decimal strings** (JSON-safe bigints). All numbers must be integers.

```ts
interface ProofTrace {
  version: 1;
  meta: {
    system: string;            // freeform origin, e.g. "theora", "ragu"
    protocol: string;          // "sumcheck" | "fri" | "r1cs" | "folding" | freeform
    field: string;             // decimal modulus, e.g. "101"
    label?: string;            // display name — not hashed
    createdAt?: string;        // ISO date — not hashed
  };
  transcript: TranscriptEvent[];   // ordered; the hashed core
  constraints?: ConstraintSection; // optional; powers the constraint-graph view
  rounds?: RoundMeta[];            // optional per-round annotations for the timeline
}

type TranscriptEventType = 'absorb' | 'challenge' | 'commit' | 'fold' | 'query' | 'check';

interface TranscriptEvent {
  t: TranscriptEventType;
  round: number;               // 0 = setup, 1..n = protocol rounds
  label: string;               // e.g. "g_1 coefficients", "r_1"
  data?: string[];             // field elements / hex digests
  ok?: boolean;                // only meaningful when t === 'check'
}

interface RoundMeta {
  round: number;
  label?: string;
  stats?: Record<string, string>;   // e.g. { domainSize: "16", degree: "7" }
}

// JSON-safe mirror of the DSL's Map<number, bigint> linear combinations
// (src/lib/dsl/types.ts). Pairs sorted by wireId ascending.
type TraceLinComb = [wireId: number, coeff: string][];

interface TraceWire {
  id: number;
  name: string;
  type: 'input' | 'public' | 'intermediate' | 'one';
}

interface TraceConstraint {
  id: number;
  a: TraceLinComb;
  b: TraceLinComb;
  c: TraceLinComb;
  label?: string;              // human-readable source expression
  satisfied?: boolean;         // recomputable when witness present
}

interface ConstraintSection {
  wires: TraceWire[];
  constraints: TraceConstraint[];
  witness?: Record<string, string>;  // wireId (string key) -> decimal value
}
```

### Validation rules

- `version` must be the literal `1`.
- `meta.system`, `meta.protocol`, `meta.field` required; `field` must match `/^\d+$/` and be ≥ 2.
- Every event: known `t`, integer `round ≥ 0`, string `label`; `data` entries must be strings; `ok` only allowed on `check` events.
- `TraceLinComb` pairs: integer wireId, decimal-string coeff; wireIds must exist in `wires`.
- Uploaded files capped at 2 MB; parse errors reported per-path.

### Normalization (applied before hashing and before storing)

- Drop `data` when it is an empty array.
- Drop `ok` on non-`check` events.
- No other coercions — a trace that needs more than this is invalid, not fixable.

### DSL bridge

`schema.ts` exports the contract that lets the constraint editor and debug DSL emit traces:

```ts
fromDslConstraints(compilation: CompilationResult, check?: CheckResult, witness?: WitnessResult): ConstraintSection
toDslLinComb(lc: TraceLinComb): Map<number, bigint>
```

`fromDslConstraints` maps `Wire` → `TraceWire` (id/name/type), `Constraint.{a,b,c}` → sorted `TraceLinComb`, `Constraint.sourceExpr` → `label`, per-constraint check results → `satisfied`, and witness values → `witness`.

## 2. Canonicalization and the fingerprint hash (frozen contract)

```
transcriptHash(trace) = sha256(
  "theora/proof-trace/v1" + "|" + meta.protocol + "|" + meta.field + "|" +
  canonicalStringify(normalize(trace.transcript))
)
```

- `sha256` is the existing `src/lib/hash.ts` WebCrypto helper (hex output).
- `canonicalStringify`: JSON serialization with **object keys sorted lexicographically**, arrays in order, no whitespace. Absent optional keys are omitted, never null-filled.
- **Hashed**: protocol, field, and the normalized transcript events (including `ok` on check events — a failed run is a different execution and fingerprints differently, by design).
- **Not hashed**: `meta.system`, `meta.label`, `meta.createdAt`, `constraints`, `rounds`. The fingerprint identifies the *interaction*, not the annotation.
- The hex hash is a forever-contract, pinned by test vectors in `src/__tests__/proofTrace.test.ts` and mirrored in `mcp-server/test/trace.test.mjs`. The rendered image is stable only per `FINGERPRINT_VERSION` (currently `1`); renderer changes that alter pixels must bump it.

### Worked example

```json
{
  "version": 1,
  "meta": { "system": "theora", "protocol": "sumcheck", "field": "101" },
  "transcript": [
    { "t": "absorb",    "round": 0, "label": "claimed sum",       "data": ["36"] },
    { "t": "absorb",    "round": 1, "label": "g_1 coefficients",  "data": ["10", "16"] },
    { "t": "check",     "round": 1, "label": "g_1(0)+g_1(1) = S", "ok": true },
    { "t": "challenge", "round": 1, "label": "r_1",               "data": ["7"] },
    { "t": "absorb",    "round": 2, "label": "g_2 coefficients",  "data": ["55", "12"] },
    { "t": "check",     "round": 2, "label": "g_2(0)+g_2(1) = g_1(r_1)", "ok": true },
    { "t": "challenge", "round": 2, "label": "r_2",               "data": ["13"] },
    { "t": "query",     "round": 3, "label": "oracle f(r_1,r_2)", "data": ["42"] },
    { "t": "check",     "round": 3, "label": "final",             "ok": true }
  ]
}
```

The preimage begins `theora/proof-trace/v1|sumcheck|101|[{"data":["36"],"label":"claimed sum","round":0,"t":"absorb"},…`.

Pinned test vector (shared with `mcp-server/test/trace.test.mjs`):

```
transcriptHash(example) = 227124dcc5e09f7f1efcff1a80f856871031f36c8cc1ba75f9c40523214a9a42
```

## 3. Fingerprint algorithm v1

### Seed derivation

1. `hashHex = transcriptHash(trace)` (64 hex chars).
2. First 32 hex chars → 4 big-endian uint32 seeds → `sfc32(a, b, c, d)` from `src/lib/prng.ts`.
3. `makeRng(hashHex)` wraps sfc32 with `nextFloat()`, `nextInt(min, max)`, `pick(arr)`.

### PRNG consumption order (fixed; changing it bumps FINGERPRINT_VERSION)

1. `baseRotation` — one `nextFloat()` → global rotation in [0, 2π).
2. `hueShift` — one `nextFloat()` → accent hue rotation in [−18°, +18°].
3. `centerGlyph` — one `nextInt(0, 3)` → center medallion variant.
4. Per ring (round), in round order: `radiusJitter` (one `nextFloat()`, ±3px), `ringPhase` (one `nextFloat()`, sector start offset).
5. Per event, in transcript order: `glyphJitter` (one `nextFloat()`, ±2px radial), `arcCurvature` (one `nextFloat()`, connector bend).

Nothing else may consume PRNG values. `buildFingerprintSpec` is pure: `(hashHex, trace) → FingerprintSpec` (a list of drawing primitives), so determinism is testable without a canvas.

### Geometry

- Center medallion: radius 48px, one of 4 variants (ring, dot-matrix, cross-hatch, concentric).
- One ring per round present in the transcript, ring width 48px, first ring at radius 96px; beyond 8 rings, rounds wrap onto the outermost ring at reduced glyph size.
- Events are placed on their round's ring at evenly spaced angles (ring phase offset from PRNG), connected by low-alpha arcs whose curvature comes from the PRNG.
- Bounds are the outermost ring + 32px padding; camera fit uses `fitCameraToBounds`.

### Glyph table

| Event | Glyph | Color |
|---|---|---|
| `absorb` | filled circle (r 6) | accent |
| `challenge` | open ring (r 7, 1.5px stroke) | accent, hue-shifted +30° |
| `commit` | square (12×12, 2px radius) | `--text-primary` at 80% |
| `fold` | inward chevron arc | accent, hue-shifted −30° |
| `query` | tick mark (10px) | `--text-secondary` |
| `check` ok | small dot (r 4) | `--color-success` |
| `check` failed | small dot (r 4) + halo | `--color-error` |

Accent: demo accent `#d946ef` with per-trace `hueShift`. Strokes 1.5px; connector arcs at 12% alpha. Hash displayed under the canvas via `HashBadge`, with `FINGERPRINT_VERSION` in the caption.

## 4. Views and layout

### View switcher

Sidebar segmented control (ButtonControl row): `Fingerprint · Constraints · Timeline`, mirroring the polynomial demo's mode switcher. `constraints` view disabled (with note) when the trace has no `constraints` section.

### Fingerprint view

Canvas: mandala centered at origin. Sidebar: source panel (samples / upload / URL), trace summary card (protocol, field, event count, round count, hash badge), view switcher, share/export.

### Constraint graph view (Phase B)

Layered left-to-right DAG (mirrors `src/lib/circuitGraph/layout.ts` semantics): wires as glow circles (r 28), constraints as rounded boxes (160×48), edges as 1px lines, failed constraints in `--color-error` with glow. Cap ~500 nodes, truncation warning in sidebar.

### Iteration trace view (Phase B)

Six horizontal lanes (one per event type, 32px tall, 8px gaps), events as glyphs at x = event index × 24px, round boundaries as `--grid-line-strong` vertical rules with round labels, current-step cursor as a 2px accent rule. Events after `step` at 25% opacity. Scrubber (range input) + play/pause in sidebar; auto-play advances one event per 400ms and stops at the end (self-terminating → GIF-exportable).

## 5. URL state

Demo state: `{ source: TraceSource; view: 'fingerprint' | 'constraints' | 'timeline'; step: number; playing: boolean }`

```ts
type TraceSource =
  | { kind: 'sample'; id: SampleId }          // bundled; tiny URL
  | { kind: 'url'; url: string }              // github/gist URL; refetched on restore
  | { kind: 'inline'; trace: ProofTrace }     // embedded when encoded state ≤ 1500 chars
  | { kind: 'local'; name: string; hash: string };  // uploaded; NOT restorable
```

| Source | Hash/query serialization | Restore behavior |
|---|---|---|
| `sample` | full state | rebuild sample by id |
| `url` | full state | refetch with loading/error UI; fall back to default sample on failure |
| `inline` | full state if ≤ 1500 chars encoded | decode + validate |
| `local` | `{kind:'local', name, hash}` marker only | show "re-upload or save to GitHub" notice |

Short query key `pt` (base64 `encodeState`); hash share `#proof-trace|<encodeStatePlain>`. Gist save uses the standard envelope `{version: 1, demo: 'proof-trace', state}` with the trace inlined (no length limit in gists) — loading such a gist yields a `url`-kind share. Embed mode (`?embed=proof-trace`) hides the source panel and only honors `sample`/`inline` sources.

## 6. Bundled samples

Built at module load from real demo logic (cannot drift; asserted by tests):

| id | Source | Content |
|---|---|---|
| `sumcheck-3var` | `src/demos/sumcheck/logic.ts` (`createPolynomial(3, 101n, [1..8])`, fixed challenges `[7, 13, 19]`) | absorb/check/challenge per round + final query/check |
| `fri-deg7` | `src/demos/fri/logic.ts` (`friProtocol`, degree-7 poly over GF(257), fixed folding challenges + query indices) | commit per layer, challenge/fold per fold, query/check rounds; `rounds` stats carry domain sizes |
| `r1cs-square` | `src/lib/dsl` (`defaults.ts` `basic` circuit → parse/compile/witness/check → `fromDslConstraints`) | minimal transcript (absorb publics, check per constraint) + full `constraints` section |
| `r1cs-square-bad` | same, with one corrupted witness value | failed checks; demonstrates fingerprint divergence and failed constraint states |
