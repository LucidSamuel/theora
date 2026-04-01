import { describe, it, expect } from 'vitest';
import {
  BUILTIN_GATES,
  createCustomGate,
  buildCustomCircuit,
  checkCustomGate,
  convertToStandardPlonk,
  estimateConstraintCost,
  buildExampleCircuits,
  describeGate,
  degreeSummary,
} from '../demos/plonk/customGates';
import type { CustomCircuitGate } from '../demos/plonk/customGates';
import type { CopyConstraint } from '../demos/plonk/logic';
import { checkGate } from '../demos/plonk/logic';

// ---------------------------------------------------------------------------
// BUILTIN_GATES
// ---------------------------------------------------------------------------

describe('BUILTIN_GATES', () => {
  it('has all seven gate types', () => {
    const types = Object.keys(BUILTIN_GATES);
    expect(types).toContain('add');
    expect(types).toContain('mul');
    expect(types).toContain('bool');
    expect(types).toContain('range4');
    expect(types).toContain('poseidon');
    expect(types).toContain('ec_add');
    expect(types).toContain('custom');
    expect(types).toHaveLength(7);
  });

  it('add gate has degree 1', () => {
    expect(BUILTIN_GATES.add.degree).toBe(1);
  });

  it('mul gate has degree 2', () => {
    expect(BUILTIN_GATES.mul.degree).toBe(2);
  });

  it('range4 gate has degree 4', () => {
    expect(BUILTIN_GATES.range4.degree).toBe(4);
  });

  it('poseidon gate has degree 5', () => {
    expect(BUILTIN_GATES.poseidon.degree).toBe(5);
  });

  it('add gate satisfied for 3+4=7', () => {
    // qL·a + qR·b + qO·c + qC = 1·3 + 1·4 + (-1)·7 + 0 = 0
    expect(BUILTIN_GATES.add.evaluate(3, 4, 7)).toBe(0);
  });

  it('add gate unsatisfied for 3+4=8', () => {
    expect(BUILTIN_GATES.add.evaluate(3, 4, 8)).not.toBe(0);
  });

  it('mul gate satisfied for 3*4=12', () => {
    expect(BUILTIN_GATES.mul.evaluate(3, 4, 12)).toBe(0);
  });

  it('mul gate unsatisfied for 3*4=11', () => {
    expect(BUILTIN_GATES.mul.evaluate(3, 4, 11)).not.toBe(0);
  });

  it('bool gate satisfied for a=0', () => {
    expect(BUILTIN_GATES.bool.evaluate(0, 0, 0)).toBe(0);
  });

  it('bool gate satisfied for a=1', () => {
    expect(BUILTIN_GATES.bool.evaluate(1, 0, 0)).toBe(0);
  });

  it('bool gate unsatisfied for a=2', () => {
    expect(BUILTIN_GATES.bool.evaluate(2, 0, 0)).not.toBe(0);
  });

  it('bool gate unsatisfied for a=-1', () => {
    expect(BUILTIN_GATES.bool.evaluate(-1, 0, 0)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// range4
// ---------------------------------------------------------------------------

describe('range4 gate', () => {
  it('satisfied for 0, 1, 2, 3', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(BUILTIN_GATES.range4.evaluate(v, 0, 0)).toBe(0);
    }
  });

  it('unsatisfied for 4', () => {
    expect(BUILTIN_GATES.range4.evaluate(4, 0, 0)).not.toBe(0);
  });

  it('unsatisfied for -1', () => {
    expect(BUILTIN_GATES.range4.evaluate(-1, 0, 0)).not.toBe(0);
  });

  it('unsatisfied for 10', () => {
    expect(BUILTIN_GATES.range4.evaluate(10, 0, 0)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// poseidon
// ---------------------------------------------------------------------------

describe('poseidon gate', () => {
  it('satisfied when c = a^5', () => {
    // 2^5 = 32
    expect(BUILTIN_GATES.poseidon.evaluate(2, 0, 32)).toBe(0);
  });

  it('satisfied for a=3, c=243', () => {
    expect(BUILTIN_GATES.poseidon.evaluate(3, 0, 243)).toBe(0);
  });

  it('unsatisfied when c != a^5', () => {
    expect(BUILTIN_GATES.poseidon.evaluate(2, 0, 31)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createCustomGate
// ---------------------------------------------------------------------------

describe('createCustomGate', () => {
  it('creates a gate matching the built-in type', () => {
    const gate = createCustomGate('add');
    expect(gate.type).toBe('add');
    expect(gate.degree).toBe(1);
    expect(gate.selectors.qL).toBe(1);
  });

  it('applies selector overrides', () => {
    const gate = createCustomGate('add', {
      selectors: { qL: 2, qR: 3, qO: -1, qM: 0, qC: 0 },
    });
    expect(gate.selectors.qL).toBe(2);
    expect(gate.selectors.qR).toBe(3);
  });

  it('applies partial selector overrides without clobbering others', () => {
    const gate = createCustomGate('mul', {
      selectors: { qC: 5 } as any, // partial override
    });
    expect(gate.selectors.qM).toBe(1); // preserved from built-in
    expect(gate.selectors.qC).toBe(5); // overridden
  });

  it('preserves type even when other fields are overridden', () => {
    const gate = createCustomGate('bool', { label: 'My bool', degree: 99 });
    expect(gate.type).toBe('bool');
    expect(gate.label).toBe('My bool');
    expect(gate.degree).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// buildCustomCircuit & checkCustomGate
// ---------------------------------------------------------------------------

describe('buildCustomCircuit', () => {
  it('marks satisfied gates correctly', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul],
      [
        { a: 3, b: 4, c: 7 },   // 3+4-7=0 ✓
        { a: 3, b: 4, c: 12 },  // 3*4-12=0 ✓
      ],
    );
    expect(circuit.gates).toHaveLength(2);
    expect(circuit.gates[0]!.satisfied).toBe(true);
    expect(circuit.gates[1]!.satisfied).toBe(true);
  });

  it('marks unsatisfied gates correctly', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add],
      [{ a: 3, b: 4, c: 99 }],
    );
    expect(circuit.gates[0]!.satisfied).toBe(false);
  });

  it('handles empty circuit', () => {
    const circuit = buildCustomCircuit([], []);
    expect(circuit.gates).toHaveLength(0);
    expect(circuit.copyConstraints).toHaveLength(0);
  });

  it('includes copy constraints', () => {
    const cc: CopyConstraint[] = [
      { from: { gate: 0, wire: 'c' }, to: { gate: 1, wire: 'a' } },
    ];
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul],
      [
        { a: 3, b: 4, c: 7 },
        { a: 7, b: 2, c: 14 },
      ],
      cc,
    );
    expect(circuit.copyConstraints).toHaveLength(1);
    expect(circuit.copyConstraints[0]!.from.gate).toBe(0);
  });
});

describe('checkCustomGate (standalone)', () => {
  it('returns true for a satisfied gate', () => {
    const gate: CustomCircuitGate = {
      definition: BUILTIN_GATES.mul,
      a: 5, b: 6, c: 30,
      satisfied: false,
    };
    expect(checkCustomGate(gate)).toBe(true);
  });

  it('returns false for an unsatisfied gate', () => {
    const gate: CustomCircuitGate = {
      definition: BUILTIN_GATES.mul,
      a: 5, b: 6, c: 31,
      satisfied: false,
    };
    expect(checkCustomGate(gate)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// convertToStandardPlonk
// ---------------------------------------------------------------------------

describe('convertToStandardPlonk', () => {
  it('bool → 1 standard gate', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.bool],
      [{ a: 1, b: 0, c: 0 }],
    );
    const plonk = convertToStandardPlonk(circuit);
    expect(plonk.gates).toHaveLength(1);
    // The converted bool gate uses qM=1, qL=-1: a²-a = 0
    const g = plonk.gates[0]!;
    expect(g.qM).toBe(1);
    expect(g.qL).toBe(-1);
  });

  it('range4 → 3 standard gates', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.range4],
      [{ a: 2, b: 0, c: 0 }],
    );
    const plonk = convertToStandardPlonk(circuit);
    expect(plonk.gates).toHaveLength(3);
  });

  it('poseidon → 3 standard gates (a² → a⁴ → a⁵)', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.poseidon],
      [{ a: 2, b: 0, c: 32 }],
    );
    const plonk = convertToStandardPlonk(circuit);
    expect(plonk.gates).toHaveLength(3);
  });

  it('total gate count increases for high-degree circuits', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.poseidon, BUILTIN_GATES.range4, BUILTIN_GATES.bool],
      [
        { a: 2, b: 0, c: 32 },
        { a: 1, b: 0, c: 0 },
        { a: 0, b: 0, c: 0 },
      ],
    );
    const plonk = convertToStandardPlonk(circuit);
    // poseidon→3, range4→3, bool→1 = 7
    expect(plonk.gates.length).toBe(7);
    expect(plonk.gates.length).toBeGreaterThan(circuit.gates.length);
  });

  it('resulting circuit gates are valid standard PLONK for satisfied inputs', () => {
    // poseidon with a=2, c=32 should produce valid intermediate gates
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.poseidon],
      [{ a: 2, b: 0, c: 32 }],
    );
    const plonk = convertToStandardPlonk(circuit);
    for (const gate of plonk.gates) {
      expect(checkGate(gate)).toBe(true);
    }
  });

  it('preserves copy constraints', () => {
    const cc: CopyConstraint[] = [
      { from: { gate: 0, wire: 'c' }, to: { gate: 1, wire: 'a' } },
    ];
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul],
      [
        { a: 1, b: 2, c: 3 },
        { a: 3, b: 4, c: 12 },
      ],
      cc,
    );
    const plonk = convertToStandardPlonk(circuit);
    expect(plonk.copyConstraints).toHaveLength(1);
  });

  it('add and mul gates convert 1:1', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul],
      [
        { a: 2, b: 3, c: 5 },
        { a: 2, b: 3, c: 6 },
      ],
    );
    const plonk = convertToStandardPlonk(circuit);
    expect(plonk.gates).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// estimateConstraintCost
