import { describe, it, expect } from 'vitest';
import {
  buildLayeredCircuit,
  buildDefaultCircuit,
  multilinearExtension,
  computeAddMultilinear,
  computeMulMultilinear,
  gkrProve,
  gkrVerify,
  gkrStep,
} from '@/demos/gkr/logic';
import { evaluateAtPoint } from '@/demos/sumcheck/logic';

const F = 101n; // field size for all tests

/* ── buildLayeredCircuit ─────────────────────────────────── */

describe('buildLayeredCircuit', () => {
  it('evaluates a single add gate correctly', () => {
    const circuit = buildLayeredCircuit(
      [10n, 20n],
      [[{ type: 'add', leftInput: 0, rightInput: 1 }]],
      F,
    );
    expect(circuit.numLayers).toBe(2);
    expect(circuit.layers[0]!.values).toEqual([10n, 20n]);
    expect(circuit.layers[1]!.values).toEqual([30n]);
  });

  it('evaluates a single mul gate correctly', () => {
    const circuit = buildLayeredCircuit(
      [7n, 13n],
      [[{ type: 'mul', leftInput: 0, rightInput: 1 }]],
      F,
    );
    expect(circuit.layers[1]!.values).toEqual([91n]); // 7 * 13 = 91
  });

  it('reduces values mod fieldSize', () => {
    const circuit = buildLayeredCircuit(
      [50n, 60n],
      [[{ type: 'add', leftInput: 0, rightInput: 1 }]],
      F,
    );
    // 50 + 60 = 110 mod 101 = 9
    expect(circuit.layers[1]!.values).toEqual([9n]);
  });

  it('handles multiple layers', () => {
    const circuit = buildLayeredCircuit(
      [2n, 3n, 4n, 5n],
      [
        [
          { type: 'add', leftInput: 0, rightInput: 1 }, // 5
          { type: 'mul', leftInput: 2, rightInput: 3 }, // 20
        ],
        [{ type: 'add', leftInput: 0, rightInput: 1 }], // 25
      ],
      F,
    );
    expect(circuit.numLayers).toBe(3);
    expect(circuit.layers[1]!.values).toEqual([5n, 20n]);
    expect(circuit.layers[2]!.values).toEqual([25n]);
  });

  it('throws on empty inputs', () => {
    expect(() => buildLayeredCircuit([], [[]], F)).toThrow('non-empty');
  });

  it('throws on invalid gate input index', () => {
    expect(() =>
      buildLayeredCircuit(
        [1n, 2n],
        [[{ type: 'add', leftInput: 0, rightInput: 5 }]],
        F,
      ),
    ).toThrow('invalid');
  });

  it('stores gate definitions in each layer', () => {
    const gates = [
      { type: 'add' as const, leftInput: 0, rightInput: 1 },
      { type: 'mul' as const, leftInput: 0, rightInput: 1 },
    ];
    const circuit = buildLayeredCircuit([3n, 7n], [gates], F);
    expect(circuit.layers[0]!.gates).toEqual([]); // input layer has no gates
    expect(circuit.layers[1]!.gates).toEqual(gates);
  });

  it('handles mul overflow mod fieldSize', () => {
    // 50 * 50 = 2500, mod 101 = 2500 - 24*101 = 2500 - 2424 = 76
    const circuit = buildLayeredCircuit(
      [50n, 50n],
      [[{ type: 'mul', leftInput: 0, rightInput: 1 }]],
      F,
    );
    expect(circuit.layers[1]!.values).toEqual([76n]);
  });
});

/* ── buildDefaultCircuit ─────────────────────────────────── */

describe('buildDefaultCircuit', () => {
  it('produces the correct default circuit structure', () => {
    const circuit = buildDefaultCircuit(F);
    expect(circuit.numLayers).toBe(3);
    expect(circuit.layers[0]!.values).toEqual([3n, 5n, 7n, 11n]);
  });

  it('computes correct intermediate values', () => {
    const circuit = buildDefaultCircuit(F);
    // Layer 1: add(3,5)=8, mul(7,11)=77
    expect(circuit.layers[1]!.values).toEqual([8n, 77n]);
  });

  it('computes correct output: (3+5) + (7*11) = 85', () => {
    const circuit = buildDefaultCircuit(F);
    expect(circuit.layers[2]!.values).toEqual([85n]);
  });

  it('uses the provided field size', () => {
    const circuit = buildDefaultCircuit(F);
    expect(circuit.fieldSize).toBe(F);

    // With a smaller field: 7*11=77 mod 79 = 77, (8+77) mod 79 = 6
    const small = buildDefaultCircuit(79n);
    expect(small.layers[1]!.values).toEqual([8n, 77n]);
    expect(small.layers[2]!.values).toEqual([6n]); // 85 mod 79 = 6
  });
});

