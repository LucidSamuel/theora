import type {
  CompilationResult, WitnessResult, ConstraintCheckResult, CheckResult,
} from './types';

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function evalLinComb(
  lc: Map<number, bigint>,
  values: Map<number, bigint>,
  p: bigint,
): bigint {
  let sum = 0n;
  for (const [wireId, coeff] of lc) {
    const val = values.get(wireId) ?? 0n;
    sum = mod(sum + coeff * val, p);
  }
  return sum;
}

/**
 * Checks whether all R1CS constraints are satisfied by the given witness.
 * For each constraint: A·w * B·w should equal C·w (mod fieldSize).
 */
export function checkConstraints(
  compilation: CompilationResult,
  witness: WitnessResult,
): CheckResult {
  const { constraints, fieldSize } = compilation;
  const { values } = witness;
  const checks: ConstraintCheckResult[] = [];

  for (const constraint of constraints) {
    const a_value = evalLinComb(constraint.a, values, fieldSize);
    const b_value = evalLinComb(constraint.b, values, fieldSize);
    const c_value = evalLinComb(constraint.c, values, fieldSize);
    const ab_product = mod(a_value * b_value, fieldSize);
    const satisfied = ab_product === c_value;

    const check: ConstraintCheckResult = {
      constraintId: constraint.id,
      satisfied,
      a_value,
      b_value,
      c_value,
      ab_product,
      sourceExpr: constraint.sourceExpr,
      sourceLine: constraint.sourceLine,
    };

    if (!satisfied) {
      check.mismatch = {
        expected: ab_product,
        actual: c_value,
        difference: mod(ab_product - c_value, fieldSize),
      };
    }

    checks.push(check);
  }

  const failedConstraints = checks.filter((c) => !c.satisfied);

  return {
    allSatisfied: failedConstraints.length === 0,
    checks,
    failedConstraints,
    firstFailure: failedConstraints[0] ?? null,
  };
}
