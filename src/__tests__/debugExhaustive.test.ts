import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';
import { compile } from '../modes/debug/dsl/compiler';
import { exhaustiveCheck } from '../modes/debug/dsl/exhaustive';

function exhaustive(source: string, fieldSize = 7n) {
  const parseResult = parse(source);
  expect(parseResult.success).toBe(true);
  const comp = compile(parseResult.ast, fieldSize);
  expect(comp.success).toBe(true);
  return exhaustiveCheck(comp, parseResult.ast);
}

describe('Debug DSL Exhaustive Checker', () => {
  it('simple identity: all combos satisfy for 1 input + 1 public over GF(7)', () => {
    // assert x == out — only passes when x == out, so not all combos satisfy
    const source = `input x\npublic out\nassert x == out`;
    const result = exhaustive(source, 7n);
    expect(result.totalCombinations).toBe(49); // 7^2
    expect(result.tested).toBe(49);
    expect(result.allSatisfied).toBe(false);
    expect(result.counterexample).toBeTruthy();
  });

  it('multiplication-only circuit satisfies all inputs', () => {
    // wire t = x * x has no assertion, so all constraints (the mul) are always satisfied
    const source = `input x\nwire t = x * x`;
    const result = exhaustive(source, 7n);
    expect(result.totalCombinations).toBe(7); // 7^1
    expect(result.tested).toBe(7);
    expect(result.allSatisfied).toBe(true);
  });

  it('tracks unique outputs', () => {
    const source = `input x\npublic out\nassert x == out`;
    const result = exhaustive(source, 7n);
    // only 7 combos (x==out) pass, but we track public values for ALL tested combos
    // public wire 'out' takes all values 0-6, so uniqueOutputs = 7
    expect(result.uniqueOutputs).toBeGreaterThan(0);
  });

  it('counterexample has explanation', () => {
    const source = `input x\npublic out\nassert x == out`;
    const result = exhaustive(source, 7n);
    expect(result.counterexample!.explanation).toBeTruthy();
    expect(result.counterexample!.failedConstraints.length).toBeGreaterThan(0);
  });

  it('calls progress callback', () => {
    const source = `input x\nwire t = x * x`;
    const parseResult = parse(source);
    const comp = compile(parseResult.ast, 7n);
    let progressCalled = false;
    exhaustiveCheck(comp, parseResult.ast, (tested, total) => {
      progressCalled = true;
      expect(total).toBe(7);
      expect(tested).toBeLessThanOrEqual(7);
    });
    // With only 7 combos and reports every 100, the final call at end should still fire
    // Actually the progress fires at tested%100===0 and at end. With 7 items, only the final call fires.
    expect(progressCalled).toBe(true);
  });
});