/* ── multilinearExtension ────────────────────────────────── */

describe('multilinearExtension', () => {
  it('MLE at boolean points equals original values (power of 2)', () => {
    const values = [3n, 7n, 11n, 13n];
    const mle = multilinearExtension(values, F);
    expect(mle.numVars).toBe(2);

    // Check that MLE(0,0)=3, MLE(0,1)=7, MLE(1,0)=11, MLE(1,1)=13
    expect(evaluateAtPoint(mle, [0n, 0n])).toBe(3n);
    expect(evaluateAtPoint(mle, [0n, 1n])).toBe(7n);
    expect(evaluateAtPoint(mle, [1n, 0n])).toBe(11n);
    expect(evaluateAtPoint(mle, [1n, 1n])).toBe(13n);
  });

  it('pads non-power-of-2 values with zeros', () => {
    const values = [5n, 10n, 15n]; // 3 values → padded to 4
    const mle = multilinearExtension(values, F);
    expect(mle.numVars).toBe(2);

    expect(evaluateAtPoint(mle, [0n, 0n])).toBe(5n);
    expect(evaluateAtPoint(mle, [0n, 1n])).toBe(10n);
    expect(evaluateAtPoint(mle, [1n, 0n])).toBe(15n);
    expect(evaluateAtPoint(mle, [1n, 1n])).toBe(0n); // padded
  });

  it('handles a single value', () => {
    const mle = multilinearExtension([42n], F);
    expect(mle.numVars).toBe(1);
    expect(evaluateAtPoint(mle, [0n])).toBe(42n);
    expect(evaluateAtPoint(mle, [1n])).toBe(0n); // padded
  });

  it('evaluates correctly at a non-boolean point', () => {
    // values [1, 2, 3, 4]
    // MLE: f(r1,r2) = 1*(1-r1)(1-r2) + 2*(1-r1)*r2 + 3*r1*(1-r2) + 4*r1*r2
    // At (2,3): = 1*(-1)(-2) + 2*(-1)*3 + 3*2*(-2) + 4*2*3
    //          = 2 - 6 - 12 + 24 = 8
    const mle = multilinearExtension([1n, 2n, 3n, 4n], F);
    expect(evaluateAtPoint(mle, [2n, 3n])).toBe(8n);
  });
});

/* ── computeAddMultilinear / computeMulMultilinear ───────── */

describe('wiring predicates', () => {
  it('add predicate is 1 only for add gates at correct positions', () => {
    const layer = {
      gates: [
        { type: 'add' as const, leftInput: 0, rightInput: 1 },
        { type: 'mul' as const, leftInput: 0, rightInput: 1 },
      ],
      values: [8n, 77n],
    };
    const addMLE = computeAddMultilinear(layer, 4, F);
    // Gate 0 is add, left=0, right=1 → add(0,0,1) = 1
    // g=0 → binary "0", x=0 → "00", y=1 → "01"
    expect(evaluateAtPoint(addMLE, [0n, 0n, 0n, 0n, 1n])).toBe(1n);
    // Gate 1 is mul, not add → add(1,0,1) = 0
    expect(evaluateAtPoint(addMLE, [1n, 0n, 0n, 0n, 1n])).toBe(0n);
  });

  it('mul predicate is 1 only for mul gates at correct positions', () => {
    const layer = {
      gates: [
        { type: 'add' as const, leftInput: 0, rightInput: 1 },
        { type: 'mul' as const, leftInput: 2, rightInput: 3 },
      ],
      values: [8n, 77n],
    };
    const mulMLE = computeMulMultilinear(layer, 4, F);
    // Gate 1 is mul, left=2, right=3 → mul(1,2,3) = 1
    // g=1 → "1", x=2 → "10", y=3 → "11"
    expect(evaluateAtPoint(mulMLE, [1n, 1n, 0n, 1n, 1n])).toBe(1n);
    // Gate 0 is add, not mul → mul(0,...) = 0
    expect(evaluateAtPoint(mulMLE, [0n, 0n, 0n, 0n, 1n])).toBe(0n);
  });

  it('all wiring predicate boolean-hypercube points are 0 or 1', () => {
    const layer = {
      gates: [
        { type: 'add' as const, leftInput: 0, rightInput: 1 },
        { type: 'mul' as const, leftInput: 0, rightInput: 1 },
      ],
      values: [5n, 10n],
    };
    const addMLE = computeAddMultilinear(layer, 2, F);
    for (const v of addMLE.evaluations.values()) {
      expect(v === 0n || v === 1n).toBe(true);
    }
    const mulMLE = computeMulMultilinear(layer, 2, F);
    for (const v of mulMLE.evaluations.values()) {
      expect(v === 0n || v === 1n).toBe(true);
    }
  });
});

