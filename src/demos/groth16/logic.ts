// Groth16 SNARK 
// All arithmetic is over GF(101) for clarity. Real Groth16 uses 254-bit prime fields
// and elliptic curve pairings; the structure here mirrors the real protocol exactly
// while keeping numbers human-readable.

const P = 101; // small prime field for educational clarity

// ── Field arithmetic ─────────────────────────────────────────────────────────

function mod(a: number, m: number = P): number {
  return ((a % m) + m) % m;
}

function modPow(base: number, exp: number, m: number = P): number {
  let result = 1;
  base = mod(base, m);
  while (exp > 0) {
    if (exp & 1) result = mod(result * base, m);
    base = mod(base * base, m);
    exp >>= 1;
  }
  return result;
}

function modInv(a: number, m: number = P): number {
  // Fermat's little theorem: a^(p-2) ≡ a^(-1) (mod p)
  return modPow(a, m - 2, m);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface R1CSConstraint {
  /** label for display */
  label: string;
  /** left input coefficient vector over witness */
  a: number[];
  /** right input coefficient vector over witness */
  b: number[];
  /** output coefficient vector over witness */
  c: number[];
}

export interface R1CSResult {
  constraints: R1CSConstraint[];
  /** witness vector: [1, x, t, y] where t = x² */
  witness: number[];
  /** does the witness satisfy every constraint mod P? */
  satisfied: boolean;
}

export interface QAP {
  /** A polynomials in coefficient form — one polynomial per wire, length = domain.length */
  a_polys: number[][];
  /** B polynomials in coefficient form */
  b_polys: number[][];
  /** C polynomials in coefficient form */
  c_polys: number[][];
  /** evaluation domain: [1, 2, 3] (roots of the H polynomial) */
  domain: number[];
  /** H(x) = t(x) · h(x) — the quotient polynomial coefficients */
  h_poly: number[];
}

export interface TrustedSetup {
  /** random trapdoor α */
  alpha: number;
  /** random trapdoor β */
  beta: number;
  /** random trapdoor γ */
  gamma: number;
  /** random trapdoor δ */
  delta: number;
  /** human-readable "toxic waste" — the trapdoor combination */
  toxic: string;
}

export interface Groth16Proof {
  /** simulated G1 element — [α·A(s) + β·B(s) + … ] compressed to a number */
  A: number;
  /** simulated G2 element */
  B: number;
  /** simulated G1 element — the C "combining" commitment */
  C: number;
  /** which element is corrupted, if any */
  corrupted?: 'A' | 'B' | 'C';
}

export interface VerificationResult {
  /** simulated e(A, B) */
  lhsPairing: number;
  /** simulated e(α, β) · e(pub, γ) · e(C, δ) */
  rhsPairing: number;
  valid: boolean;
}

export type Groth16Phase = 'idle' | 'r1cs' | 'qap' | 'setup' | 'prove' | 'verify';

export interface PhaseData {
  phase: Groth16Phase;
  r1cs: R1CSResult | null;
  qap: QAP | null;
  setup: TrustedSetup | null;
  proof: Groth16Proof | null;
  verifyResult: VerificationResult | null;
}

// ── Wire classification ──────────────────────────────────────────────────────
//
// Witness vector: w = [1, x, t, y]   indices: [0, 1, 2, 3]
// Public wires:  0 (constant 1) and 3 (output y) — known to verifier
// Private wires: 1 (secret x) and 2 (intermediate t = x²)
const PUBLIC_WIRES = [0, 3];
const PRIVATE_WIRES = [1, 2];

// ── Circuit definition ────────────────────────────────────────────────────────
//
// Circuit computes f(x) = x² + x + 5 = y
// Witness vector: w = [1, x, t, y]   indices: [0, 1, 2, 3]
//
// Constraint 0: x · x = t   (square gate)
//   A·w = [0,1,0,0]·w = x
//   B·w = [0,1,0,0]·w = x
//   C·w = [0,0,1,0]·w = t
//
// Constraint 1: (t + x + 5·1) · 1 = y   (linear combination + constant)
//   A·w = [5,1,1,0]·w = 5 + x + t
//   B·w = [1,0,0,0]·w = 1
//   C·w = [0,0,0,1]·w = y

export function buildR1CS(secretX: number): R1CSResult {
  const x = mod(secretX);
  const t = mod(x * x);
  const y = mod(t + x + 5);
  const witness = [1, x, t, y];

  const constraints: R1CSConstraint[] = [
    {
      label: 'x · x = t',
      a: [0, 1, 0, 0],
      b: [0, 1, 0, 0],
      c: [0, 0, 1, 0],
    },
    {
      label: '(t + x + 5) · 1 = y',
      a: [5, 1, 1, 0],
      b: [1, 0, 0, 0],
      c: [0, 0, 0, 1],
    },
  ];

  const satisfied = constraints.every((con) => {
    const lhs = mod(dotMod(con.a, witness) * dotMod(con.b, witness));
    const rhs = mod(dotMod(con.c, witness));
    return lhs === rhs;
  });

  return { constraints, witness, satisfied };
}

function dotMod(coeffs: number[], vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < coeffs.length; i++) {
    sum = mod(sum + mod(coeffs[i]! * vec[i]!));
  }
  return sum;
}

