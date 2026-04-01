import type { CompilationResult, ConstraintAnalysis, Wire } from './types';

/**
 * Analyzes the constraint system for potential issues:
 * - Unconstrained wires: intermediate wires that never appear as the output
 *   of a multiplication constraint (their value is not bound by any nonlinear check).
 * - Overconstrained wires: wires that appear in more constraints than expected (info only).
 * - Degrees of freedom: wireCount - constraintCount - inputCount.
 */
export function analyzeConstraints(compilation: CompilationResult): ConstraintAnalysis {
  const { wires, constraints } = compilation;

  // Build a set of wire IDs that are bound by a defining constraint.
  const definedWires = new Set<number>();
  // Build a set of wire IDs that appear in any A or B vector.
  const constrainedInputs = new Set<number>();

  // Count appearances per wire
  const wireAppearances = new Map<number, number>();

  for (const c of constraints) {
    if ((c.constraintType === 'multiplication' || c.constraintType === 'definition') && c.definesWireId !== null) {
      definedWires.add(c.definesWireId);
    }
    // Count all appearances
    for (const wId of c.a.keys()) {
      constrainedInputs.add(wId);
      wireAppearances.set(wId, (wireAppearances.get(wId) ?? 0) + 1);
    }
    for (const wId of c.b.keys()) {
      constrainedInputs.add(wId);
      wireAppearances.set(wId, (wireAppearances.get(wId) ?? 0) + 1);
    }
    for (const wId of c.c.keys()) {
      wireAppearances.set(wId, (wireAppearances.get(wId) ?? 0) + 1);
    }
  }

  const unconstrainedWires: Wire[] = [];
  for (const wire of wires) {
    if (wire.type !== 'intermediate') continue;
    if (wire.name.startsWith('_mul')) continue; // internal compiler wires
    if (!definedWires.has(wire.id)) {
      unconstrainedWires.push(wire);
    }
  }

  // Overconstrained: wires appearing in >2 constraints (informational)
  const overconstrainedWires: Wire[] = [];
  for (const wire of wires) {
    if (wire.type === 'one') continue;
    const appearances = wireAppearances.get(wire.id) ?? 0;
    if (appearances > 3) {
      overconstrainedWires.push(wire);
    }
  }

  const inputCount = wires.filter((w) => w.type === 'input').length;
  const publicCount = wires.filter((w) => w.type === 'public').length;
  const wireCount = wires.filter((w) => w.type !== 'one' && !w.name.startsWith('_mul')).length;

  return {
    unconstrainedWires,
    overconstrainedWires,
    constraintCount: constraints.length,
    wireCount,
    inputCount,
    publicCount,
    degreesOfFreedom: wireCount - constraints.length - inputCount - publicCount,
  };
}
