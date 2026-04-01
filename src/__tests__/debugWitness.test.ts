import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';
import { evaluateWitnessFromAST } from '../modes/debug/dsl/witness';

function evalCircuit(source: string, inputs: Record<string, number>, fieldSize = 101n) {
  const parseResult = parse(source);
  expect(parseResult.success).toBe(true);
  const comp = compile(parseResult.ast, fieldSize);
  expect(comp.success).toBe(true);
  const inputMap = new Map<string, bigint>();
  for (const [k, v] of Object.entries(inputs)) inputMap.set(k, BigInt(v));
  return { witness: evaluateWitnessFromAST(comp, parseResult.ast, inputMap), comp };
}

describe('Debug DSL Witness Evaluation', () => {
  it('evaluates x² + x + 5 with x=7 correctly', () => {
    const source = `input x\npublic out\nwire t = x * x\nwire u = t + x + 5\nassert u == out`;
    const { witness, comp } = evalCircuit(source, { x: 7, out: 61 });
    expect(witness.success).toBe(true);

    // x = 7
    const xWire = comp.wireByName.get('x')!;
    expect(witness.values.get(xWire.id)).toBe(7n);

    // t = x² = 49
    const tWire = comp.wireByName.get('t')!;
    expect(witness.values.get(tWire.id)).toBe(49n);

    // u = t + x + 5 = 49 + 7 + 5 = 61
    const uWire = comp.wireByName.get('u')!;
    expect(witness.values.get(uWire.id)).toBe(61n);
  });

  it('records step trace with correct operations', () => {
    const source = `input x\nwire t = x * x`;
    const { witness } = evalCircuit(source, { x: 3 });
    expect(witness.success).toBe(true);

    // Steps: one=1, x=3 (input), t=9 (multiply)
    expect(witness.steps.length).toBeGreaterThanOrEqual(3);
    const tStep = witness.steps.find((s) => s.wireName === 't');
    expect(tStep?.operation).toBe('multiply');
    expect(tStep?.result).toBe(9n);
  });

  it('reduces values mod fieldSize', () => {
    const source = `input x\nwire t = x * x`;
    const { witness } = evalCircuit(source, { x: 12 }, 101n);
    expect(witness.success).toBe(true);
    // 12² = 144. 144 mod 101 = 43
    const tStep = witness.steps.find((s) => s.wireName === 't');
    expect(tStep?.result).toBe(43n);
  });

  it('errors on missing input value', () => {
    const source = `input x\ninput y\nwire t = x * y`;
    const parseResult = parse(source);
    const comp = compile(parseResult.ast, 101n);
    const inputMap = new Map<string, bigint>([['x', 3n]]); // y missing
    const witness = evaluateWitnessFromAST(comp, parseResult.ast, inputMap);
    expect(witness.success).toBe(false);
    expect(witness.errors.some((e) => e.wireName === 'y')).toBe(true);
  });

  it('handles subtraction', () => {
    const source = `input x\ninput y\nwire t = x - y`;
    const { witness, comp } = evalCircuit(source, { x: 10, y: 3 });
    expect(witness.success).toBe(true);
    const tWire = comp.wireByName.get('t')!;
    expect(witness.values.get(tWire.id)).toBe(7n);
  });

  it('handles negative results in finite field', () => {
    const source = `input x\ninput y\nwire t = x - y`;
    const { witness, comp } = evalCircuit(source, { x: 3, y: 10 }, 101n);
    expect(witness.success).toBe(true);
    const tWire = comp.wireByName.get('t')!;
    // 3 - 10 = -7 mod 101 = 94
    expect(witness.values.get(tWire.id)).toBe(94n);
  });
});
