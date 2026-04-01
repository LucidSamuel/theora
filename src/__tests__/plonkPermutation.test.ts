import { describe, it, expect } from 'vitest';
import { buildDefaultCircuit } from '../demos/plonk/logic';
import {
  buildPermutation,
  computeGrandProduct,
  encodeWirePosition,
} from '../demos/plonk/permutation';

const P = 101n;

describe('PLONK Permutation Argument', () => {
  // ── buildPermutation ─────────────────────────────────────────────

  it('identity permutation when no copy constraints', () => {
    const { gates } = buildDefaultCircuit();
    const mapping = buildPermutation(gates, []);

    // Every position maps to itself.
    for (let i = 0; i < gates.length; i++) {
      for (const w of ['a', 'b', 'c'] as const) {
        const key = `${i}:${w}`;
        expect(mapping.sigma.get(key)).toBe(key);
      }
    }

    // No non-trivial cycles.
    expect(mapping.cycles.length).toBe(0);
  });

  it('correct cycles for default circuit (2 copy constraints)', () => {
    const { gates, copyConstraints } = buildDefaultCircuit();
    const mapping = buildPermutation(gates, copyConstraints);

    // Copy: gate0.c → gate1.a (both = 7)
    // Copy: gate1.c → gate2.a (both = 14)
    // Each constraint creates a 2-cycle.
    // σ(0:c) = 1:a, σ(1:a) = 0:c
    expect(mapping.sigma.get('0:c')).toBe('1:a');
    expect(mapping.sigma.get('1:a')).toBe('0:c');

    // σ(1:c) = 2:a, σ(2:a) = 1:c
    expect(mapping.sigma.get('1:c')).toBe('2:a');
    expect(mapping.sigma.get('2:a')).toBe('1:c');

    // Non-constrained positions are identity.
    expect(mapping.sigma.get('0:a')).toBe('0:a');
    expect(mapping.sigma.get('0:b')).toBe('0:b');
    expect(mapping.sigma.get('1:b')).toBe('1:b');
    expect(mapping.sigma.get('2:b')).toBe('2:b');
    expect(mapping.sigma.get('2:c')).toBe('2:c');

    // Two non-trivial cycles, each of length 2.
    expect(mapping.cycles.length).toBe(2);
    const cycleLengths = mapping.cycles.map((c) => c.length).sort();
    expect(cycleLengths).toEqual([2, 2]);
  });

  // ── Grand product ────────────────────────────────────────────────

  it('grand product returns 1 when all copy constraints satisfied', () => {
    const { gates, copyConstraints } = buildDefaultCircuit();
    const mapping = buildPermutation(gates, copyConstraints);

    const result = computeGrandProduct(gates, mapping, 7n, 13n, P);

    expect(result.finalProduct).toBe(1n);
    expect(result.satisfied).toBe(true);
    expect(result.steps.length).toBe(gates.length);
  });

  it('grand product ≠ 1 when a copy constraint is broken', () => {
    const circuit = buildDefaultCircuit();
    // Break gate0.c: change from 7 to 99 (but leave gate1.a = 7).
    const brokenGates = circuit.gates.map((g, i) =>
      i === 0 ? { ...g, c: 99 } : g,
    );
    const mapping = buildPermutation(brokenGates, circuit.copyConstraints);

    const result = computeGrandProduct(brokenGates, mapping, 7n, 13n, P);

    expect(result.finalProduct).not.toBe(1n);
    expect(result.satisfied).toBe(false);
  });

  it('different beta/gamma produce different intermediate products but same verdict', () => {
    const { gates, copyConstraints } = buildDefaultCircuit();
    const mapping = buildPermutation(gates, copyConstraints);

    const r1 = computeGrandProduct(gates, mapping, 7n, 13n, P);
    const r2 = computeGrandProduct(gates, mapping, 23n, 41n, P);

    // Same final verdict (both satisfied).
    expect(r1.satisfied).toBe(true);
    expect(r2.satisfied).toBe(true);

    // But intermediate products differ (with overwhelming probability).
    // Check that at least one intermediate step differs.
    const differ = r1.steps.some(
      (s, i) => s.productAfter !== r2.steps[i]!.productAfter,
    );
    expect(differ).toBe(true);
  });

  // ── encodeWirePosition ───────────────────────────────────────────

  it('encodeWirePosition: distinct values for different positions', () => {
    const seen = new Set<bigint>();
    for (let gate = 0; gate < 5; gate++) {
      for (const w of ['a', 'b', 'c'] as const) {
        const id = encodeWirePosition(gate, w);
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    // 5 gates × 3 wires = 15 distinct values.
    expect(seen.size).toBe(15);
  });
});
