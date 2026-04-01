import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';
import { evaluateWitnessFromAST } from '../modes/debug/dsl/witness';
import { checkConstraints } from '../modes/debug/dsl/checker';
import type { WitnessResult } from '../modes/debug/dsl/types';

function checkCircuit(source: string, inputs: Record<string, number>, fieldSize = 101n) {
  const parseResult = parse(source);
  expect(parseResult.success).toBe(true);
  const comp = compile(parseResult.ast, fieldSize);
  expect(comp.success).toBe(true);
  const inputMap = new Map<string, bigint>();
  for (const [k, v] of Object.entries(inputs)) inputMap.set(k, BigInt(v));
  const witness = evaluateWitnessFromAST(comp, parseResult.ast, inputMap);
  expect(witness.success).toBe(true);
  return checkConstraints(comp, witness);
}

describe('Debug DSL Constraint Checker', () => {
  it('all constraints satisfied for correct witness', () => {
    const source = `input x\npublic out\nwire t = x * x\nwire u = t + x + 5\nassert u == out`;
    const result = checkCircuit(source, { x: 7, out: 61 });
    expect(result.allSatisfied).toBe(true);
    expect(result.failedConstraints).toHaveLength(0);
  });

  it('detects constraint failure for wrong output', () => {
    const source = `input x\npublic out\nwire t = x * x\nwire u = t + x + 5\nassert u == out`;
    const result = checkCircuit(source, { x: 7, out: 99 }); // wrong: should be 61
    expect(result.allSatisfied).toBe(false);
    expect(result.failedConstraints.length).toBeGreaterThan(0);
  });

  it('mismatch values are correct', () => {
    const source = `input x\npublic out\nassert x == out`;
    const result = checkCircuit(source, { x: 5, out: 10 });
    expect(result.allSatisfied).toBe(false);
    const failed = result.failedConstraints[0]!;
    expect(failed.mismatch).toBeTruthy();
    // The assert encodes (x - out) * 1 = 0
    // So a_value = x - out = 5 - 10 = -5 mod 101 = 96
    // b_value = 1, ab_product = 96, c_value = 0
    expect(failed.mismatch!.actual).toBe(0n);
  });

  it('detects multiple failures simultaneously', () => {
    const source = `
input x
public out1
public out2
wire t = x * x
assert t == out1
assert x == out2
`;
    const result = checkCircuit(source, { x: 3, out1: 99, out2: 99 }); // both wrong
    expect(result.allSatisfied).toBe(false);
    expect(result.failedConstraints.length).toBe(2);
  });

  it('rejects a forged witness for a linear wire definition', () => {
    const source = `input x\npublic out\nwire t = x * x\nwire u = t + x + 5\nassert u == out`;
    const parseResult = parse(source);
    expect(parseResult.success).toBe(true);
    const comp = compile(parseResult.ast, 101n);
    expect(comp.success).toBe(true);

    const forged: WitnessResult = {
      success: true,
      values: new Map([
        [0, 1n],
        [comp.wireByName.get('x')!.id, 7n],
        [comp.wireByName.get('out')!.id, 88n],
        [comp.wireByName.get('t')!.id, 49n],
        [comp.wireByName.get('u')!.id, 88n],
      ]),
      steps: [],
      errors: [],
    };

    const result = checkConstraints(comp, forged);
    expect(result.allSatisfied).toBe(false);
    expect(result.failedConstraints.some((constraint) => constraint.sourceExpr === 'u = t + x + 5')).toBe(true);
  });

  it('multiplication constraint is satisfied when wire values match', () => {
    const source = `input a\ninput b\nwire t = a * b`;
    const result = checkCircuit(source, { a: 4, b: 7 });
    expect(result.allSatisfied).toBe(true);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]!.ab_product).toBe(28n);
  });
});
