import type { CompilationResult, ExhaustiveResult, ASTNode } from './types';
import { evaluateWitnessFromAST } from './witness';
import { checkConstraints } from './checker';

/**
 * Brute-force tests ALL possible input combinations over the finite field.
 * Only feasible for small fields (≤ 101) and few inputs (≤ 3).
 *
 * Returns whether all combinations satisfy all constraints, and if not,
 * provides a counterexample.
 */
export function exhaustiveCheck(
  compilation: CompilationResult,
  ast: ASTNode[],
  onProgress?: (tested: number, total: number) => void,
): ExhaustiveResult {
  const { inputWires, publicWires, fieldSize } = compilation;
  const allInputWires = [...inputWires, ...publicWires];
  const n = allInputWires.length;
  const p = Number(fieldSize);
  const totalCombinations = Math.pow(p, n);

  const outputSet = new Set<string>();
  let tested = 0;
  let counterexample: ExhaustiveResult['counterexample'] = undefined;

  // Generate all combinations
  const indices = new Array(n).fill(0);
  let done = false;

  while (!done) {
    // Build input map from current indices
    const inputs = new Map<string, bigint>();
    for (let i = 0; i < n; i++) {
      inputs.set(allInputWires[i]!.name, BigInt(indices[i]!));
    }

    // Evaluate and check
    const witness = evaluateWitnessFromAST(compilation, ast, inputs);
    if (witness.success) {
      const check = checkConstraints(compilation, witness);

      // Track output values for determinism check
      const publicValues = publicWires
        .map((w) => witness.values.get(w.id) ?? -1n)
        .join(',');
      outputSet.add(publicValues);

      if (!check.allSatisfied && !counterexample) {
        const failedIds = check.failedConstraints.map((c) => c.constraintId);
        const inputDesc = allInputWires.map((w) => `${w.name}=${indices[allInputWires.indexOf(w)]}`).join(', ');
        counterexample = {
          inputs: new Map(inputs),
          failedConstraints: failedIds,
          explanation: `Constraints [${failedIds.join(', ')}] fail with inputs: ${inputDesc}`,
        };
      }
    }

    tested++;
    if (onProgress && tested % 100 === 0) {
      onProgress(tested, totalCombinations);
    }

    // Increment indices (odometer pattern)
    let carry = true;
    for (let i = n - 1; i >= 0 && carry; i--) {
      indices[i]!++;
      if (indices[i]! >= p) {
        indices[i] = 0;
      } else {
        carry = false;
      }
    }
    if (carry) done = true;
  }

  if (onProgress) onProgress(tested, totalCombinations);

  return {
    totalCombinations,
    tested,
    allSatisfied: !counterexample,
    counterexample,
    uniqueOutputs: outputSet.size,
    isInputDetermined: outputSet.size === totalCombinations,
  };
}