// ---------------------------------------------------------------------------

describe('estimateConstraintCost', () => {
  it('returns all 4 proof systems', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.mul],
      [{ a: 3, b: 4, c: 12 }],
    );
    const cost = estimateConstraintCost(circuit);
    const systems = cost.systems.map((s) => s.system);
    expect(systems).toEqual(['plonk', 'groth16', 'halo2', 'nova']);
  });

  it('PLONK gate count >= custom gate count', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.poseidon, BUILTIN_GATES.range4],
      [
        { a: 2, b: 0, c: 32 },
        { a: 1, b: 0, c: 0 },
      ],
    );
    const cost = estimateConstraintCost(circuit);
    const plonk = cost.systems.find((s) => s.system === 'plonk')!;
    expect(plonk.gateCount).toBeGreaterThanOrEqual(circuit.gates.length);
  });

  it('Groth16 counts only mul-type constraints', () => {
    // 1 add + 1 mul → groth16 should have fewer constraints than plonk total
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul],
      [
        { a: 1, b: 2, c: 3 },
        { a: 3, b: 4, c: 12 },
      ],
    );
    const cost = estimateConstraintCost(circuit);
    const groth16 = cost.systems.find((s) => s.system === 'groth16')!;
    // The add gate has qM=0 but qL!=0 → still gets counted as a linear constraint.
    // The mul gate has qM!=0 → counted.
    expect(groth16.constraintCount).toBeGreaterThanOrEqual(1);
  });

  it('Halo2 uses original gate count (no decomposition)', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.poseidon, BUILTIN_GATES.range4],
      [
        { a: 2, b: 0, c: 32 },
        { a: 1, b: 0, c: 0 },
      ],
    );
    const cost = estimateConstraintCost(circuit);
    const halo2 = cost.systems.find((s) => s.system === 'halo2')!;
    expect(halo2.gateCount).toBe(2); // original gates, no decomposition
  });

  it('Nova includes folding overhead', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.mul],
      [{ a: 3, b: 4, c: 12 }],
    );
    const cost = estimateConstraintCost(circuit);
    const groth16 = cost.systems.find((s) => s.system === 'groth16')!;
    const nova = cost.systems.find((s) => s.system === 'nova')!;
    expect(nova.constraintCount).toBe(groth16.constraintCount + 1);
  });

  it('reports correct multiplication / addition / boolean / custom totals', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul, BUILTIN_GATES.bool, BUILTIN_GATES.poseidon],
      [
        { a: 1, b: 2, c: 3 },
        { a: 3, b: 4, c: 12 },
        { a: 1, b: 0, c: 0 },
        { a: 2, b: 0, c: 32 },
      ],
    );
    const cost = estimateConstraintCost(circuit);
    expect(cost.totalAdditions).toBe(1);
    expect(cost.totalMultiplications).toBe(1);
    expect(cost.totalBooleanChecks).toBe(1);
    expect(cost.totalCustomGates).toBe(1); // poseidon is "custom" category
  });
});

