import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';
import { evaluateWitnessFromAST } from '../modes/debug/dsl/witness';
import { checkConstraints } from '../modes/debug/dsl/checker';
import { buildDependencyGraph, traceFailure } from '../modes/debug/dsl/tracer';

function fullPipeline(source: string, inputs: Record<string, number>, fieldSize = 101n) {
  const parseResult = parse(source);
  expect(parseResult.success).toBe(true);
  const comp = compile(parseResult.ast, fieldSize);
  expect(comp.success).toBe(true);
  const inputMap = new Map<string, bigint>();
  for (const [k, v] of Object.entries(inputs)) inputMap.set(k, BigInt(v));
  const witness = evaluateWitnessFromAST(comp, parseResult.ast, inputMap);
  expect(witness.success).toBe(true);
  const checks = checkConstraints(comp, witness);
  return { comp, witness, checks };
}

describe('Debug DSL Dependency Graph', () => {
  it('builds nodes for every wire', () => {
    const source = `input x\npublic out\nwire t = x * x\nassert t == out`;
    const { comp, witness, checks } = fullPipeline(source, { x: 3, out: 9 });
    const graph = buildDependencyGraph(comp, witness, checks);
    expect(graph.length).toBe(comp.wires.length);
  });

  it('input wires have status ok', () => {
    const source = `input x\nwire t = x * x`;
    const { comp, witness, checks } = fullPipeline(source, { x: 4 });
    const graph = buildDependencyGraph(comp, witness, checks);
    const xNode = graph.find((n) => n.wireName === 'x');
    expect(xNode?.constraintStatus).toBe('ok');
  });

  it('intermediate wire fed by multiplication has dependsOn populated', () => {
    const source = `input a\ninput b\nwire t = a * b`;
    const { comp, witness, checks } = fullPipeline(source, { a: 3, b: 5 });
    const graph = buildDependencyGraph(comp, witness, checks);
    const tNode = graph.find((n) => n.wireName === 't');
    expect(tNode!.dependsOn.length).toBeGreaterThan(0);
  });

  it('wire values match witness', () => {
    const source = `input x\nwire t = x * x`;
    const { comp, witness, checks } = fullPipeline(source, { x: 5 });
    const graph = buildDependencyGraph(comp, witness, checks);
    const tNode = graph.find((n) => n.wireName === 't');
    const tWire = comp.wireByName.get('t')!;
    expect(tNode!.value).toBe(witness.values.get(tWire.id));
  });
});

describe('Debug DSL Failure Tracing', () => {
  it('traces back from failed assertion to root cause', () => {
    const source = `input x\npublic out\nwire t = x * x\nassert t == out`;
    const { comp, witness, checks } = fullPipeline(source, { x: 3, out: 99 });
    expect(checks.allSatisfied).toBe(false);
    const failed = checks.failedConstraints[0]!;
    const trace = traceFailure(comp, witness, checks, failed);
    expect(trace.rootCause).toBeTruthy();
    expect(trace.rootCause.wireName).toBeTruthy();
    expect(trace.rootCause.explanation).toContain('failed');
  });

  it('trace includes involved wires', () => {
    const source = `input x\npublic out\nassert x == out`;
    const { comp, witness, checks } = fullPipeline(source, { x: 5, out: 10 });
    const failed = checks.failedConstraints[0]!;
    const trace = traceFailure(comp, witness, checks, failed);
    expect(trace.traceBack.length).toBeGreaterThan(0);
    const wireNames = trace.traceBack.map((n) => n.wireName);
    expect(wireNames).toContain('x');
    expect(wireNames).toContain('out');
  });

  it('explanation includes mismatch info', () => {
    const source = `input x\npublic out\nassert x == out`;
    const { comp, witness, checks } = fullPipeline(source, { x: 5, out: 10 });
    const failed = checks.failedConstraints[0]!;
    const trace = traceFailure(comp, witness, checks, failed);
    expect(trace.rootCause.explanation).toContain('difference');
  });
});
