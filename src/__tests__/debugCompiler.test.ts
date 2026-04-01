import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';

function compileSource(source: string, fieldSize = 101n) {
  const parseResult = parse(source);
  expect(parseResult.success).toBe(true);
  return compile(parseResult.ast, fieldSize);
}

describe('Debug DSL Compiler', () => {
  it('compiles x² + x + 5 with correct wire and constraint counts', () => {
    const source = `input x\npublic out\nwire t = x * x\nwire u = t + x + 5\nassert u == out`;
    const result = compileSource(source);
    expect(result.success).toBe(true);

    // Wires: one, x, out, t, u
    expect(result.wires.length).toBe(5);
    expect(result.inputWires).toHaveLength(1);
    expect(result.publicWires).toHaveLength(1);

    // Constraints: 1 multiplication, 1 linear wire binding, 1 assert
    expect(result.constraints).toHaveLength(3);
  });

  it('multiplication generates exactly one constraint', () => {
    const source = `input a\ninput b\nwire t = a * b`;
    const result = compileSource(source);
    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0]!.constraintType).toBe('multiplication');
  });

  it('addition generates a linear definition constraint', () => {
    const source = `input a\ninput b\nwire t = a + b`;
    const result = compileSource(source);
    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0]!.constraintType).toBe('definition');
    expect(result.constraints[0]!.definesWireId).toBe(result.wireByName.get('t')!.id);
  });

  it('assert generates an equality constraint', () => {
    const source = `input x\npublic out\nassert x == out`;
    const result = compileSource(source);
    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0]!.constraintType).toBe('assertion');
  });

  it('constant wire (wire 0) exists', () => {
    const source = `input x`;
    const result = compileSource(source);
    const oneWire = result.wires.find((w) => w.name === 'one');
    expect(oneWire).toBeTruthy();
    expect(oneWire!.id).toBe(0);
    expect(oneWire!.type).toBe('one');
  });

  it('wire ordering: one first, then inputs, then public, then intermediates', () => {
    const source = `input x\npublic out\nwire t = x * x`;
    const result = compileSource(source);
    expect(result.wires[0]!.name).toBe('one');
    expect(result.wires[1]!.type).toBe('input');
    expect(result.wires[2]!.type).toBe('public');
  });

  it('scalar multiplication stays linear and binds the declared wire', () => {
    const source = `input x\nwire t = 2 * x`;
    const result = compileSource(source);
    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0]!.constraintType).toBe('definition');
  });

  it('uses specified field size', () => {
    const source = `input x`;
    const result = compileSource(source, 7n);
    expect(result.fieldSize).toBe(7n);
  });
});
