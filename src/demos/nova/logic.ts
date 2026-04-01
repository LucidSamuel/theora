/**
 * Nova Folding Scheme — pure logic.
 *
 * Nova is an IVC (Incrementally Verifiable Computation) folding scheme that
 * compresses two R1CS instances into one without full SNARK proving. The key
 * insight is "relaxed R1CS": instead of Az ∘ Bz = Cz, we have
 *
 *   Az ∘ Bz = u·Cz + E
 *
 * where u is a scalar and E is an error vector. A standard R1CS instance is
 * the special case u=1, E=0. Two relaxed instances can be folded into one
 * using a random linear combination — a single hash-based challenge from the
 * verifier. After n folding steps the accumulated instance is a constant-size
 * "summary" of all n computation steps.
 *
 * All arithmetic is over GF(101) using BigInt for consistency with the rest
 * of Theora's educational demos. Real Nova operates over 254-bit prime fields
 * with Pedersen commitments; the algebraic structure here is identical.
 */

/* ── field helpers ───────────────────────────────────────────────────────── */

/** Reduce a mod p into [0, p). */
function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/** Hadamard (element-wise) product of two vectors mod p. */
function hadamard(a: bigint[], b: bigint[], p: bigint): bigint[] {
  if (a.length !== b.length) throw new Error('hadamard: length mismatch');
  return a.map((v, i) => mod(v * b[i]!, p));
}

/** Matrix-vector product mod p. M is m×n, v is length n. Returns length m. */
function matvec(M: bigint[][], v: bigint[], p: bigint): bigint[] {
  return M.map((row) => {
    let sum = 0n;
    for (let j = 0; j < row.length; j++) {
      sum = mod(sum + mod(row[j]! * v[j]!, p), p);
    }
    return sum;
  });
}

/** Scalar-vector multiply mod p. */
function scalarVec(s: bigint, v: bigint[], p: bigint): bigint[] {
  return v.map((x) => mod(s * x, p));
}

/** Vector addition mod p. */
function vecAdd(a: bigint[], b: bigint[], p: bigint): bigint[] {
  if (a.length !== b.length) throw new Error('vecAdd: length mismatch');
  return a.map((v, i) => mod(v + b[i]!, p));
}

/** Zero vector of length n. */
function zeroVec(n: number): bigint[] {
  return new Array(n).fill(0n);
}

/**
 * Simulated commitment: a simple hash-like mapping for educational purposes.
 * Real Nova uses Pedersen commitments; we simulate with a deterministic
 * combination mod p to keep things tractable.
 */
function simulatedCommitment(values: bigint[], p: bigint): bigint {
  let h = 7n; // arbitrary seed
  for (const v of values) {
    h = mod(h * 31n + v, p);
  }
  return h;
}

/* ── types ───────────────────────────────────────────────────────────────── */

export interface R1CSMatrices {
  A: bigint[][]; // m × n matrix
  B: bigint[][]; // m × n matrix
  C: bigint[][]; // m × n matrix
  m: number; // number of constraints
  n: number; // number of variables (including 1 for constant term)
}

export interface RelaxedR1CSInstance {
  u: bigint; // scalar (1 for non-relaxed)
  commitment: bigint; // commitment to witness (simulated hash)
  x: bigint[]; // public inputs
}

export interface RelaxedR1CSWitness {
  W: bigint[]; // full witness vector (including public inputs as first entries)
  E: bigint[]; // error vector (zero vector for non-relaxed)
}

export interface FoldingStep {
  stepNumber: number;
  instance1: RelaxedR1CSInstance;
  instance2: RelaxedR1CSInstance;
  crossTerm: bigint[]; // T = Az₁ ∘ Bz₂ + Az₂ ∘ Bz₁ − u₁·Cz₂ − u₂·Cz₁
  challenge: bigint; // random r from verifier
  foldedInstance: RelaxedR1CSInstance;
  foldedWitness: RelaxedR1CSWitness;
  satisfied: boolean; // does the folded instance satisfy relaxed R1CS?
}

export interface NovaState {
  matrices: R1CSMatrices;
  steps: FoldingStep[];
  currentStep: number;
  fieldSize: bigint;
}

/* ── circuit construction ────────────────────────────────────────────────── */

/**
 * Build a simple circuit: f(x) = x² + x + 5
 *
 * Witness vector: z = [1, x, y, t] where:
 *   - z[0] = 1  (constant term)
 *   - z[1] = x  (private input)
 *   - z[2] = y  (public output, y = x² + x + 5)
 *   - z[3] = t  (intermediate wire, t = x²)
 *
 * Constraints (standard R1CS: Az ∘ Bz = Cz):
 *   1. t = x · x           →  A=[0,1,0,0], B=[0,1,0,0], C=[0,0,0,1]
 *   2. y = t + x + 5       →  rewrite as (t + x + 5) · 1 = y
 *                              A=[5,1,0,1], B=[1,0,0,0], C=[0,0,1,0]
 */
