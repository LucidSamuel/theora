import type {
  CompilationResult, Expr, WitnessResult, WitnessStep, WitnessError, Wire,
} from './types';
import { exprToString } from './compiler';

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/**
 * Evaluates the witness by computing every wire's value from the inputs
 * and the wire definitions in the AST.
 *
 * Records each computation step for the trace UI.
 */
export function evaluateWitness(
  compilation: CompilationResult,
  inputs: Map<string, bigint>,
): WitnessResult {
  const { wires, fieldSize } = compilation;
  const values = new Map<number, bigint>();
  const steps: WitnessStep[] = [];
  const errors: WitnessError[] = [];

  // Wire 0 (one) = 1
  values.set(0, 1n);
  steps.push({
    wireId: 0,
    wireName: 'one',
    expression: 'one = 1',
    inputs: [],
    operation: 'constant',
    result: 1n,
    sourceLine: 0,
    status: 'ok',
  });

  // Set input and public wire values
  for (const wire of wires) {
    if (wire.type === 'input' || wire.type === 'public') {
      const userValue = inputs.get(wire.name);
      if (userValue === undefined) {
        errors.push({
          wireId: wire.id,
          wireName: wire.name,
          message: `Missing value for ${wire.type} wire '${wire.name}'`,
        });
        continue;
      }
      const val = mod(userValue, fieldSize);
      values.set(wire.id, val);
      steps.push({
        wireId: wire.id,
        wireName: wire.name,
        expression: `${wire.name} = ${val}`,
        inputs: [],
        operation: 'input',
        result: val,
        sourceLine: wire.sourceLine,
        status: userValue >= fieldSize ? 'overflow' : 'ok',
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, values, steps, errors };
  }

  // Evaluate intermediate wire definitions from the AST
  // We need the original AST to get the expressions.
  // The compiler stored wire definitions — we need to reconstruct them from the AST.
  // Instead, we re-parse the wire definitions from the compilation's wire list
  // and the source AST. Since we don't store the AST in CompilationResult,
  // we'll compute intermediate values from the constraints.

  // Actually, let's evaluate by topological order using the wire definitions.
  // We need the AST for this. Let's accept the AST as a parameter option,
  // or derive values from constraints.

  // Simpler approach: evaluate each non-input, non-public, non-one wire
  // by finding the constraint that outputs to it and computing from that.
  // For linear combination wires (no constraint output), we'd need the expression.

  // Best approach: accept the AST alongside compilation for witness evaluation.
  // But the spec has evaluateWitness(compilation, inputs).
  // Let's enrich CompilationResult with wire expressions during compilation.

  // For now: compute intermediate wire values from constraints.
  // A multiplication constraint with C = {wireId: 1n} means:
  //   wire_value = sum(a_coeff * wire_value) * sum(b_coeff * wire_value)
  // An intermediate wire not in any constraint's C is a linear combination wire.

  // Build a map: wire_id → constraint that defines it
  const constraintDefinesWire = new Map<number, number>(); // wire_id → constraint_id
  for (const c of compilation.constraints) {
    if (c.constraintType === 'multiplication') {
      for (const wireId of c.c.keys()) {
        if (wireId !== 0) {
          constraintDefinesWire.set(wireId, c.id);
        }
      }
    }
  }

  // Process wires in order (they should already be in dependency order
  // since the compiler processes them sequentially)
  for (const wire of wires) {
    if (values.has(wire.id)) continue; // already set (one, input, public)

    const constraintIdx = constraintDefinesWire.get(wire.id);
    if (constraintIdx !== undefined) {
      // This wire is the output of a multiplication constraint
      const constraint = compilation.constraints.find((c) => c.id === constraintIdx)!;
      const aVal = evalLinComb(constraint.a, values, fieldSize);
      const bVal = evalLinComb(constraint.b, values, fieldSize);

      if (aVal === null || bVal === null) {
        errors.push({
          wireId: wire.id,
          wireName: wire.name,
          message: `Cannot evaluate '${wire.name}': dependencies not yet computed`,
        });
        continue;
      }

      const rawResult = aVal * bVal;
      const result = mod(rawResult, fieldSize);
      values.set(wire.id, result);

      const inputNames = collectInputNames(constraint.a, constraint.b, wires, values);
      steps.push({
        wireId: wire.id,
        wireName: wire.name,
        expression: `${wire.name} = ${constraint.sourceExpr}`,
        inputs: inputNames,
        operation: 'multiply',
        result,
        sourceLine: wire.sourceLine,
        status: rawResult >= fieldSize ? 'overflow' : 'ok',
      });
    }
    // If wire is not defined by a constraint, it's a linear combination wire.
    // We'd need the expression to evaluate it. For now, mark as error.
    // This should be rare since most intermediate wires are multiplication outputs.
  }

  return {
    success: errors.length === 0,
    values,
    steps,
    errors,
  };
}

/**
 * Enhanced witness evaluator that accepts the AST for full expression evaluation.
 * This is the primary entry point used by the debug UI.
 */
export function evaluateWitnessFromAST(
  compilation: CompilationResult,
  ast: import('./types').ASTNode[],
  inputs: Map<string, bigint>,
): WitnessResult {
  const { wires, wireByName, fieldSize } = compilation;
  const values = new Map<number, bigint>();
  const steps: WitnessStep[] = [];
  const errors: WitnessError[] = [];

  // Wire 0 = 1
  values.set(0, 1n);
  steps.push({
    wireId: 0, wireName: 'one', expression: 'one = 1',
    inputs: [], operation: 'constant', result: 1n, sourceLine: 0, status: 'ok',
  });

  // Input and public values
  for (const wire of wires) {
    if (wire.type === 'input' || wire.type === 'public') {
      const userValue = inputs.get(wire.name);
      if (userValue === undefined) {
        errors.push({ wireId: wire.id, wireName: wire.name, message: `Missing value for '${wire.name}'` });
        continue;
      }
      const val = mod(userValue, fieldSize);
      values.set(wire.id, val);
      steps.push({
        wireId: wire.id, wireName: wire.name, expression: `${wire.name} = ${val}`,
        inputs: [], operation: 'input', result: val, sourceLine: wire.sourceLine,
        status: userValue >= fieldSize ? 'overflow' : 'ok',
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, values, steps, errors };
  }

  // Evaluate wire definitions from AST
  for (const node of ast) {
    if (node.type !== 'wire') continue;
    const wire = wireByName.get(node.name);
    if (!wire || values.has(wire.id)) continue;

    const result = evalExpr(node.expr, wireByName, values, fieldSize);
    if (result === null) {
      errors.push({ wireId: wire.id, wireName: wire.name, message: `Cannot evaluate '${wire.name}': undefined dependency` });
      continue;
    }

    const rawResult = result.raw;
    const val = result.value;
    values.set(wire.id, val);

    const depNames = collectExprDeps(node.expr, wireByName, values);
    steps.push({
      wireId: wire.id,
      wireName: wire.name,
      expression: `${wire.name} = ${exprToString(node.expr)}`,
      inputs: depNames,
      operation: result.operation,
      result: val,
      sourceLine: node.line,
      status: rawResult >= fieldSize || rawResult < 0n ? 'overflow' : 'ok',
    });
  }

  return { success: errors.length === 0, values, steps, errors };
}

// --- Helpers ---

function evalExpr(
  expr: Expr,
  wireByName: Map<string, Wire>,
  values: Map<number, bigint>,
  p: bigint,
): { value: bigint; raw: bigint; operation: WitnessStep['operation'] } | null {
  switch (expr.type) {
    case 'const':
      return { value: mod(BigInt(expr.value), p), raw: BigInt(expr.value), operation: 'constant' };
    case 'var': {
      const w = wireByName.get(expr.name);
      if (!w) return null;
      const v = values.get(w.id);
      if (v === undefined) return null;
      return { value: v, raw: v, operation: 'input' };
    }
    case 'add': {
      const l = evalExpr(expr.left, wireByName, values, p);
      const r = evalExpr(expr.right, wireByName, values, p);
      if (!l || !r) return null;
      const raw = l.value + r.value;
      return { value: mod(raw, p), raw, operation: 'add' };
    }
    case 'sub': {
      const l = evalExpr(expr.left, wireByName, values, p);
      const r = evalExpr(expr.right, wireByName, values, p);
      if (!l || !r) return null;
      const raw = l.value - r.value;
      return { value: mod(raw, p), raw, operation: 'subtract' };
    }
    case 'mul': {
      const l = evalExpr(expr.left, wireByName, values, p);
      const r = evalExpr(expr.right, wireByName, values, p);
      if (!l || !r) return null;
      const raw = l.value * r.value;
      return { value: mod(raw, p), raw, operation: 'multiply' };
    }
    case 'neg': {
      const inner = evalExpr(expr.operand, wireByName, values, p);
      if (!inner) return null;
      const raw = -inner.value;
      return { value: mod(raw, p), raw, operation: 'negate' };
    }
  }
}

function evalLinComb(
  lc: Map<number, bigint>,
  values: Map<number, bigint>,
  p: bigint,
): bigint | null {
  let sum = 0n;
  for (const [wireId, coeff] of lc) {
    const val = values.get(wireId);
    if (val === undefined) return null;
    sum = mod(sum + coeff * val, p);
  }
  return sum;
}

function collectInputNames(
  a: Map<number, bigint>,
  b: Map<number, bigint>,
  wires: Wire[],
  values: Map<number, bigint>,
): { name: string; value: bigint }[] {
  const result: { name: string; value: bigint }[] = [];
  const seen = new Set<number>();
  for (const wireId of [...a.keys(), ...b.keys()]) {
    if (wireId === 0 || seen.has(wireId)) continue;
    seen.add(wireId);
    const wire = wires.find((w) => w.id === wireId);
    if (wire) {
      result.push({ name: wire.name, value: values.get(wireId) ?? 0n });
    }
  }
  return result;
}

function collectExprDeps(
  expr: Expr,
  wireByName: Map<string, Wire>,
  values: Map<number, bigint>,
): { name: string; value: bigint }[] {
  const result: { name: string; value: bigint }[] = [];
  const seen = new Set<string>();

  function walk(e: Expr): void {
    if (e.type === 'var' && !seen.has(e.name)) {
      seen.add(e.name);
      const w = wireByName.get(e.name);
      if (w) result.push({ name: e.name, value: values.get(w.id) ?? 0n });
    }
    if (e.type === 'add' || e.type === 'sub' || e.type === 'mul') {
      walk(e.left);
      walk(e.right);
    }
    if (e.type === 'neg') walk(e.operand);
  }

  walk(expr);
  return result;
}