// ── QAP construction ─────────────────────────────────────────────────────────
//
// For m=2 constraints we use domain H = {1, 2}.
// Each wire's A/B/C polynomial is the unique degree-(m-1) polynomial
// through the m evaluation points. With 2 constraints this gives linear polynomials.
//
// poly[i](j+1) = constraint[j].a[i]  for j in 0..m-1
//
// Lagrange basis over H = {1, 2}:
//   L_0(x) = (x - 2)/(1 - 2) = -(x - 2) = -x + 2 = [2, -1] (coeff: const, x)
//   L_1(x) = (x - 1)/(2 - 1) =  (x - 1)          = [-1, 1]

function lagrangeInterp(domain: number[], values: number[]): number[] {
  const n = domain.length;
  // Result polynomial coefficients [a_0, a_1, ... a_{n-1}] (ascending degree)
  let result = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    // Compute L_i(x) — the i-th Lagrange basis polynomial
    let basis = [1]; // start with constant 1
    let denom = 1;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      // multiply basis by (x - domain[j])
      const factor = [mod(-domain[j]!), 1]; // [-domain[j], 1]
      basis = polyMulMod(basis, factor);
      denom = mod(denom * mod(domain[i]! - domain[j]!));
    }
    const denomInv = modInv(denom);
    // scale basis by values[i] * denomInv
    const scale = mod(values[i]! * denomInv);
    const scaled = basis.map((c) => mod(c * scale));
    // add to result
    for (let k = 0; k < scaled.length; k++) {
      result[k] = mod((result[k] ?? 0) + (scaled[k] ?? 0));
    }
  }
  return result;
}

function polyMulMod(a: number[], b: number[]): number[] {
  const result = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] = mod((result[i + j] ?? 0) + mod(a[i]! * b[j]!));
    }
  }
  return result;
}

function polyEvalMod(poly: number[], x: number): number {
  let result = 0;
  for (let i = poly.length - 1; i >= 0; i--) {
    result = mod(result * x + poly[i]!);
  }
  return result;
}

function polySubMod(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    result.push(mod((a[i] ?? 0) - (b[i] ?? 0)));
  }
  return result;
}

export function r1csToQAP(r1cs: R1CSResult): QAP {
  const { constraints, witness } = r1cs;
  const m = constraints.length; // number of constraints = 2
  const n = witness.length;     // number of wires = 4
  const domain = Array.from({ length: m }, (_, i) => i + 1); // [1, 2]

  const a_polys: number[][] = [];
  const b_polys: number[][] = [];
  const c_polys: number[][] = [];

  for (let wire = 0; wire < n; wire++) {
    const aVals = constraints.map((con) => mod(con.a[wire] ?? 0));
    const bVals = constraints.map((con) => mod(con.b[wire] ?? 0));
    const cVals = constraints.map((con) => mod(con.c[wire] ?? 0));
    a_polys.push(lagrangeInterp(domain, aVals));
    b_polys.push(lagrangeInterp(domain, bVals));
    c_polys.push(lagrangeInterp(domain, cVals));
  }

  // Compute A(x) = Σ_i w_i · a_polys[i], same for B, C
  const Apoly = sumWeighted(a_polys, witness);
  const Bpoly = sumWeighted(b_polys, witness);
  const Cpoly = sumWeighted(c_polys, witness);

  // Vanishing polynomial: t(x) = Π (x - h_i) for h_i in domain
  // t(x) = (x-1)(x-2) = x² - 3x + 2 = [2, -3, 1]
  let t_poly: number[] = [1];
  for (const h of domain) {
    t_poly = polyMulMod(t_poly, [mod(-h), 1]);
  }

  // h(x) = (A·B - C) / t — should divide evenly
  const AB = polyMulMod(Apoly, Bpoly);
  const ABminusC = polySubMod(AB, Cpoly);

  // Polynomial long division: ABminusC ÷ t_poly
  const h_poly = polyDivMod(ABminusC, t_poly);

  return { a_polys, b_polys, c_polys, domain, h_poly };
}

function sumWeighted(polys: number[][], weights: number[]): number[] {
  const maxLen = Math.max(...polys.map((p) => p.length));
  const result = new Array<number>(maxLen).fill(0);
  for (let i = 0; i < polys.length; i++) {
    const w = mod(weights[i] ?? 0);
    for (let j = 0; j < (polys[i]?.length ?? 0); j++) {
      result[j] = mod((result[j] ?? 0) + mod(w * (polys[i]?.[j] ?? 0)));
    }
  }
  return result;
}