export function buildSimpleCircuit(): R1CSMatrices {
  const A: bigint[][] = [
    [0n, 1n, 0n, 0n], // constraint 1: select x
    [5n, 1n, 0n, 1n], // constraint 2: t + x + 5
  ];
  const B: bigint[][] = [
    [0n, 1n, 0n, 0n], // constraint 1: select x
    [1n, 0n, 0n, 0n], // constraint 2: multiply by 1
  ];
  const C: bigint[][] = [
    [0n, 0n, 0n, 1n], // constraint 1: result is t
    [0n, 0n, 1n, 0n], // constraint 2: result is y
  ];

  return { A, B, C, m: 2, n: 4 };
}

/* ── instance/witness creation ───────────────────────────────────────────── */

/**
 * Create an initial (non-relaxed) R1CS instance from a witness vector.
 * The instance has u=1 and E=zero — equivalent to standard R1CS.
 *
 * @param matrices  The R1CS constraint matrices
 * @param witness   Full witness vector z = [1, x, y, t, ...]
 * @param p         Field modulus
 */
export function createInstance(
  matrices: R1CSMatrices,
  witness: bigint[],
  p: bigint,
): { instance: RelaxedR1CSInstance; witness: RelaxedR1CSWitness } {
  if (witness.length !== matrices.n) {
    throw new Error(
      `witness length ${witness.length} does not match n=${matrices.n}`,
    );
  }

  // Normalize witness values mod p
  const W = witness.map((v) => mod(v, p));

  // Public inputs are everything after the constant term and before the
  // intermediate wires. For our simple circuit: x = [y] (the public output).
  // Convention: z[0] = 1 (constant), z[1] = private input x,
  // z[2] = public output y. We expose y as the public input.
  const x = [W[2]!];

  const instance: RelaxedR1CSInstance = {
    u: 1n,
    commitment: simulatedCommitment(W, p),
    x,
  };

  const witnessObj: RelaxedR1CSWitness = {
    W,
    E: zeroVec(matrices.m),
  };

  return { instance, witness: witnessObj };
}

/* ── relaxed R1CS check ──────────────────────────────────────────────────── */

/**
 * Check if a relaxed R1CS instance is satisfied:
 *   Az ∘ Bz = u · Cz + E
 *
 * For a standard (non-relaxed) instance, u=1 and E=0, so this reduces to
 * the standard check Az ∘ Bz = Cz.
 */
export function checkRelaxedR1CS(
  matrices: R1CSMatrices,
  instance: RelaxedR1CSInstance,
  witness: RelaxedR1CSWitness,
  p: bigint,
): boolean {
  const z = witness.W;
  const Az = matvec(matrices.A, z, p);
  const Bz = matvec(matrices.B, z, p);
  const Cz = matvec(matrices.C, z, p);

  // LHS: Az ∘ Bz (Hadamard product)
  const lhs = hadamard(Az, Bz, p);

  // RHS: u · Cz + E
  const uCz = scalarVec(instance.u, Cz, p);
  const rhs = vecAdd(uCz, witness.E, p);

  // Check equality element-wise
  for (let i = 0; i < matrices.m; i++) {
    if (mod(lhs[i]!, p) !== mod(rhs[i]!, p)) {
      return false;
    }
  }
  return true;
}

/* ── cross-term computation ──────────────────────────────────────────────── */

/**
 * Compute the cross-term T for folding two instances.
 *
 * Given witnesses z₁, z₂ and scalars u₁, u₂:
 *   T = Az₁ ∘ Bz₂ + Az₂ ∘ Bz₁ − u₁·Cz₂ − u₂·Cz₁
 *
 * This cross-term captures the "interaction" between the two instances.
 * When we fold z' = z₁ + r·z₂, the relaxed equation for the folded
 * instance holds if and only if the error vector absorbs T scaled by r.
 */
export function computeCrossTerm(
  matrices: R1CSMatrices,
  z1: bigint[],
  z2: bigint[],
  u1: bigint,
  u2: bigint,
  p: bigint,
): bigint[] {
  const Az1 = matvec(matrices.A, z1, p);
  const Bz1 = matvec(matrices.B, z1, p);
  const Az2 = matvec(matrices.A, z2, p);
  const Bz2 = matvec(matrices.B, z2, p);
  const Cz1 = matvec(matrices.C, z1, p);
  const Cz2 = matvec(matrices.C, z2, p);

  // T = Az₁ ∘ Bz₂ + Az₂ ∘ Bz₁ − u₁·Cz₂ − u₂·Cz₁
  const term1 = hadamard(Az1, Bz2, p);
  const term2 = hadamard(Az2, Bz1, p);
  const term3 = scalarVec(u1, Cz2, p);
  const term4 = scalarVec(u2, Cz1, p);

  const T: bigint[] = [];
  for (let i = 0; i < matrices.m; i++) {
    T.push(mod(term1[i]! + term2[i]! - term3[i]! - term4[i]!, p));
  }
  return T;
}

/* ── folding ─────────────────────────────────────────────────────────────── */

/**
 * Fold two relaxed R1CS instances into one.
 *
 * Given instances (u₁, E₁, W₁), (u₂, E₂, W₂) and verifier challenge r:
 *   u' = u₁ + r · u₂
 *   W' = W₁ + r · W₂
 *   E' = E₁ + r · T + r² · E₂
 *
 * The folded instance satisfies the relaxed R1CS equation if and only if
 * both original instances did.
 */