/* ── gkrProve + gkrVerify ───────────────────────────────── */

describe('gkrProve', () => {
  it('produces a proof with the correct structure', () => {
    const circuit = buildDefaultCircuit(F);
    // Output layer has 1 value → 1 var MLE → point is 1 element
    const outputPoint = [2n];
    // 2 non-input layers → 2 sets of challenges
    const layerChallenges = [[3n, 5n], [7n, 11n]];
    const proof = gkrProve(circuit, outputPoint, layerChallenges);

    expect(proof.outputPoint).toEqual([2n]);
    expect(proof.layerProofs).toHaveLength(2);
    expect(typeof proof.outputClaim).toBe('bigint');
    expect(typeof proof.inputEval).toBe('bigint');
  });

  it('output claim matches MLE evaluation', () => {
    const circuit = buildDefaultCircuit(F);
    const outputPoint = [0n]; // At boolean point 0, MLE = circuit output value
    const layerChallenges = [[3n, 5n], [7n, 11n]];
    const proof = gkrProve(circuit, outputPoint, layerChallenges);

    // Output layer values = [85], MLE at [0] = 85 (first value), padded [85, 0]
    // Actually MLE([0]) = 85 since MLE of [85, 0] at x=0 is 85
    const mle = multilinearExtension(circuit.layers[2]!.values, F);
    const expected = evaluateAtPoint(mle, outputPoint);
    expect(proof.outputClaim).toBe(expected);
  });

  it('throws when wrong number of layer challenges provided', () => {
    const circuit = buildDefaultCircuit(F);
    expect(() => gkrProve(circuit, [2n], [[3n]])).toThrow();
  });

  it('layer proofs descend from output to input', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    // First layer proof is for the output layer (index 2)
    expect(proof.layerProofs[0]!.layerIndex).toBe(2);
    // Second layer proof is for layer 1
    expect(proof.layerProofs[1]!.layerIndex).toBe(1);
  });
});

describe('gkrVerify', () => {
  it('honest proof of default circuit verifies', () => {
    const circuit = buildDefaultCircuit(F);
    const outputPoint = [2n];
    const layerChallenges = [[3n, 5n], [7n, 11n]];
    const proof = gkrProve(circuit, outputPoint, layerChallenges);
    const result = gkrVerify(circuit, proof);

    expect(result.passed).toBe(true);
    expect(result.failedLayer).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('honest proof verifies at boolean output point', () => {
    const circuit = buildDefaultCircuit(F);
    const outputPoint = [0n];
    const layerChallenges = [[2n, 3n], [5n, 7n]];
    const proof = gkrProve(circuit, outputPoint, layerChallenges);
    const result = gkrVerify(circuit, proof);

    expect(result.passed).toBe(true);
  });

  it('honest proof verifies with different challenges', () => {
    const circuit = buildDefaultCircuit(F);
    const outputPoint = [50n];
    const layerChallenges = [[17n, 23n], [41n, 67n]];
    const proof = gkrProve(circuit, outputPoint, layerChallenges);
    const result = gkrVerify(circuit, proof);

    expect(result.passed).toBe(true);
  });

  it('detects corrupted output claim', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    const corruptedProof = {
      ...proof,
      outputClaim: proof.outputClaim + 1n,
    };
    const result = gkrVerify(circuit, corruptedProof);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Output claim mismatch');
  });

  it('detects corrupted input evaluation', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    const corruptedProof = {
      ...proof,
      inputEval: proof.inputEval + 1n,
    };
    const result = gkrVerify(circuit, corruptedProof);

    expect(result.passed).toBe(false);
    expect(result.failedLayer).toBe(0);
    expect(result.reason).toContain('Input evaluation mismatch');
  });

  it('detects corrupted layer reduced claim', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    const corruptedLayerProofs = proof.layerProofs.map((lp, i) => {
      if (i === 0) {
        return { ...lp, reducedClaim: lp.reducedClaim + 1n };
      }
      return lp;
    });
    const corruptedProof = { ...proof, layerProofs: corruptedLayerProofs };
    const result = gkrVerify(circuit, corruptedProof);

    expect(result.passed).toBe(false);
  });

  it('verifies a simple 2-layer circuit (inputs → single gate)', () => {
    const circuit = buildLayeredCircuit(
      [10n, 20n],
      [[{ type: 'add', leftInput: 0, rightInput: 1 }]],
      F,
    );
    const proof = gkrProve(circuit, [3n], [[5n]]);
    const result = gkrVerify(circuit, proof);

    expect(result.passed).toBe(true);
  });

  it('verifies a circuit with only mul gates', () => {
    const circuit = buildLayeredCircuit(
      [3n, 7n],
      [[{ type: 'mul', leftInput: 0, rightInput: 1 }]],
      F,
    );
    // 3 * 7 = 21
    expect(circuit.layers[1]!.values).toEqual([21n]);

    const proof = gkrProve(circuit, [4n], [[6n]]);
    const result = gkrVerify(circuit, proof);

    expect(result.passed).toBe(true);
  });
});