function polyDivMod(num: number[], den: number[]): number[] {
  // Removes leading zeros
  let n = [...num];
  while (n.length > 1 && n[n.length - 1] === 0) n.pop();
  let d = [...den];
  while (d.length > 1 && d[d.length - 1] === 0) d.pop();

  if (n.length < d.length) return [0];

  const quotient: number[] = new Array(n.length - d.length + 1).fill(0);
  for (let i = quotient.length - 1; i >= 0; i--) {
    const idx = i + d.length - 1;
    const coeff = mod(mod(n[idx] ?? 0) * modInv(d[d.length - 1] ?? 1));
    quotient[i] = coeff;
    for (let j = 0; j < d.length; j++) {
      n[i + j] = mod((n[i + j] ?? 0) - mod(coeff * (d[j] ?? 0)));
    }
  }
  return quotient;
}

// ── Trusted setup ─────────────────────────────────────────────────────────────
//
// Groth16 CRS requires:
//   α, β, γ, δ  — random field elements (the "toxic waste")
//   [ σ^i·G1 ]  — powers of a trapdoor in G1
//   [ σ^i·G2 ]  — powers of a trapdoor in G2
//
// Here we simulate with numbers mod P.

let _setupSeed = 42; // deterministic but illustrative

function pseudoRand(min: number, max: number): number {
  _setupSeed = mod(_setupSeed * 37 + 17);
  return min + (_setupSeed % (max - min + 1));
}

export function trustedSetup(): TrustedSetup {
  _setupSeed = 42; // reset for determinism
  const alpha = pseudoRand(2, 50);
  const beta  = pseudoRand(2, 50);
  const gamma = pseudoRand(2, 50);
  const delta = pseudoRand(2, 50);

  const toxic = `τ = α${alpha}·β${beta} + γ${gamma}·δ${delta} → destroy after ceremony`;

  return { alpha, beta, gamma, delta, toxic };
}

// ── Prove ─────────────────────────────────────────────────────────────────────
//
// Real Groth16:
//   A = α + Σ a_i(τ)·w_i + r·δ
//   B = β + Σ b_i(τ)·w_i + s·δ
//   C = Σ_{i ∈ priv} (βa_i(τ)+αb_i(τ)+c_i(τ))/δ·w_i + h(τ)t(τ)/δ + As + Br - rsδ
//
// We simulate all G1/G2 arithmetic with modular multiplication.

export function prove(qap: QAP, r1cs: R1CSResult, setup: TrustedSetup): Groth16Proof {
  const { witness } = r1cs;
  const { a_polys, b_polys, c_polys, h_poly, domain } = qap;
  const { alpha, beta, delta } = setup;

  // Trapdoor evaluation point τ — derived from setup params for determinism
  const tau = mod(alpha * beta + delta + 3);

  // Evaluate Σ_all a_i(τ)·w_i — used in A and B (which include all wires)
  const A_inner = mod(sumPolyAtPoint(a_polys, witness, tau));
  const B_inner = mod(sumPolyAtPoint(b_polys, witness, tau));

  // Vanishing poly at tau
  let t_at_tau = 1;
  for (const h of domain) {
    t_at_tau = mod(t_at_tau * mod(tau - h));
  }
  const h_at_tau = polyEvalMod(h_poly, tau);

  // Random blinding factors r, s
  const r = mod(alpha + 7);
  const s = mod(beta + 11);

  const A = mod(alpha + A_inner + mod(r * delta));
  const B = mod(beta  + B_inner + mod(s * delta));

  // C combines PRIVATE wire inputs only + the quotient h·t
  // Public wires go into the verification key's L polynomial instead
  let priv_combined = 0;
  for (const i of PRIVATE_WIRES) {
    const ai = polyEvalMod(a_polys[i]!, tau);
    const bi = polyEvalMod(b_polys[i]!, tau);
    const ci = polyEvalMod(c_polys[i]!, tau);
    const w = witness[i]!;
    priv_combined = mod(priv_combined + mod(w * mod(mod(beta * ai) + mod(alpha * bi) + ci)));
  }

  const C_val = mod(
    mod(priv_combined * modInv(delta))
    + mod(mod(h_at_tau * t_at_tau) * modInv(delta))
    + mod(A * s) + mod(B * r) - mod(r * mod(s * delta))
  );

  return { A: mod(A), B: mod(B), C: mod(C_val) };
}

function sumPolyAtPoint(polys: number[][], weights: number[], tau: number): number {
  let sum = 0;
  for (let i = 0; i < polys.length; i++) {
    sum = mod(sum + mod((weights[i] ?? 0) * polyEvalMod(polys[i] ?? [], tau)));
  }
  return sum;
}

