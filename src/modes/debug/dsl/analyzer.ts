import type { CompilationResult, ConstraintAnalysis, Wire } from './types';

/**
 * Analyzes the constraint system for potential issues:
 * - Unconstrained wires: intermediate wires that never appear as the output
 *   of a defining constraint.
 * - Weak inputs: input wires that only flow through linear constraints and never
 *   become anchored by a multiplication. These are free witness values.
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

  const usesByWire = new Map<number, CompilationResult['constraints']>();
  for (const wire of wires) {
    usesByWire.set(wire.id, []);
  }
  for (const constraint of constraints) {
    for (const wId of [...constraint.a.keys(), ...constraint.b.keys()]) {
      usesByWire.get(wId)?.push(constraint);
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

  const weakInputWires: Wire[] = [];
  for (const wire of wires) {
    if (wire.type !== 'input') continue;
    if (!reachesMultiplication(wire.id, usesByWire, new Set())) {
      weakInputWires.push(wire);
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
    weakInputWires,
    overconstrainedWires,
    constraintCount: constraints.length,
    wireCount,
    inputCount,
    publicCount,
    degreesOfFreedom: wireCount - constraints.length - inputCount - publicCount,
  };
}

function reachesMultiplication(
  wireId: number,
  usesByWire: Map<number, CompilationResult['constraints']>,
  visited: Set<number>,
): boolean {
  if (visited.has(wireId)) return false;
  visited.add(wireId);

  const uses = usesByWire.get(wireId) ?? [];
  for (const constraint of uses) {
    if (constraint.constraintType === 'multiplication') {
      return true;
    }
    if (constraint.constraintType === 'definition' && constraint.definesWireId !== null) {
      if (reachesMultiplication(constraint.definesWireId, usesByWire, visited)) {
        return true;
      }
    }
  }

  return false;
}
