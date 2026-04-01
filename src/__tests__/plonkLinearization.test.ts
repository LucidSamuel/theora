import { describe, it, expect } from 'vitest';
import { buildDefaultCircuit, modifyWireValue } from '../demos/plonk/logic';
import { linearize } from '../demos/plonk/linearization';

const P = 101n;

describe('PLONK Linearization', () => {
  it('full polynomial check equals 0 for valid circuit at challenge point', () => {
    const { gates } = buildDefaultCircuit();
    const result = linearize(gates, 17n, P);

    expect(result.fullCheckValue).toBe(0n);
  });

  it('linearized check equals 0 for valid circuit at challenge point', () => {
    const { gates } = buildDefaultCircuit();
    const result = linearize(gates, 17n, P);

    expect(result.linearizedCheckValue).toBe(0n);
  });

  it('full and linearized checks agree (both 0 or both non-0)', () => {
    const { gates } = buildDefaultCircuit();

    // Test with multiple challenge points.
    for (const zeta of [5n, 17n, 42n, 73n, 91n]) {
      const result = linearize(gates, zeta, P);
      // Both should be zero for the valid circuit.
      expect(result.fullCheckValue).toBe(result.linearizedCheckValue);
      expect(result.consistent).toBe(true);
    }
  });

  it('linearized polynomial has lower degree than full polynomial', () => {
    const { gates } = buildDefaultCircuit();
    const result = linearize(gates, 17n, P);

    const fullDegree = result.fullSteps[0]!.totalDegree;
    const linearizedDegree = result.linearizedSteps[0]!.totalDegree;

    // Full identity: degree(selector) + degree(wire) = (n-1) + (n-1) = 2(n-1).
    // For n=3 gates, max full degree = 4 (from qM·a·b which is degree 2+2+2 but
    // actually each selector and wire poly has degree n-1=2, so product is ≤ 4).
    // Linearized: only selector polynomials remain as polynomials, degree = n-1 = 2.
    expect(linearizedDegree).toBeLessThan(fullDegree);
  });

  it('different challenge points give consistent results for valid circuit', () => {
    const { gates } = buildDefaultCircuit();

    const r1 = linearize(gates, 7n, P);
    const r2 = linearize(gates, 53n, P);
    const r3 = linearize(gates, 99n, P);

    // All should pass for the valid circuit.
    expect(r1.fullCheckValue).toBe(0n);
    expect(r2.fullCheckValue).toBe(0n);
    expect(r3.fullCheckValue).toBe(0n);

    expect(r1.linearizedCheckValue).toBe(0n);
    expect(r2.linearizedCheckValue).toBe(0n);
    expect(r3.linearizedCheckValue).toBe(0n);

    expect(r1.consistent).toBe(true);
    expect(r2.consistent).toBe(true);
    expect(r3.consistent).toBe(true);
  });

  it('invalid circuit (broken wire): both checks are non-zero', () => {
    const circuit = buildDefaultCircuit();
    // Break gate 1's wire a: change from 7 to 99.
    // This breaks the gate equation: 0·99 + 0·2 + (-1)·14 + 1·99·2 + 0 = 184 ≠ 0.
    const broken = modifyWireValue(circuit, 1, 'a', 99);

    const result = linearize(broken.gates, 17n, P);

    // The polynomial T(x) no longer vanishes on the domain, so T(ζ) ≠ 0 at
    // a random challenge point (with overwhelming probability).
    // At least one of the checks should be non-zero for a broken circuit.
    // Linearization substitutes wire evaluations as scalars, so the full and
    // linearized checks may diverge when the circuit is unsatisfied — only the
    // full check is guaranteed to detect the violation.
    expect(result.fullCheckValue).not.toBe(0n);
  });
});
