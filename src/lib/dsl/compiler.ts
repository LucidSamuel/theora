import type {
  ASTNode, Expr, Wire, Constraint, CompilationResult, CompileError, LinComb,
} from './types';

const DEFAULT_FIELD_SIZE = 101n;

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/**
 * Compiles a parsed AST into an R1CS system (wires + constraints).
 *
 * Wire ordering: wire 0 = "one" (constant 1), then inputs, then public, then intermediates.
 * Each multiplication in the DSL generates one R1CS constraint.
 * Assert statements generate equality constraints.
 * Linear combinations (add, sub, scalar mul) are free — no constraints generated.
 */
export function compile(ast: ASTNode[], fieldSize: bigint = DEFAULT_FIELD_SIZE): CompilationResult {
  const errors: CompileError[] = [];
  const wires: Wire[] = [];
  const constraints: Constraint[] = [];
  const wireByName = new Map<string, Wire>();

  // Wire 0: constant "one"
  const oneWire: Wire = { id: 0, name: 'one', type: 'one', sourceLine: 0 };
  wires.push(oneWire);
  wireByName.set('one', oneWire);

  let nextWireId = 1;
  let nextConstraintId = 0;

  function addWire(name: string, type: Wire['type'], line: number): Wire {
    const w: Wire = { id: nextWireId++, name, type, sourceLine: line };
    wires.push(w);
    wireByName.set(name, w);
    return w;
  }

  // Map from intermediate wire name to its defining expression's linear combination
  const wireDefs = new Map<string, { expr: Expr; line: number }>();

  // First pass: declare all wires
  for (const node of ast) {
    switch (node.type) {
      case 'input':
        if (wireByName.has(node.name)) {
          errors.push({ line: node.line, message: `Duplicate declaration: '${node.name}'` });
        } else {
          addWire(node.name, 'input', node.line);
        }
        break;
      case 'public':
        if (wireByName.has(node.name)) {
          errors.push({ line: node.line, message: `Duplicate declaration: '${node.name}'` });
        } else {
          addWire(node.name, 'public', node.line);
        }
        break;
      case 'wire':
        if (wireByName.has(node.name)) {
          errors.push({ line: node.line, message: `Duplicate declaration: '${node.name}'` });
        } else {
          addWire(node.name, 'intermediate', node.line);
          wireDefs.set(node.name, { expr: node.expr, line: node.line });
        }
        break;
    }
  }

  if (errors.length > 0) {
    return {
      success: false, wires, constraints, fieldSize, errors,
      wireByName, inputWires: [], publicWires: [],
    };
  }

  /**
   * Flatten an expression to a linear combination.
   * If the expression contains a multiplication, emit an R1CS constraint
   * and return the output wire as a single-term linear combination.
   */
  function flattenExpr(expr: Expr, line: number): LinComb | null {
    switch (expr.type) {
      case 'const': {
        const lc: LinComb = new Map();
        lc.set(0, mod(BigInt(expr.value), fieldSize)); // coefficient on the "one" wire
        return lc;
      }
      case 'var': {
        const w = wireByName.get(expr.name);
        if (!w) {
          errors.push({ line, message: `Undefined variable '${expr.name}'` });
          return null;
        }
        const lc: LinComb = new Map();
        lc.set(w.id, 1n);
        return lc;
      }
      case 'add': {
        const left = flattenExpr(expr.left, line);
        const right = flattenExpr(expr.right, line);
        if (!left || !right) return null;
        return addLinCombs(left, right, fieldSize);
      }
      case 'sub': {
        const left = flattenExpr(expr.left, line);
        const right = flattenExpr(expr.right, line);
        if (!left || !right) return null;
        return subLinCombs(left, right, fieldSize);
      }
      case 'neg': {
        const inner = flattenExpr(expr.operand, line);
        if (!inner) return null;
        return negLinComb(inner, fieldSize);
      }
      case 'mul': {
        const left = flattenExpr(expr.left, line);
        const right = flattenExpr(expr.right, line);
        if (!left || !right) return null;

        // Check if one side is a constant — then it's a scalar multiplication (free)
        if (isConstant(left)) {
          const scalar = getConstantValue(left);
          return scaleLinComb(right, scalar, fieldSize);
        }
        if (isConstant(right)) {
          const scalar = getConstantValue(right);
          return scaleLinComb(left, scalar, fieldSize);
        }

        // True multiplication: emit constraint A * B = C
        // C is a new intermediate wire (or the declaring wire if available)
        const outputWire = addWire(`_mul${nextConstraintId}`, 'intermediate', line);
        const constraint: Constraint = {
          id: nextConstraintId++,
          a: left,
          b: right,
          c: new Map([[outputWire.id, 1n]]),
          sourceLine: line,
          sourceExpr: exprToString(expr),
          constraintType: 'multiplication',
          definesWireId: outputWire.id,
        };
        constraints.push(constraint);

        const lc: LinComb = new Map();
        lc.set(outputWire.id, 1n);
        return lc;
      }
    }
  }

  // Second pass: compile wire definitions and asserts
  for (const node of ast) {
    if (node.type === 'wire') {
      const def = wireDefs.get(node.name);
      if (!def) continue;
      const wire = wireByName.get(node.name)!;

      const exprLc = flattenExpr(def.expr, def.line);
      if (!exprLc) continue;

      // Check if this expression was a multiplication (it generated a constraint
      // with a new _mulN wire). If so, add equality constraint: _mulN = wire.
      // Optimization: if the expr was a simple multiplication that created a _mul wire,
      // replace the _mul wire's constraint output with this wire instead.
      const lastConstraint = constraints[constraints.length - 1];
      if (lastConstraint && lastConstraint.constraintType === 'multiplication' &&
          lastConstraint.sourceLine === def.line) {
        // The multiplication created a temp _mulN wire. Replace it with the actual wire.
        const tempWireId = [...lastConstraint.c.keys()][0]!;
        const tempWire = wires.find((w) => w.id === tempWireId);
        if (tempWire && tempWire.name.startsWith('_mul')) {
          // Rewrite constraint C to point to the declaring wire
          lastConstraint.c = new Map([[wire.id, 1n]]);
          lastConstraint.definesWireId = wire.id;
          // Remove the temp wire
          const idx = wires.indexOf(tempWire);
          if (idx >= 0) {
            wires.splice(idx, 1);
            wireByName.delete(tempWire.name);
          }
        }
      } else {
        // Bind the declared wire to its linear definition:
        // 1 * (expr - wire) = 0
        const definition = subLinCombs(exprLc, new Map([[wire.id, 1n]]), fieldSize);
        const constraint: Constraint = {
          id: nextConstraintId++,
          a: new Map([[0, 1n]]),
          b: definition,
          c: new Map(),
          sourceLine: def.line,
          sourceExpr: `${wire.name} = ${exprToString(def.expr)}`,
          constraintType: 'definition',
          definesWireId: wire.id,
        };
        constraints.push(constraint);
      }
    }

    if (node.type === 'assert') {
      const leftLc = flattenExpr(node.left, node.line);
      const rightLc = flattenExpr(node.right, node.line);
      if (!leftLc || !rightLc) continue;

      // Equality constraint: left - right = 0
      // Encoded as: (left - right) * 1 = 0
      const diff = subLinCombs(leftLc, rightLc, fieldSize);
      const constraint: Constraint = {
        id: nextConstraintId++,
        a: diff,
        b: new Map([[0, 1n]]), // multiply by 1
        c: new Map(), // should equal 0
        sourceLine: node.line,
        sourceExpr: `assert ${exprToString(node.left)} == ${exprToString(node.right)}`,
        constraintType: 'assertion',
        definesWireId: null,
      };
      constraints.push(constraint);
    }
  }

  const inputWires = wires.filter((w) => w.type === 'input');
  const publicWires = wires.filter((w) => w.type === 'public');

  return {
    success: errors.length === 0,
    wires,
    constraints,
    fieldSize,
    errors,
    wireByName,
    inputWires,
    publicWires,
  };
}

