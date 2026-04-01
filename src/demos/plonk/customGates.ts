import type { PlonkGate, PlonkCircuit, CopyConstraint } from './logic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CustomGateType =
  | 'add'       // qL·a + qR·b + qO·c + qC = 0
  | 'mul'       // qM·a·b + qO·c + qC = 0
  | 'bool'      // a·(1-a) = 0  (boolean constraint)
  | 'range4'    // a ∈ {0,1,2,3} via a·(a-1)·(a-2)·(a-3) = 0
  | 'poseidon'  // simplified: a^5 + qC = c  (S-box)
  | 'ec_add'    // simplified EC point addition gate
  | 'custom';   // user-defined with arbitrary selectors

export interface CustomGateDefinition {
  type: CustomGateType;
  label: string;
  /** Extended selectors beyond standard PLONK */
  selectors: {
    qL: number;
    qR: number;
    qO: number;
    qM: number;  // a·b
    qC: number;
    q4?: number; // a² selector
    q5?: number; // b² selector
    q6?: number; // a²·b selector
  };
  /** Should return 0 when the constraint is satisfied */
  evaluate: (a: number, b: number, c: number) => number;
  /** Polynomial degree of this gate */
  degree: number;
}

export interface CustomCircuit {
  gates: CustomCircuitGate[];
  copyConstraints: CopyConstraint[];
}

export interface CustomCircuitGate {
  definition: CustomGateDefinition;
  a: number;
  b: number;
  c: number;
  satisfied: boolean;
}

export interface ProofSystemCost {
  system: 'plonk' | 'groth16' | 'halo2' | 'nova';
  gateCount: number;
  constraintCount: number;
  copyConstraints: number;
  proofSize: string;
  verifierCost: string;
  notes: string;
}

export interface CostComparison {
  circuitDescription: string;
  totalMultiplications: number;
  totalAdditions: number;
  totalBooleanChecks: number;
  totalCustomGates: number;
  systems: ProofSystemCost[];
}

// ---------------------------------------------------------------------------
// Built-in gate definitions
// ---------------------------------------------------------------------------

export const BUILTIN_GATES: Record<CustomGateType, CustomGateDefinition> = {
  add: {
    type: 'add',
    label: 'Addition gate',
    selectors: { qL: 1, qR: 1, qO: -1, qM: 0, qC: 0 },
    evaluate: (a, b, c) => 1 * a + 1 * b + -1 * c + 0,
    degree: 1,
  },

  mul: {
    type: 'mul',
    label: 'Multiplication gate',
    selectors: { qL: 0, qR: 0, qO: -1, qM: 1, qC: 0 },
    evaluate: (a, b, c) => 1 * a * b + -1 * c + 0,
    degree: 2,
  },

  bool: {
    type: 'bool',
    label: 'Boolean constraint',
    selectors: { qL: 1, qR: 0, qO: 0, qM: -1, qC: 0 },
    // a·(1-a) = 0  ⟹  a - a² = 0  ⟹  qL·a + qM·a·a = a + (-1)·a² = a - a²
    // We set b = a for evaluation so that qM·a·b = -1·a·a = -a²
    evaluate: (a, _b, _c) => a * (1 - a),
    degree: 2,
  },

  range4: {
    type: 'range4',
    label: 'Range-4 constraint',
    selectors: { qL: 0, qR: 0, qO: 0, qM: 0, qC: 0 },
    // a·(a-1)·(a-2)·(a-3) = 0  → satisfied iff a ∈ {0,1,2,3}
    // The `|| 0` normalizes -0 to +0 for strict equality checks.
    evaluate: (a, _b, _c) => a * (a - 1) * (a - 2) * (a - 3) || 0,
    degree: 4,
  },

  poseidon: {
    type: 'poseidon',
    label: 'Poseidon S-box',
    selectors: { qL: 0, qR: 0, qO: -1, qM: 0, qC: 0 },
    // a^5 + qC - c = 0  (simplified S-box, qC from selectors)
    evaluate: (a, _b, c) => a ** 5 - c,
    degree: 5,
  },

  ec_add: {
    type: 'ec_add',
    label: 'EC point addition',
    selectors: { qL: 0, qR: -1, qO: 0, qM: 1, qC: 0 },
    // simplified: (x2-x1)·λ - (y2-y1) = 0
    // stored as qM·a·b + qR·b + qC = a·b - b = 0
    evaluate: (a, b, _c) => a * b - b,
    degree: 2,
  },

  custom: {
    type: 'custom',
    label: 'Custom gate',
    selectors: { qL: 0, qR: 0, qO: 0, qM: 0, qC: 0 },
    evaluate: (_a, _b, _c) => 0,
    degree: 0,
  },
};

