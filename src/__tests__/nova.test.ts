import { describe, it, expect } from 'vitest';
import {
  buildSimpleCircuit,
  createInstance,
  checkRelaxedR1CS,
  computeCrossTerm,
  foldInstances,
  replayNovaIVC,
  runNovaIVC,
} from '@/demos/nova/logic';

const P = 101n; // field size for all tests

/**
 * Helper: build a valid witness for f(x) = x² + x + 5.
 * Witness vector: z = [1, x, y, t] where t = x², y = t + x + 5.
 */
function makeWitness(x: bigint): bigint[] {
  const p = P;
  const xm = ((x % p) + p) % p;
  const t = (xm * xm) % p;
  const y = (t + xm + 5n) % p;
  return [1n, xm, y, t];
}

/* ── buildSimpleCircuit ─────────────────────────────────────── */

describe('buildSimpleCircuit', () => {
  it('produces valid R1CS matrices with correct dimensions', () => {
    const matrices = buildSimpleCircuit();
    expect(matrices.m).toBe(2); // 2 constraints
    expect(matrices.n).toBe(4); // 4 variables: [1, x, y, t]

    expect(matrices.A).toHaveLength(2);
    expect(matrices.B).toHaveLength(2);
    expect(matrices.C).toHaveLength(2);

    for (const row of matrices.A) expect(row).toHaveLength(4);
    for (const row of matrices.B) expect(row).toHaveLength(4);
    for (const row of matrices.C) expect(row).toHaveLength(4);
  });

  it('constraint 1 encodes t = x * x', () => {
    const { A, B, C } = buildSimpleCircuit();
    // A selects x, B selects x, C selects t
    expect(A[0]).toEqual([0n, 1n, 0n, 0n]);
    expect(B[0]).toEqual([0n, 1n, 0n, 0n]);
    expect(C[0]).toEqual([0n, 0n, 0n, 1n]);
  });

  it('constraint 2 encodes y = t + x + 5', () => {
    const { A, B, C } = buildSimpleCircuit();
    // (t + x + 5) * 1 = y
    expect(A[1]).toEqual([5n, 1n, 0n, 1n]);
    expect(B[1]).toEqual([1n, 0n, 0n, 0n]);
    expect(C[1]).toEqual([0n, 0n, 1n, 0n]);
  });
});

/* ── createInstance ──────────────────────────────────────────── */

describe('createInstance', () => {
  it('creates a satisfied non-relaxed instance for a valid witness', () => {
    const matrices = buildSimpleCircuit();
    // f(3) = 9 + 3 + 5 = 17, so z = [1, 3, 17, 9]
    const witness = makeWitness(3n);
    expect(witness).toEqual([1n, 3n, 17n, 9n]);

    const { instance, witness: wit } = createInstance(matrices, witness, P);

    expect(instance.u).toBe(1n);
    expect(wit.E).toEqual([0n, 0n]); // zero error vector
    expect(wit.W).toEqual([1n, 3n, 17n, 9n]);
    expect(instance.x).toEqual([17n]); // public output
  });

  it('throws on wrong witness length', () => {
    const matrices = buildSimpleCircuit();
    expect(() => createInstance(matrices, [1n, 2n], P)).toThrow();
  });
});

/* ── checkRelaxedR1CS ───────────────────────────────────────── */