/* ── gkrStep ─────────────────────────────────────────────── */

describe('gkrStep', () => {
  it('returns correct layer proof for each step', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    const step0 = gkrStep(circuit, proof, 0);
    expect(step0).not.toBeNull();
    expect(step0!.layerIndex).toBe(2); // output layer
    expect(step0!.totalLayers).toBe(3);
    expect(step0!.layerProof).toBe(proof.layerProofs[0]);

    const step1 = gkrStep(circuit, proof, 1);
    expect(step1).not.toBeNull();
    expect(step1!.layerIndex).toBe(1);
    expect(step1!.layerProof).toBe(proof.layerProofs[1]);
  });

  it('returns null for out-of-range step index', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    expect(gkrStep(circuit, proof, -1)).toBeNull();
    expect(gkrStep(circuit, proof, 2)).toBeNull();
    expect(gkrStep(circuit, proof, 100)).toBeNull();
  });

  it('step descriptions mention the layer and gate types', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);

    const step0 = gkrStep(circuit, proof, 0)!;
    expect(step0.description).toContain('output');
    expect(step0.description).toContain('add');

    const step1 = gkrStep(circuit, proof, 1)!;
    expect(step1.description).toContain('layer 1');
    expect(step1.description).toContain('add');
    expect(step1.description).toContain('mul');
  });

  it('first step description includes claim value', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);
    const step0 = gkrStep(circuit, proof, 0)!;
    expect(step0.description).toContain(String(proof.layerProofs[0]!.claim));
  });

  it('last step description mentions input layer', () => {
    const circuit = buildDefaultCircuit(F);
    const proof = gkrProve(circuit, [2n], [[3n, 5n], [7n, 11n]]);
    const step1 = gkrStep(circuit, proof, 1)!;
    expect(step1.description).toContain('input');
  });
});

/* ── end-to-end / edge cases ─────────────────────────────── */

describe('end-to-end', () => {
  it('larger circuit: 8 inputs → 4 gates → 2 gates → 1 output', () => {
    const circuit = buildLayeredCircuit(
      [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n],
      [
        // Layer 1: 4 gates
        [
          { type: 'add', leftInput: 0, rightInput: 1 }, // 3
          { type: 'mul', leftInput: 2, rightInput: 3 }, // 12
          { type: 'add', leftInput: 4, rightInput: 5 }, // 11
          { type: 'mul', leftInput: 6, rightInput: 7 }, // 56
        ],
        // Layer 2: 2 gates
        [
          { type: 'add', leftInput: 0, rightInput: 1 }, // 15
          { type: 'mul', leftInput: 2, rightInput: 3 }, // 616 mod 101 = 11
        ],
        // Layer 3: 1 gate
        [{ type: 'add', leftInput: 0, rightInput: 1 }], // 15 + 11 = 26
      ],
      F,
    );

    expect(circuit.layers[1]!.values).toEqual([3n, 12n, 11n, 56n]);
    expect(circuit.layers[2]!.values).toEqual([15n, 10n]); // 11*56=616, 616 mod 101 = 10
    expect(circuit.layers[3]!.values).toEqual([25n]); // 15 + 10 = 25

    const proof = gkrProve(circuit, [5n], [[2n, 3n], [4n, 5n], [6n, 7n, 8n]]);
    const result = gkrVerify(circuit, proof);
    expect(result.passed).toBe(true);
  });

  it('circuit with same input to both sides of a gate', () => {
    // Squaring: x * x
    const circuit = buildLayeredCircuit(
      [7n],
      [[{ type: 'mul', leftInput: 0, rightInput: 0 }]],
      F,
    );
    expect(circuit.layers[1]!.values).toEqual([49n]); // 7^2

    const proof = gkrProve(circuit, [3n], [[5n]]);
    const result = gkrVerify(circuit, proof);
    expect(result.passed).toBe(true);
  });
});