// ---------------------------------------------------------------------------
// Gate creation
// ---------------------------------------------------------------------------

/**
 * Create a gate definition from a built-in type, optionally overriding
 * individual selectors or properties.
 */
export function createCustomGate(
  type: CustomGateType,
  overrides?: Partial<Pick<CustomGateDefinition, 'label' | 'selectors' | 'evaluate' | 'degree'>>,
): CustomGateDefinition {
  const base = BUILTIN_GATES[type];
  return {
    ...base,
    ...overrides,
    type, // type is always preserved
    selectors: {
      ...base.selectors,
      ...(overrides?.selectors ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Circuit building & checking
// ---------------------------------------------------------------------------

/**
 * Evaluate a single custom gate and return whether it is satisfied.
 */
export function checkCustomGate(gate: CustomCircuitGate): boolean {
  return gate.definition.evaluate(gate.a, gate.b, gate.c) === 0;
}

/**
 * Build a custom circuit from gate definitions, wire values, and copy
 * constraints. Each gate is evaluated and marked satisfied/unsatisfied.
 */
export function buildCustomCircuit(
  gateDefs: CustomGateDefinition[],
  wireValues: { a: number; b: number; c: number }[],
  copyConstraints: CopyConstraint[] = [],
): CustomCircuit {
  const gates: CustomCircuitGate[] = gateDefs.map((def, i) => {
    const wires = wireValues[i] ?? { a: 0, b: 0, c: 0 };
    const gate: CustomCircuitGate = {
      definition: def,
      a: wires.a,
      b: wires.b,
      c: wires.c,
      satisfied: false, // computed below
    };
    gate.satisfied = checkCustomGate(gate);
    return gate;
  });
  return { gates, copyConstraints };
}

// ---------------------------------------------------------------------------
// Conversion to standard PLONK
// ---------------------------------------------------------------------------

/**
 * Convert a circuit that may contain higher-degree custom gates into an
 * equivalent circuit using only standard PLONK gates (degree <= 2).
 *
 * The returned PlonkCircuit is an *approximation* suitable for cost
 * estimation — wire values for intermediate decomposition gates use
 * placeholder values (the topology, not the exact witness, is the goal).
 */
export function convertToStandardPlonk(customCircuit: CustomCircuit): PlonkCircuit {
  const gates: PlonkGate[] = [];
  const copyConstraints: CopyConstraint[] = [...customCircuit.copyConstraints];

  for (const cg of customCircuit.gates) {
    switch (cg.definition.type) {
      case 'add': {
        gates.push({
          qL: cg.definition.selectors.qL,
          qR: cg.definition.selectors.qR,
          qO: cg.definition.selectors.qO,
          qM: 0,
          qC: cg.definition.selectors.qC,
          a: cg.a,
          b: cg.b,
          c: cg.c,
          label: 'Add',
        });
        break;
      }

      case 'mul': {
        gates.push({
          qL: 0,
          qR: 0,
          qO: cg.definition.selectors.qO,
          qM: cg.definition.selectors.qM,
          qC: cg.definition.selectors.qC,
          a: cg.a,
          b: cg.b,
          c: cg.c,
          label: 'Mul',
        });
        break;
      }

      case 'bool': {
        // a·(1-a) = 0  ⟹  a·a - a = 0  ⟹  qM=1, qL=-1
        gates.push({
          qL: -1,
          qR: 0,
          qO: 0,
          qM: 1,
          qC: 0,
          a: cg.a,
          b: cg.a, // b=a for squaring
          c: 0,
          label: 'Bool (a²-a=0)',
        });
        break;
      }

      case 'range4': {
        // a·(a-1)·(a-2)·(a-3) = 0
        // Decompose:
        //   t1 = a·(a-1)      → 1 mul gate  (a·a - a)
        //   t2 = (a-2)·(a-3)  → 1 mul gate  (a²-5a+6)
        //   t1·t2 = 0          → 1 mul gate
        const a = cg.a;
        const t1 = a * (a - 1);
        const t2 = (a - 2) * (a - 3);

        // Gate: a·a = t1 + a  → qM=1, qL=-1, qO=-1: a·a - a - t1 = 0
        gates.push({
          qL: -1, qR: 0, qO: -1, qM: 1, qC: 0,
          a, b: a, c: t1,
          label: 'Range4: t1=a(a-1)',
        });

        // Gate: (a-2)*(a-3) = a²-5a+6
        // Use a mul gate with intermediate values
        const aMinus2 = a - 2;
        const aMinus3 = a - 3;
        gates.push({
          qL: 0, qR: 0, qO: -1, qM: 1, qC: 0,
          a: aMinus2, b: aMinus3, c: t2,
          label: 'Range4: t2=(a-2)(a-3)',
        });

        // Gate: t1 * t2 = 0
        gates.push({
          qL: 0, qR: 0, qO: 0, qM: 1, qC: 0,
          a: t1, b: t2, c: 0,
          label: 'Range4: t1·t2=0',
        });
        break;
      }

      case 'poseidon': {
        // a^5 = ((a²)²)·a — decompose into 3 mul gates
        const a = cg.a;
        const a2 = a * a;
        const a4 = a2 * a2;
        const a5 = a4 * a;

        // Gate 1: a·a = a²
        gates.push({
          qL: 0, qR: 0, qO: -1, qM: 1, qC: 0,
          a, b: a, c: a2,
          label: 'Poseidon: a²',
        });

        // Gate 2: a²·a² = a⁴
        gates.push({
          qL: 0, qR: 0, qO: -1, qM: 1, qC: 0,
          a: a2, b: a2, c: a4,
          label: 'Poseidon: a⁴',
        });

        // Gate 3: a⁴·a = a⁵ = c
        gates.push({
          qL: 0, qR: 0, qO: -1, qM: 1, qC: 0,
          a: a4, b: a, c: a5,
          label: 'Poseidon: a⁵=c',
        });
        break;
      }

      case 'ec_add': {
        // Already degree 2 — maps directly to a mul gate
        gates.push({
          qL: cg.definition.selectors.qL,
          qR: cg.definition.selectors.qR,
          qO: cg.definition.selectors.qO,
          qM: cg.definition.selectors.qM,
          qC: cg.definition.selectors.qC,
          a: cg.a,
          b: cg.b,
          c: cg.c,
          label: 'EC add',
        });
        break;
      }

      case 'custom':
      default: {
        // Best-effort: treat as a generic gate (selectors may need
        // higher-degree support, but for costing we map 1:1)
        gates.push({
          qL: cg.definition.selectors.qL,
          qR: cg.definition.selectors.qR,
          qO: cg.definition.selectors.qO,
          qM: cg.definition.selectors.qM,
          qC: cg.definition.selectors.qC,
          a: cg.a,
          b: cg.b,
          c: cg.c,
          label: cg.definition.label,
        });
        break;
      }
    }
  }

  return { gates, copyConstraints };
}

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

function countByType(circuit: CustomCircuit): {
  muls: number;
  adds: number;
  bools: number;
  customs: number;
} {
  let muls = 0;
  let adds = 0;
  let bools = 0;
  let customs = 0;

  for (const g of circuit.gates) {
    switch (g.definition.type) {
      case 'mul':
        muls++;
        break;
      case 'add':
        adds++;
        break;
      case 'bool':
        bools++;
        break;
      default:
        customs++;
        break;
    }
  }
  return { muls, adds, bools, customs };
}

/**
 * Estimate the cost of a custom circuit across PLONK, Groth16, Halo2, and
 * Nova. Counts are concrete; descriptive fields give proof-size and verifier
 * cost summaries.
 */
export function estimateConstraintCost(customCircuit: CustomCircuit): CostComparison {
  const converted = convertToStandardPlonk(customCircuit);
  const { muls, adds, bools, customs } = countByType(customCircuit);
  const copyCount = customCircuit.copyConstraints.length;

  // --- PLONK ---
  const plonkGates = converted.gates.length;
  const plonkConstraints = plonkGates; // 1 constraint per gate row
  const plonkCopy = converted.copyConstraints.length;

  // --- Groth16 ---
  // R1CS: each multiplication = 1 constraint, additions are free (linear
  // combinations), boolean = 1 mul (a*a=a), custom gates decompose similarly.
  // We count mul gates in the converted circuit as R1CS constraints.
  let groth16Constraints = 0;
  for (const g of converted.gates) {
    if (g.qM !== 0) {
      groth16Constraints++;
    }
  }
  // Additions still produce constraints in R1CS if they bind an output wire
  // (the output equality is a linear constraint which R1CS handles for free
  // only when merged). For a conservative estimate, add 1 per add gate.
  for (const g of converted.gates) {
    if (g.qM === 0 && (g.qL !== 0 || g.qR !== 0)) {
      groth16Constraints++;
    }
  }

  // --- Halo2 ---
  // Halo2 / PLONKish with custom gates can handle higher-degree gates
  // directly using wider columns. Rows = original gate count (no
  // decomposition), but column count increases.
  const halo2Gates = customCircuit.gates.length;
  const halo2Constraints = halo2Gates;

  // --- Nova ---
  // Relaxed R1CS. Each multiplication = 1 constraint, folding adds a small
  // per-step overhead. We model it as Groth16 constraints + 1 folding
  // constraint per step.
  const novaConstraints = groth16Constraints + 1; // +1 for folding overhead

  const description = buildCircuitDescription(customCircuit);

  return {
    circuitDescription: description,
    totalMultiplications: muls,
    totalAdditions: adds,
    totalBooleanChecks: bools,
    totalCustomGates: customs,
    systems: [
      {
        system: 'plonk',
        gateCount: plonkGates,
        constraintCount: plonkConstraints,
        copyConstraints: plonkCopy,
        proofSize: '~9 group elements',
        verifierCost: `1 MSM of size ${plonkGates}`,
        notes: `Standard PLONK requires ${plonkGates} rows after decomposition of high-degree gates.`,
      },
      {
        system: 'groth16',
        gateCount: groth16Constraints,
        constraintCount: groth16Constraints,
        copyConstraints: 0, // R1CS uses witness wiring, not copy constraints
        proofSize: '~3 group elements',
        verifierCost: '3 pairings + 1 MSM',
        notes: `R1CS: ${groth16Constraints} constraints. Additions folded into linear combinations where possible.`,
      },
      {
        system: 'halo2',
        gateCount: halo2Gates,
        constraintCount: halo2Constraints,
        copyConstraints: copyCount,
        proofSize: '~log(n) group elements (IPA)',
        verifierCost: `O(n) scalar muls`,
        notes: `Custom gates handled natively in ${halo2Gates} rows with wider columns.`,
      },
      {
        system: 'nova',
        gateCount: groth16Constraints,
        constraintCount: novaConstraints,
        copyConstraints: 0,
        proofSize: '~3 group elements (per fold)',
        verifierCost: '2 MSMs per step',
        notes: `Relaxed R1CS: ${groth16Constraints} constraints + 1 folding overhead.`,
      },
    ],
  };
}

function buildCircuitDescription(circuit: CustomCircuit): string {
  const types = circuit.gates.map((g) => g.definition.type);
  const uniqueTypes = [...new Set(types)];
  return `${circuit.gates.length} gates (${uniqueTypes.join(', ')})`;
}

// ---------------------------------------------------------------------------
// Example circuits
// ---------------------------------------------------------------------------

/**
 * Return three example custom circuits for the UI.
 */
export function buildExampleCircuits(): { name: string; circuit: CustomCircuit }[] {
  return [
    buildHashPreimageCircuit(),
    buildRangeProofCircuit(),
    buildECOperationCircuit(),
  ];
}

function buildHashPreimageCircuit(): { name: string; circuit: CustomCircuit } {
  // "Hash preimage" — mix of poseidon + bool gates
  const poseidon = BUILTIN_GATES.poseidon;
  const boolGate = BUILTIN_GATES.bool;

  // Input bit (must be 0 or 1)
  // Poseidon S-box: a^5 = c  → a=2, c=32
  // Another bool check
  const gateDefs = [boolGate, poseidon, boolGate];
  const wireValues = [
    { a: 1, b: 0, c: 0 },     // bool: 1*(1-1)=0 ✓
    { a: 2, b: 0, c: 32 },    // poseidon: 2^5=32 ✓
    { a: 0, b: 0, c: 0 },     // bool: 0*(1-0)=0 ✓
  ];
  const copyConstraints: CopyConstraint[] = [
    { from: { gate: 0, wire: 'a' }, to: { gate: 1, wire: 'b' } },
  ];

  return {
    name: 'Hash preimage',
    circuit: buildCustomCircuit(gateDefs, wireValues, copyConstraints),
  };
}

function buildRangeProofCircuit(): { name: string; circuit: CustomCircuit } {
  // "Range proof" — range4 + bool gates
  const range4 = BUILTIN_GATES.range4;
  const boolGate = BUILTIN_GATES.bool;

  const gateDefs = [boolGate, range4, range4];
  const wireValues = [
    { a: 1, b: 0, c: 0 },   // bool: 1 is boolean ✓
    { a: 2, b: 0, c: 0 },   // range4: 2 ∈ {0,1,2,3} ✓
    { a: 3, b: 0, c: 0 },   // range4: 3 ∈ {0,1,2,3} ✓
  ];
  const copyConstraints: CopyConstraint[] = [];

  return {
    name: 'Range proof',
    circuit: buildCustomCircuit(gateDefs, wireValues, copyConstraints),
  };
}

function buildECOperationCircuit(): { name: string; circuit: CustomCircuit } {
  // "EC operation" — ec_add + mul gates
  const ecAdd = BUILTIN_GATES.ec_add;
  const mul = BUILTIN_GATES.mul;

  // ec_add evaluate: a*b - b = 0  → satisfied when a=1 (or b=0)
  // mul evaluate: a*b - c = 0
  const gateDefs = [mul, ecAdd, mul];
  const wireValues = [
    { a: 3, b: 4, c: 12 },  // mul: 3*4=12 ✓
    { a: 1, b: 5, c: 0 },   // ec_add: 1*5 - 5 = 0 ✓
    { a: 12, b: 5, c: 60 }, // mul: 12*5=60 ✓
  ];
  const copyConstraints: CopyConstraint[] = [
    { from: { gate: 0, wire: 'c' }, to: { gate: 2, wire: 'a' } },
    { from: { gate: 1, wire: 'b' }, to: { gate: 2, wire: 'b' } },
  ];

  return {
    name: 'EC operation',
    circuit: buildCustomCircuit(gateDefs, wireValues, copyConstraints),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Human-readable description of what a gate checks.
 */
export function describeGate(gate: CustomGateDefinition): string {
  switch (gate.type) {
    case 'add':
      return `Addition: ${gate.selectors.qL}·a + ${gate.selectors.qR}·b + ${gate.selectors.qO}·c + ${gate.selectors.qC} = 0`;
    case 'mul':
      return `Multiplication: ${gate.selectors.qM}·a·b + ${gate.selectors.qO}·c + ${gate.selectors.qC} = 0`;
    case 'bool':
      return 'Boolean: a·(1-a) = 0 — enforces a ∈ {0,1}';
    case 'range4':
      return 'Range-4: a·(a-1)·(a-2)·(a-3) = 0 — enforces a ∈ {0,1,2,3}';
    case 'poseidon':
      return 'Poseidon S-box: a⁵ - c = 0 (simplified S-box exponentiation)';
    case 'ec_add':
      return 'EC point addition: (x₂-x₁)·λ - (y₂-y₁) = 0 (simplified)';
    case 'custom':
      return `Custom gate: ${gate.label}`;
    default:
      return gate.label;
  }
}

/**
 * Count gates by polynomial degree.
 */
export function degreeSummary(
  customCircuit: CustomCircuit,
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const g of customCircuit.gates) {
    const d = g.definition.degree;
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}