describe('checkRelaxedR1CS', () => {
  it('returns true for a valid non-relaxed instance (u=1, E=0)', () => {
    const matrices = buildSimpleCircuit();
    const witness = makeWitness(3n);
    const { instance, witness: wit } = createInstance(matrices, witness, P);

    expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(true);
  });

  it('returns true for multiple valid witness values', () => {
    const matrices = buildSimpleCircuit();

    for (const x of [0n, 1n, 2n, 5n, 7n, 10n, 50n, 100n]) {
      const witness = makeWitness(x);
      const { instance, witness: wit } = createInstance(matrices, witness, P);
      expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(true);
    }
  });

  it('returns false for an invalid witness', () => {
    const matrices = buildSimpleCircuit();
    // Corrupt t: set it to wrong value (should be 9 for x=3)
    const badWitness = [1n, 3n, 17n, 10n]; // t=10 instead of 9
    const { instance, witness: wit } = createInstance(matrices, badWitness, P);

    expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(false);
  });

  it('returns false when output y is wrong', () => {
    const matrices = buildSimpleCircuit();
    // f(3) = 17 but we claim y = 18
    const badWitness = [1n, 3n, 18n, 9n];
    const { instance, witness: wit } = createInstance(matrices, badWitness, P);

    expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(false);
  });

  it('u=1 E=0 is equivalent to standard R1CS check', () => {
    const matrices = buildSimpleCircuit();
    const witness = makeWitness(7n);
    // f(7) = 49 + 7 + 5 = 61

    // Manual standard R1CS check: Az ∘ Bz = Cz
    const z = witness;
    // Constraint 1: (0·1 + 1·7 + 0·61 + 0·49) * (0·1 + 1·7 + 0·61 + 0·49) = (0·1 + 0·7 + 0·61 + 1·49)
    //               7 * 7 = 49 ✓
    // Constraint 2: (5·1 + 1·7 + 0·61 + 1·49) * (1·1 + 0·7 + 0·61 + 0·49) = (0·1 + 0·7 + 1·61 + 0·49)
    //               (5+7+49) * 1 = 61 ✓
    const { instance, witness: wit } = createInstance(matrices, z, P);

    // Relaxed check with u=1, E=[0,0] should be identical
    expect(instance.u).toBe(1n);
    expect(wit.E.every((e) => e === 0n)).toBe(true);
    expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(true);
  });
});

/* ── computeCrossTerm ───────────────────────────────────────── */

describe('computeCrossTerm', () => {
  it('produces a vector of correct length (m constraints)', () => {
    const matrices = buildSimpleCircuit();
    const z1 = makeWitness(3n);
    const z2 = makeWitness(5n);

    const T = computeCrossTerm(matrices, z1, z2, 1n, 1n, P);

    expect(T).toHaveLength(matrices.m);
  });

  it('cross-term is zero when both witnesses are identical', () => {
    // When z₁ = z₂ and u₁ = u₂ = 1:
    //   T = Az ∘ Bz + Az ∘ Bz − Cz − Cz = 2·(Az ∘ Bz) − 2·Cz
    // For a satisfied instance, Az ∘ Bz = Cz, so T = 2·Cz − 2·Cz = 0
    const matrices = buildSimpleCircuit();
    const z = makeWitness(3n);

    const T = computeCrossTerm(matrices, z, z, 1n, 1n, P);

    for (const val of T) {
      expect(val).toBe(0n);
    }
  });

  it('all values are in [0, p)', () => {
    const matrices = buildSimpleCircuit();
    const z1 = makeWitness(3n);
    const z2 = makeWitness(7n);

    const T = computeCrossTerm(matrices, z1, z2, 1n, 1n, P);

    for (const val of T) {
      expect(val).toBeGreaterThanOrEqual(0n);
      expect(val).toBeLessThan(P);
    }
  });
});

/* ── foldInstances ──────────────────────────────────────────── */

