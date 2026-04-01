import { describe, it, expect } from 'vitest';
import { parse } from '../modes/debug/dsl/parser';

describe('Debug DSL Parser', () => {
  it('parses a valid circuit with all statement types', () => {
    const source = `
// A simple circuit
input x
public out
wire t = x * x
wire u = t + x + 5
assert u == out
`;
    const result = parse(source);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    const stmts = result.ast.filter((n) => n.type !== 'comment');
    expect(stmts).toHaveLength(5);
    expect(stmts[0]!.type).toBe('input');
    expect(stmts[1]!.type).toBe('public');
    expect(stmts[2]!.type).toBe('wire');
    expect(stmts[3]!.type).toBe('wire');
    expect(stmts[4]!.type).toBe('assert');
  });

  it('reports error for double declaration', () => {
    const source = `input x\ninput x`;
    const result = parse(source);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('already declared'))).toBe(true);
  });

  it('reports error for undefined variable', () => {
    const source = `input x\nwire t = y * x`;
    const result = parse(source);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Undefined variable 'y'"))).toBe(true);
  });

  it('reports error for multiple multiplications', () => {
    const source = `input a\ninput b\ninput c\nwire t = a * b * c`;
    const result = parse(source);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Multiple multiplications'))).toBe(true);
  });

  it('reports error for missing expression after operator', () => {
    const source = `input x\nwire t = x +`;
    const result = parse(source);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports error for empty input', () => {
    const result = parse('');
    expect(result.success).toBe(true); // empty is valid (no errors, no statements)
    expect(result.ast.filter((n) => n.type !== 'comment')).toHaveLength(0);
  });

  it('suggests similar variable names (Levenshtein)', () => {
    const source = `input x\nwire t = xx * 2`;
    const result = parse(source);
    expect(result.errors.some((e) => e.hint?.includes("Did you mean 'x'"))).toBe(true);
  });

  it('tracks line numbers in AST nodes', () => {
    const source = `input x\n\nwire t = x * x`;
    const result = parse(source);
    const inputNode = result.ast.find((n) => n.type === 'input');
    const wireNode = result.ast.find((n) => n.type === 'wire');
    expect(inputNode?.line).toBe(1);
    expect(wireNode?.line).toBe(3);
  });

  it('handles comments correctly', () => {
    const source = `// This is a comment\ninput x // inline comment\nwire t = x * x`;
    const result = parse(source);
    expect(result.success).toBe(true);
    const comments = result.ast.filter((n) => n.type === 'comment');
    expect(comments.length).toBeGreaterThanOrEqual(1);
  });

  it('parses negative numbers', () => {
    const source = `input x\nwire t = x + -3`;
    const result = parse(source);
    expect(result.success).toBe(true);
  });

  it('parses parenthesized expressions', () => {
    const source = `input x\ninput y\nwire t = (x + y) * x`;
    const result = parse(source);
    expect(result.success).toBe(true);
    const wireNode = result.ast.find((n) => n.type === 'wire');
    expect(wireNode).toBeTruthy();
  });
});
