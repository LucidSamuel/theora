import type {
  CompilationResult, WitnessResult, ConstraintCheckResult,
  DependencyNode, FailureTrace, CheckResult,
} from './types';

/**
 * Builds the dependency graph: which wires feed into which constraints,
 * and which constraints output to which wires.
 */
export function buildDependencyGraph(
  compilation: CompilationResult,
  witness: WitnessResult,
  checks: CheckResult,
): DependencyNode[] {
  const { wires, constraints } = compilation;
  const { values } = witness;

  // Map constraint ID to its check status
  const constraintStatus = new Map<number, 'ok' | 'failed'>();
  for (const check of checks.checks) {
    constraintStatus.set(check.constraintId, check.satisfied ? 'ok' : 'failed');
  }

  // Build dependency info for each wire
  const nodes: DependencyNode[] = [];

  for (const wire of wires) {
    const dependsOn: number[] = [];
    const feedsInto: number[] = [];
    let status: 'ok' | 'failed' | 'unchecked' = 'unchecked';

    for (const c of constraints) {
      const isOutput = c.definesWireId === wire.id || c.c.has(wire.id);
      const isInput = !isOutput && (c.a.has(wire.id) || c.b.has(wire.id));

      if (isInput) feedsInto.push(c.id);
      if (isOutput) {
        // This wire depends on the wires in the A and B vectors of this constraint
        for (const wId of c.a.keys()) {
          if (wId !== wire.id && wId !== 0) dependsOn.push(wId);
        }
        for (const wId of c.b.keys()) {
          if (wId !== wire.id && wId !== 0) dependsOn.push(wId);
        }
        // Wire's status comes from the constraint that defines it
        const cStatus = constraintStatus.get(c.id);
        if (cStatus === 'failed') status = 'failed';
        else if (cStatus === 'ok' && status !== 'failed') status = 'ok';
      }
    }

    // Input/public/one wires don't have defining constraints
    if (wire.type === 'input' || wire.type === 'public' || wire.type === 'one') {
      status = 'ok';
    }

    nodes.push({
      wireId: wire.id,
      wireName: wire.name,
      value: values.get(wire.id) ?? 0n,
      dependsOn: [...new Set(dependsOn)],
      feedsInto: [...new Set(feedsInto)],
      constraintStatus: status,
    });
  }

  return nodes;
}

/**
 * Traces backward from a failed constraint to find the root cause.
 * The root cause is the first wire in the backward trace that has an
 * unexpected value (i.e., a wire whose value doesn't match what the
 * constraints expect).
 */
export function traceFailure(
  compilation: CompilationResult,
  witness: WitnessResult,
  checks: CheckResult,
  failedConstraint: ConstraintCheckResult,
): FailureTrace {
  const depGraph = buildDependencyGraph(compilation, witness, checks);
  const nodeMap = new Map(depGraph.map((n) => [n.wireId, n]));
  const { values } = witness;

  // Find the wires involved in the failed constraint
  const constraint = compilation.constraints.find((c) => c.id === failedConstraint.constraintId)!;
  const involvedWireIds = new Set<number>();
  for (const wId of constraint.a.keys()) if (wId !== 0) involvedWireIds.add(wId);
  for (const wId of constraint.b.keys()) if (wId !== 0) involvedWireIds.add(wId);
  for (const wId of constraint.c.keys()) if (wId !== 0) involvedWireIds.add(wId);

  // BFS backward through dependencies
  const traceBack: DependencyNode[] = [];
  const visited = new Set<number>();
  const queue: number[] = [...involvedWireIds];

  while (queue.length > 0) {
    const wireId = queue.shift()!;
    if (visited.has(wireId)) continue;
    visited.add(wireId);

    const node = nodeMap.get(wireId);
    if (!node) continue;
    traceBack.push(node);

    for (const depId of node.dependsOn) {
      if (!visited.has(depId)) queue.push(depId);
    }
  }

  // Root cause: the deepest input wire in the trace, or the first wire
  // where the constraint is failed
  let rootCauseNode = traceBack[0];
  for (const node of traceBack) {
    if (node.constraintStatus === 'failed') {
      rootCauseNode = node;
      break;
    }
  }

  // If no constraint failure found in trace, the root cause is the constraint itself
  if (!rootCauseNode) {
    rootCauseNode = traceBack[0] ?? {
      wireId: -1, wireName: 'unknown', value: 0n,
      dependsOn: [], feedsInto: [], constraintStatus: 'failed' as const,
    };
  }

  // Build explanation
  const mismatch = failedConstraint.mismatch;
  let explanation = `Constraint '${failedConstraint.sourceExpr}' failed at line ${failedConstraint.sourceLine}.`;
  if (mismatch) {
    explanation += ` Expected A*B = ${mismatch.expected}, got C = ${mismatch.actual} (difference: ${mismatch.difference}).`;
  }
  explanation += ` Wire '${rootCauseNode.wireName}' has value ${values.get(rootCauseNode.wireId) ?? '?'}.`;

  return {
    failedConstraint,
    traceBack,
    rootCause: {
      wireId: rootCauseNode.wireId,
      wireName: rootCauseNode.wireName,
      explanation,
    },
  };
}