// ── Verify ────────────────────────────────────────────────────────────────────
//
// Real Groth16 check: e(A, B) = e(α, β) · e(Σ pub_i·L_i, γ) · e(C, δ)
//   where L_i = (β·a_i(τ) + α·b_i(τ) + c_i(τ)) / γ  (precomputed in VK)
//
// We simulate pairings as e(x, y) = x * y mod P, target group op = addition.

export function verify(
  proof: Groth16Proof,
  setup: TrustedSetup,
  qap: QAP,
  witness: number[],      // full witness — verifier only reads public wire entries
): VerificationResult {
  const { alpha, beta, gamma: _gamma, delta } = setup;
  void _gamma; // γ cancels in e(pub/γ, γ) — kept in setup for display
  const { A, B, C } = proof;
  const { a_polys, b_polys, c_polys } = qap;

  // Trapdoor evaluation point (same derivation as prover)
  const tau = mod(alpha * beta + delta + 3);

  // Simulated pairing: e(x, y) = x * y mod P
  const lhsPairing = mod(A * B);

  // e(α, β)
  const e_alpha_beta = mod(alpha * beta);

  // Public input contribution: Σ_{pub wires} w_i · (β·a_i(τ) + α·b_i(τ) + c_i(τ))
  // In real Groth16 this is precomputed as L_i in the verification key and
  // divided by γ; the pairing with γ cancels: e(Σ w_i·L_i, γ) = Σ w_i·L_i·γ/γ
  let pub_sum = 0;
  for (const i of PUBLIC_WIRES) {
    const ai = polyEvalMod(a_polys[i]!, tau);
    const bi = polyEvalMod(b_polys[i]!, tau);
    const ci = polyEvalMod(c_polys[i]!, tau);
    const w = witness[i]!;
    pub_sum = mod(pub_sum + mod(w * mod(mod(beta * ai) + mod(alpha * bi) + ci)));
  }
  // e(pub/γ, γ) = pub_sum  (γ cancels in the simulated pairing)
  const e_pub_gamma = pub_sum;

  // e(C, δ)
  const e_C_delta = mod(C * delta);

  const rhsPairing = mod(e_alpha_beta + e_pub_gamma + e_C_delta);

  const valid = lhsPairing === rhsPairing;

  return { lhsPairing, rhsPairing, valid };
}

// ── Fault injection ───────────────────────────────────────────────────────────

export function corruptProof(proof: Groth16Proof, element: 'A' | 'B' | 'C'): Groth16Proof {
  const corrupted = { ...proof, corrupted: element };
  switch (element) {
    case 'A':
      corrupted.A = mod(proof.A + 1);
      break;
    case 'B':
      corrupted.B = mod(proof.B + 1);
      break;
    case 'C':
      corrupted.C = mod(proof.C + 1);
      break;
  }
  return corrupted;
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Return the expected public output y = x² + x + 5 (mod P) for a given x */
export function computePublicOutput(x: number): number {
  const xm = mod(x);
  return mod(mod(xm * xm) + xm + 5);
}

/** Phase display names */
export const PHASE_LABELS: Record<Groth16Phase, string> = {
  idle:   'Idle',
  r1cs:   'R1CS',
  qap:    'QAP',
  setup:  'Trusted Setup',
  prove:  'Prove',
  verify: 'Verify',
};

export const PHASE_ORDER: Groth16Phase[] = ['idle', 'r1cs', 'qap', 'setup', 'prove', 'verify'];

export function nextPhase(current: Groth16Phase): Groth16Phase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return current;
  return PHASE_ORDER[idx + 1]!;
}

export function buildPhaseData(
  secretX: number,
  phase: Groth16Phase,
  corrupt: 'none' | 'A' | 'B' | 'C',
): PhaseData {
  const result: PhaseData = {
    phase,
    r1cs: null,
    qap: null,
    setup: null,
    proof: null,
    verifyResult: null,
  };

  const order = PHASE_ORDER.indexOf(phase);

  if (order >= 1) result.r1cs = buildR1CS(secretX);
  if (order >= 2 && result.r1cs) result.qap = r1csToQAP(result.r1cs);
  if (order >= 3) result.setup = trustedSetup();
  if (order >= 4 && result.qap && result.r1cs && result.setup) {
    let p = prove(result.qap, result.r1cs, result.setup);
    if (corrupt !== 'none') p = corruptProof(p, corrupt);
    result.proof = p;
  }
  if (order >= 5 && result.proof && result.setup && result.qap && result.r1cs) {
    result.verifyResult = verify(result.proof, result.setup, result.qap, result.r1cs.witness);
  }

  return result;
}