// ---------------------------------------------------------------------------
// buildExampleCircuits
// ---------------------------------------------------------------------------

describe('buildExampleCircuits', () => {
  it('returns 3 circuits', () => {
    const examples = buildExampleCircuits();
    expect(examples).toHaveLength(3);
  });

  it('each example has a name', () => {
    const examples = buildExampleCircuits();
    for (const ex of examples) {
      expect(ex.name.length).toBeGreaterThan(0);
    }
  });

  it('each example circuit has all gates satisfied', () => {
    const examples = buildExampleCircuits();
    for (const ex of examples) {
      for (const gate of ex.circuit.gates) {
        expect(gate.satisfied).toBe(true);
      }
    }
  });

  it('Hash preimage circuit contains poseidon and bool gates', () => {
    const examples = buildExampleCircuits();
    const hashCircuit = examples.find((e) => e.name === 'Hash preimage')!;
    const types = hashCircuit.circuit.gates.map((g) => g.definition.type);
    expect(types).toContain('poseidon');
    expect(types).toContain('bool');
  });

  it('Range proof circuit contains range4 gates', () => {
    const examples = buildExampleCircuits();
    const rangeCircuit = examples.find((e) => e.name === 'Range proof')!;
    const types = rangeCircuit.circuit.gates.map((g) => g.definition.type);
    expect(types).toContain('range4');
  });

  it('EC operation circuit contains ec_add and mul gates', () => {
    const examples = buildExampleCircuits();
    const ecCircuit = examples.find((e) => e.name === 'EC operation')!;
    const types = ecCircuit.circuit.gates.map((g) => g.definition.type);
    expect(types).toContain('ec_add');
    expect(types).toContain('mul');
  });
});

