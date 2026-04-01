import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';
import { evaluateWitnessFromAST } from '../modes/debug/dsl/witness';
import { checkConstraints } from '../modes/debug/dsl/checker';
import { buildDependencyGraph, traceFailure } from '../modes/debug/dsl/tracer';
import { analyzeConstraints } from '../modes/debug/dsl/analyzer';
import { DEFAULT_CIRCUITS } from '../modes/debug/dsl/defaults';

function runFullPipeline(source: string, inputs: Record<string, number>, fieldSize = 101n) {
  const parseResult = parse(source);
  if (!parseResult.success) return { parseResult, success: false as const };
  const comp = compile(parseResult.ast, fieldSize);
  if (!comp.success) return { parseResult, comp, success: false as const };
  const inputMap = new Map<string, bigint>();
  for (const [k, v] of Object.entries(inputs)) inputMap.set(k, BigInt(v));
  const witness = evaluateWitnessFromAST(comp, parseResult.ast, inputMap);
  const checks = witness.success ? checkConstraints(comp, witness) : null;
  const analysis = analyzeConstraints(comp);
  const graph = witness.success && checks ? buildDependencyGraph(comp, witness, checks) : null;
  return { parseResult, comp, witness, checks, analysis, graph, success: true as const };
}

describe('Debug DSL Integration — Default Circuits', () => {
  it('basic (x² + x + 5) passes with correct inputs', () => {
    const circuit = DEFAULT_CIRCUITS.find((c) => c.id === 'basic')!;
    const result = runFullPipeline(circuit.source, circuit.defaultInputs);
    expect(result.success).toBe(true);
    expect(result.checks!.allSatisfied).toBe(true);
    expect(result.analysis!.unconstrainedWires).toHaveLength(0);
  });

  it('basic circuit fails with wrong output', () => {
    const circuit = DEFAULT_CIRCUITS.find((c) => c.id === 'basic')!;
    const result = runFullPipeline(circuit.source, { x: 7, out: 99 });
    expect(result.success).toBe(true);
    expect(result.checks!.allSatisfied).toBe(false);
    expect(result.checks!.failedConstraints.length).toBeGreaterThan(0);
  });

  it('multiplication chain passes with correct inputs', () => {
    const circuit = DEFAULT_CIRCUITS.find((c) => c.id === 'mul-chain')!;
    const result = runFullPipeline(circuit.source, circuit.defaultInputs);
    expect(result.success).toBe(true);
    expect(result.checks!.allSatisfied).toBe(true);
  });

  it('free-input buggy circuit passes its own declared constraints', () => {
    const circuit = DEFAULT_CIRCUITS.find((c) => c.id === 'underconstrained')!;
    const result = runFullPipeline(circuit.source, circuit.defaultInputs);
    expect(result.success).toBe(true);
    // This example is intentionally buggy at the spec level: `t` is a free input, so
    // the prover can choose t=0 and make the circuit accept out=12 for x=7.
    expect(result.checks!.allSatisfied).toBe(true);
    expect(result.analysis!.unconstrainedWires).toHaveLength(0);
  });

  it('poseidon-like circuit passes with correct inputs', () => {
    const circuit = DEFAULT_CIRCUITS.find((c) => c.id === 'poseidon-like')!;
    const result = runFullPipeline(circuit.source, circuit.defaultInputs);
    expect(result.success).toBe(true);
    expect(result.checks!.allSatisfied).toBe(true);
  });
});

describe('Debug DSL Integration — Full Trace on Failure', () => {
  it('failure trace produces root cause and explanation', () => {
    const source = `input x\npublic out\nwire t = x * x\nassert t == out`;
    const result = runFullPipeline(source, { x: 5, out: 99 });
    expect(result.checks!.allSatisfied).toBe(false);

    const failed = result.checks!.failedConstraints[0]!;
    const trace = traceFailure(result.comp!, result.witness!, result.checks!, failed);
    expect(trace.rootCause.wireName).toBeTruthy();
    expect(trace.traceBack.length).toBeGreaterThan(0);
  });

  it('dependency graph has correct node count', () => {
    const source = `input a\ninput b\nwire t = a * b`;
    const result = runFullPipeline(source, { a: 3, b: 5 });
    expect(result.graph!.length).toBe(result.comp!.wires.length);
  });
});

describe('Debug DSL Integration — Field Arithmetic', () => {
  it('overflow wraps correctly in GF(7)', () => {
    const source = `input x\nwire t = x * x`;
    const parseResult = parse(source);
    const comp = compile(parseResult.ast, 7n);
    const inputs = new Map<string, bigint>([['x', 5n]]);
    const witness = evaluateWitnessFromAST(comp, parseResult.ast, inputs);
    expect(witness.success).toBe(true);
    // 5² = 25, 25 mod 7 = 4
    const tWire = comp.wireByName.get('t')!;
    expect(witness.values.get(tWire.id)).toBe(4n);
    const checks = checkConstraints(comp, witness);
    expect(checks.allSatisfied).toBe(true);
  });

  it('subtraction wraps correctly in GF(13)', () => {
    const source = `input x\ninput y\nwire t = x - y`;
    const parseResult = parse(source);
    const comp = compile(parseResult.ast, 13n);
    const inputs = new Map<string, bigint>([['x', 2n], ['y', 10n]]);
    const witness = evaluateWitnessFromAST(comp, parseResult.ast, inputs);
    expect(witness.success).toBe(true);
    // 2 - 10 = -8 mod 13 = 5
    const tWire = comp.wireByName.get('t')!;
    expect(witness.values.get(tWire.id)).toBe(5n);
  });
});