// --- Linear Combination Helpers ---

function addLinCombs(a: LinComb, b: LinComb, p: bigint): LinComb {
  const result = new Map(a);
  for (const [wireId, coeff] of b) {
    const existing = result.get(wireId) ?? 0n;
    const sum = mod(existing + coeff, p);
    if (sum === 0n) {
      result.delete(wireId);
    } else {
      result.set(wireId, sum);
    }
  }
  return result;
}

function subLinCombs(a: LinComb, b: LinComb, p: bigint): LinComb {
  return addLinCombs(a, negLinComb(b, p), p);
}

function negLinComb(lc: LinComb, p: bigint): LinComb {
  const result: LinComb = new Map();
  for (const [wireId, coeff] of lc) {
    result.set(wireId, mod(-coeff, p));
  }
  return result;
}

function scaleLinComb(lc: LinComb, scalar: bigint, p: bigint): LinComb {
  const result: LinComb = new Map();
  for (const [wireId, coeff] of lc) {
    const v = mod(coeff * scalar, p);
    if (v !== 0n) result.set(wireId, v);
  }
  return result;
}

function isConstant(lc: LinComb): boolean {
  if (lc.size === 0) return true; // zero
  if (lc.size === 1 && lc.has(0)) return true; // only the "one" wire
  return false;
}

function getConstantValue(lc: LinComb): bigint {
  return lc.get(0) ?? 0n;
}

// --- Expression to string ---

export function exprToString(expr: Expr): string {
  switch (expr.type) {
    case 'const': return String(expr.value);
    case 'var': return expr.name;
    case 'add': return `${exprToString(expr.left)} + ${exprToString(expr.right)}`;
    case 'sub': return `${exprToString(expr.left)} - ${exprToString(expr.right)}`;
    case 'mul': return `${exprToString(expr.left)} * ${exprToString(expr.right)}`;
    case 'neg': return `-${exprToString(expr.operand)}`;
  }
}
