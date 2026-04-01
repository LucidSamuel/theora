import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';
import { analyzeConstraints } from '../modes/debug/dsl/analyzer';
import type { CompilationResult, Wire } from '../modes/debug/dsl/types';

function analyze(source: string, fieldSize = 101n) {
  const parseResult = parse(source);
  expect(parseResult.success).toBe(true);
  const comp = compile(parseResult.ast, fieldSize);
  expect(comp.success).toBe(true);
  return { analysis: analyzeConstraints(comp), comp };
}

describe('Debug DSL Constraint Analyzer', () => {
  it('well-constrained circuit has no unconstrained wires', () => {
    const source = `input x\npublic out\nwire t = x * x\nassert t == out`;
    const { analysis } = analyze(source);
    expect(analysis.unconstrainedWires).toHaveLength(0);
  });

  it('does not treat assert-only usage as a defining constraint', () => {
    const one: Wire = { id: 0, name: 'one', type: 'one', sourceLine: 0 };
    const x: Wire = { id: 1, name: 'x', type: 'input', sourceLine: 1 };
    const out: Wire = { id: 2, name: 'out', type: 'public', sourceLine: 2 };
    const t: Wire = { id: 3, name: 't', type: 'intermediate', sourceLine: 3 };
    const comp: CompilationResult = {
      success: true,
      wires: [one, x, out, t],
      constraints: [{
        id: 0,
        a: new Map([[t.id, 1n], [out.id, 100n]]),
        b: new Map([[0, 1n]]),
        c: new Map(),
        sourceLine: 4,
        sourceExpr: 'assert t == out',
        constraintType: 'assertion',
        definesWireId: null,
      }],
      fieldSize: 101n,
      errors: [],
      wireByName: new Map([
        ['one', one],
        ['x', x],
        ['out', out],
        ['t', t],
      ]),
      inputWires: [x],
      publicWires: [out],
    };

    const analysis = analyzeConstraints(comp);
    const names = analysis.unconstrainedWires.map((wire) => wire.name);
    expect(names).toContain('t');
  });

  it('treats linear wire declarations as defining constraints', () => {
    const source = `input x\npublic out\nwire t = x + 0\nwire u = t + x + 5\nassert u == out`;
    const { analysis } = analyze(source);
    expect(analysis.unconstrainedWires).toHaveLength(0);
  });

  it('reports correct wire and constraint counts', () => {
    const source = `input a\ninput b\nwire t = a * b`;
    const { analysis } = analyze(source);
    expect(analysis.inputCount).toBe(2);
    expect(analysis.constraintCount).toBe(1);
  });

  it('reports public wire count', () => {
    const source = `input x\npublic out\nassert x == out`;
    const { analysis } = analyze(source);
    expect(analysis.publicCount).toBe(1);
  });

  it('degrees of freedom = wires - constraints - inputs - public', () => {
    const source = `input x\npublic out\nwire t = x * x\nassert t == out`;
    const { analysis } = analyze(source);
    // wires: x, out, t = 3; constraints: 2 (mul + assert); inputs: 1; public: 1
    // dof = 3 - 2 - 1 - 1 = -1
    expect(analysis.degreesOfFreedom).toBe(analysis.wireCount - analysis.constraintCount - analysis.inputCount - analysis.publicCount);
  });

  it('multiplication chain is fully constrained', () => {
    const source = `input a\ninput b\ninput c\npublic result\nwire ab = a * b\nwire abc = ab * c\nassert abc == result`;
    const { analysis } = analyze(source);
    expect(analysis.unconstrainedWires).toHaveLength(0);
  });
});