// ---------------------------------------------------------------------------
// describeGate
// ---------------------------------------------------------------------------

describe('describeGate', () => {
  it('describes add gate', () => {
    const desc = describeGate(BUILTIN_GATES.add);
    expect(desc).toContain('Addition');
  });

  it('describes bool gate', () => {
    const desc = describeGate(BUILTIN_GATES.bool);
    expect(desc).toContain('{0,1}');
  });

  it('describes range4 gate', () => {
    const desc = describeGate(BUILTIN_GATES.range4);
    expect(desc).toContain('{0,1,2,3}');
  });

  it('describes poseidon gate', () => {
    const desc = describeGate(BUILTIN_GATES.poseidon);
    expect(desc).toContain('S-box');
  });

  it('describes custom gate with its label', () => {
    const gate = createCustomGate('custom', { label: 'My custom gate' });
    const desc = describeGate(gate);
    expect(desc).toContain('My custom gate');
  });
});

// ---------------------------------------------------------------------------
// degreeSummary
// ---------------------------------------------------------------------------

describe('degreeSummary', () => {
  it('counts gates by degree', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.add, BUILTIN_GATES.mul, BUILTIN_GATES.mul, BUILTIN_GATES.range4],
      [
        { a: 1, b: 2, c: 3 },
        { a: 2, b: 3, c: 6 },
        { a: 1, b: 1, c: 1 },
        { a: 0, b: 0, c: 0 },
      ],
    );
    const summary = degreeSummary(circuit);
    expect(summary[1]).toBe(1); // 1 add gate (degree 1)
    expect(summary[2]).toBe(2); // 2 mul gates (degree 2)
    expect(summary[4]).toBe(1); // 1 range4 gate (degree 4)
  });

  it('empty circuit yields empty summary', () => {
    const circuit = buildCustomCircuit([], []);
    const summary = degreeSummary(circuit);
    expect(Object.keys(summary)).toHaveLength(0);
  });

  it('poseidon contributes to degree 5', () => {
    const circuit = buildCustomCircuit(
      [BUILTIN_GATES.poseidon],
      [{ a: 2, b: 0, c: 32 }],
    );
    const summary = degreeSummary(circuit);
    expect(summary[5]).toBe(1);
  });
});