export function foldInstances(
  matrices: R1CSMatrices,
  inst1: RelaxedR1CSInstance,
  wit1: RelaxedR1CSWitness,
  inst2: RelaxedR1CSInstance,
  wit2: RelaxedR1CSWitness,
  challenge: bigint,
  p: bigint,
): FoldingStep {
  const r = mod(challenge, p);

  // Compute cross-term
  const T = computeCrossTerm(
    matrices,
    wit1.W,
    wit2.W,
    inst1.u,
    inst2.u,
    p,
  );

  // Fold scalar: u' = u₁ + r · u₂
  const foldedU = mod(inst1.u + r * inst2.u, p);

  // Fold witness: W' = W₁ + r · W₂
  const foldedW = vecAdd(wit1.W, scalarVec(r, wit2.W, p), p);

  // Fold error: E' = E₁ + r · T + r² · E₂
  const rT = scalarVec(r, T, p);
  const r2E2 = scalarVec(mod(r * r, p), wit2.E, p);
  const foldedE = vecAdd(vecAdd(wit1.E, rT, p), r2E2, p);

  // Fold public inputs: x' = x₁ + r · x₂
  const foldedX: bigint[] = [];
  const maxLen = Math.max(inst1.x.length, inst2.x.length);
  for (let i = 0; i < maxLen; i++) {
    const a = inst1.x[i] ?? 0n;
    const b = inst2.x[i] ?? 0n;
    foldedX.push(mod(a + r * b, p));
  }

  // Fold commitment: commit' = commit₁ + r · commit₂ (homomorphic)
  const foldedCommitment = mod(
    inst1.commitment + r * inst2.commitment,
    p,
  );

  const foldedInstance: RelaxedR1CSInstance = {
    u: foldedU,
    commitment: foldedCommitment,
    x: foldedX,
  };

  const foldedWitness: RelaxedR1CSWitness = {
    W: foldedW,
    E: foldedE,
  };

  const satisfied = checkRelaxedR1CS(matrices, foldedInstance, foldedWitness, p);

  return {
    stepNumber: 0, // caller should set this
    instance1: inst1,
    instance2: inst2,
    crossTerm: T,
    challenge: r,
    foldedInstance,
    foldedWitness,
    satisfied,
  };
}

/* ── IVC simulation ──────────────────────────────────────────────────────── */

/**
 * Run n folding steps simulating IVC (Incrementally Verifiable Computation).
 *
 * Each step folds the running accumulated instance with a new "fresh" instance.
 * The first witness in the array becomes the initial accumulated instance;
 * each subsequent witness is a new computation step that gets folded in.
 *
 * @param matrices    R1CS constraint system
 * @param witnesses   Array of witness vectors (at least 2)
 * @param challenges  Array of verifier challenges (one per fold, length = witnesses.length - 1)
 * @param p           Field modulus
 */
export function runNovaIVC(
  matrices: R1CSMatrices,
  witnesses: bigint[][],
  challenges: bigint[],
  p: bigint,
): NovaState {
  if (witnesses.length < 2) {
    throw new Error('IVC requires at least 2 witnesses');
  }
  if (challenges.length !== witnesses.length - 1) {
    throw new Error(
      `need ${witnesses.length - 1} challenges for ${witnesses.length} witnesses`,
    );
  }

  const steps: FoldingStep[] = [];

  // Initialize the running instance from the first witness
  const { instance: accInst, witness: accWit } = createInstance(
    matrices,
    witnesses[0]!,
    p,
  );

  let runningInst = accInst;
  let runningWit = accWit;

  // Fold each subsequent witness into the running accumulator
  for (let i = 1; i < witnesses.length; i++) {
    const { instance: newInst, witness: newWit } = createInstance(
      matrices,
      witnesses[i]!,
      p,
    );

    const step = foldInstances(
      matrices,
      runningInst,
      runningWit,
      newInst,
      newWit,
      challenges[i - 1]!,
      p,
    );

    step.stepNumber = i;

    steps.push(step);

    // The folded result becomes the new running accumulator
    runningInst = step.foldedInstance;
    runningWit = step.foldedWitness;
  }

  return {
    matrices,
    steps,
    currentStep: steps.length,
    fieldSize: p,
  };
}

/**
 * Rebuild the first k folding steps of a Nova IVC run from deterministic inputs.
 *
 * This is used by URL restore so in-progress folding sessions can round-trip
 * without serializing every intermediate witness blob into the URL itself.
 */
export function replayNovaIVC(
  matrices: R1CSMatrices,
  witnesses: bigint[][],
  challenges: bigint[],
  completedSteps: number,
  p: bigint,
): NovaState {
  const fullState = runNovaIVC(matrices, witnesses, challenges, p);
  const clampedSteps = Math.max(1, Math.min(completedSteps, fullState.steps.length));
  return {
    ...fullState,
    steps: fullState.steps.slice(0, clampedSteps),
    currentStep: clampedSteps,
  };
}