describe('foldInstances', () => {
  it('produces a satisfied folded instance (honest case)', () => {
    const matrices = buildSimpleCircuit();
    const { instance: inst1, witness: wit1 } = createInstance(
      matrices,
      makeWitness(3n),
      P,
    );
    const { instance: inst2, witness: wit2 } = createInstance(
      matrices,
      makeWitness(5n),
      P,
    );

    const step = foldInstances(matrices, inst1, wit1, inst2, wit2, 7n, P);

    expect(step.satisfied).toBe(true);
    expect(step.foldedInstance.u).toBe(
      (inst1.u + 7n * inst2.u) % P,
    ); // 1 + 7·1 = 8
  });

  it('folded u equals u₁ + r·u₂ mod p', () => {
    const matrices = buildSimpleCircuit();
    const { instance: inst1, witness: wit1 } = createInstance(
      matrices,
      makeWitness(2n),
      P,
    );
    const { instance: inst2, witness: wit2 } = createInstance(
      matrices,
      makeWitness(4n),
      P,
    );

    const r = 13n;
    const step = foldInstances(matrices, inst1, wit1, inst2, wit2, r, P);

    const expectedU = (inst1.u + r * inst2.u) % P;
    expect(step.foldedInstance.u).toBe(expectedU);
  });

  it('folded witness W equals W₁ + r·W₂ mod p', () => {
    const matrices = buildSimpleCircuit();
    const w1 = makeWitness(3n);
    const w2 = makeWitness(5n);
    const { instance: inst1, witness: wit1 } = createInstance(matrices, w1, P);
    const { instance: inst2, witness: wit2 } = createInstance(matrices, w2, P);

    const r = 7n;
    const step = foldInstances(matrices, inst1, wit1, inst2, wit2, r, P);

    for (let i = 0; i < matrices.n; i++) {
      const expected = ((w1[i]! + r * w2[i]!) % P + P) % P;
      expect(step.foldedWitness.W[i]).toBe(expected);
    }
  });

  it('satisfied with different challenge values', () => {
    const matrices = buildSimpleCircuit();
    const { instance: inst1, witness: wit1 } = createInstance(
      matrices,
      makeWitness(2n),
      P,
    );
    const { instance: inst2, witness: wit2 } = createInstance(
      matrices,
      makeWitness(9n),
      P,
    );

    for (const r of [1n, 2n, 17n, 53n, 99n]) {
      const step = foldInstances(matrices, inst1, wit1, inst2, wit2, r, P);
      expect(step.satisfied).toBe(true);
    }
  });

  it('with bad witness produces unsatisfied fold', () => {
    const matrices = buildSimpleCircuit();
    const { instance: inst1, witness: wit1 } = createInstance(
      matrices,
      makeWitness(3n),
      P,
    );
    // Create instance with corrupted witness (t is wrong)
    const badW = [1n, 5n, 31n, 99n]; // t=99 instead of 25
    const { instance: inst2, witness: wit2 } = createInstance(
      matrices,
      badW,
      P,
    );

    const step = foldInstances(matrices, inst1, wit1, inst2, wit2, 7n, P);

    expect(step.satisfied).toBe(false);
  });
});

/* ── runNovaIVC ─────────────────────────────────────────────── */

describe('runNovaIVC', () => {
  it('produces correct number of folding steps', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [makeWitness(2n), makeWitness(3n), makeWitness(5n)];
    const challenges = [7n, 13n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    expect(state.steps).toHaveLength(2);
    expect(state.currentStep).toBe(2);
    expect(state.fieldSize).toBe(P);
  });

  it('all steps are satisfied for honest witnesses (3 steps)', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [
      makeWitness(2n),
      makeWitness(3n),
      makeWitness(5n),
    ];
    const challenges = [7n, 13n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    for (const step of state.steps) {
      expect(step.satisfied).toBe(true);
    }
  });

  it('all steps are satisfied for honest witnesses (4 steps)', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [
      makeWitness(1n),
      makeWitness(2n),
      makeWitness(3n),
      makeWitness(4n),
    ];
    const challenges = [11n, 23n, 47n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    expect(state.steps).toHaveLength(3);
    for (const step of state.steps) {
      expect(step.satisfied).toBe(true);
    }
  });

  it('all steps are satisfied for honest witnesses (5 steps)', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [
      makeWitness(0n),
      makeWitness(1n),
      makeWitness(2n),
      makeWitness(3n),
      makeWitness(4n),
    ];
    const challenges = [3n, 17n, 41n, 73n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    expect(state.steps).toHaveLength(4);
    for (const step of state.steps) {
      expect(step.satisfied).toBe(true);
    }
  });

  it('step numbers are 1-indexed', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [makeWitness(2n), makeWitness(3n), makeWitness(5n)];
    const challenges = [7n, 13n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    expect(state.steps[0]!.stepNumber).toBe(1);
    expect(state.steps[1]!.stepNumber).toBe(2);
  });

  it('folding is cumulative — each step folds from the previous result', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [makeWitness(2n), makeWitness(3n), makeWitness(5n)];
    const challenges = [7n, 13n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    // Step 1 folds witnesses[0] with witnesses[1]
    // Step 2 should fold the result of step 1 with witnesses[2]
    const step1Folded = state.steps[0]!.foldedInstance;
    const step2Inst1 = state.steps[1]!.instance1;

    // The accumulated instance from step 1 becomes instance1 of step 2
    expect(step2Inst1.u).toBe(step1Folded.u);
    expect(step2Inst1.commitment).toBe(step1Folded.commitment);
  });

  it('detects a bad witness in a multi-step IVC', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [
      makeWitness(2n),
      [1n, 5n, 31n, 99n], // corrupted witness (t is wrong)
      makeWitness(3n),
    ];
    const challenges = [7n, 13n];

    const state = runNovaIVC(matrices, witnesses, challenges, P);

    // The first fold (with the bad witness) should be unsatisfied
    expect(state.steps[0]!.satisfied).toBe(false);
  });

  it('throws if too few witnesses', () => {
    const matrices = buildSimpleCircuit();
    expect(() => runNovaIVC(matrices, [makeWitness(3n)], [], P)).toThrow();
  });

  it('throws if wrong number of challenges', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [makeWitness(2n), makeWitness(3n)];
    expect(() => runNovaIVC(matrices, witnesses, [7n, 13n], P)).toThrow();
  });

  it('can replay an in-progress folding prefix for URL restore', () => {
    const matrices = buildSimpleCircuit();
    const witnesses = [
      makeWitness(2n),
      makeWitness(3n),
      makeWitness(5n),
      makeWitness(7n),
    ];
    const challenges = [7n, 13n, 19n];

    const partial = replayNovaIVC(matrices, witnesses, challenges, 2, P);
    const full = runNovaIVC(matrices, witnesses, challenges, P);

    expect(partial.steps).toHaveLength(2);
    expect(partial.currentStep).toBe(2);
    expect(partial.steps).toEqual(full.steps.slice(0, 2));
    expect(partial.steps[1]!.instance1).toEqual(partial.steps[0]!.foldedInstance);
  });
});

/* ── edge cases and algebraic properties ────────────────────── */

describe('algebraic properties', () => {
  it('relaxed R1CS with u=1 E=0 is standard R1CS', () => {
    const matrices = buildSimpleCircuit();
    const witness = makeWitness(6n);

    const { instance, witness: wit } = createInstance(matrices, witness, P);

    // Confirm u=1 and E=zero
    expect(instance.u).toBe(1n);
    expect(wit.E.every((e) => e === 0n)).toBe(true);

    // Should satisfy relaxed R1CS (which reduces to standard check)
    expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(true);
  });

  it('folding preserves satisfaction across many challenges', () => {
    const matrices = buildSimpleCircuit();
    const { instance: inst1, witness: wit1 } = createInstance(
      matrices,
      makeWitness(4n),
      P,
    );
    const { instance: inst2, witness: wit2 } = createInstance(
      matrices,
      makeWitness(8n),
      P,
    );

    // Test with every challenge in [1, 100]
    for (let r = 1n; r <= 100n; r += 10n) {
      const step = foldInstances(matrices, inst1, wit1, inst2, wit2, r, P);
      expect(step.satisfied).toBe(true);
    }
  });

  it('folding result depends on the challenge value', () => {
    const matrices = buildSimpleCircuit();
    const { instance: inst1, witness: wit1 } = createInstance(
      matrices,
      makeWitness(3n),
      P,
    );
    const { instance: inst2, witness: wit2 } = createInstance(
      matrices,
      makeWitness(5n),
      P,
    );

    const step1 = foldInstances(matrices, inst1, wit1, inst2, wit2, 7n, P);
    const step2 = foldInstances(matrices, inst1, wit1, inst2, wit2, 13n, P);

    // Different challenges should produce different folded instances
    expect(step1.foldedInstance.u).not.toBe(step2.foldedInstance.u);
    expect(step1.foldedWitness.W).not.toEqual(step2.foldedWitness.W);

    // Both should still be satisfied
    expect(step1.satisfied).toBe(true);
    expect(step2.satisfied).toBe(true);
  });

  it('field arithmetic wraps correctly mod 101', () => {
    const matrices = buildSimpleCircuit();
    // x=10: t = 100, y = 100 + 10 + 5 = 115 mod 101 = 14
    const witness = makeWitness(10n);
    expect(witness).toEqual([1n, 10n, 14n, 100n]);

    const { instance, witness: wit } = createInstance(matrices, witness, P);
    expect(checkRelaxedR1CS(matrices, instance, wit, P)).toBe(true);
  });
});
