import type { CompilationResult, Wire } from './dsl/types';

export interface GraphLayout {
  wirePositions: Map<number, { x: number; y: number }>;
  constraintPositions: Map<number, { x: number; y: number; width: number; height: number }>;
  edges: GraphEdge[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface GraphEdge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  wireId: number;
  constraintId: number;
  direction: 'input' | 'output';
}

const WIRE_RADIUS = 28;
const CONSTRAINT_WIDTH = 160;
const CONSTRAINT_HEIGHT = 48;
const LAYER_GAP_X = 200;
const NODE_GAP_Y = 80;
const PADDING = 60;

/**
 * Computes a layered left-to-right graph layout.
 * Layer 0: inputs + public
 * Layer 1..N: intermediate wires (topologically sorted)
 * Constraints positioned between their input wires and output wire.
 */
export function computeLayout(compilation: CompilationResult): GraphLayout {
  const { wires, constraints } = compilation;
  const wirePositions = new Map<number, { x: number; y: number }>();
  const constraintPositions = new Map<number, { x: number; y: number; width: number; height: number }>();
  const edges: GraphEdge[] = [];

  // Skip the "one" wire and internal _mul wires from the visual layout
  const visibleWires = wires.filter((w) => w.type !== 'one' && !w.name.startsWith('_mul'));

  // Assign layers to wires using topological sorting
  const wireLayer = new Map<number, number>();
  const wireDepth = new Map<number, number>();

  // Build adjacency: wire → wires it depends on (through constraints)
  const deps = new Map<number, Set<number>>();
  for (const w of visibleWires) deps.set(w.id, new Set());

  for (const c of constraints) {
    const outputWireIds = getOutputWireIds(c, visibleWires);
    const inputWireIds = getInputWireIds(c, visibleWires);
    for (const oId of outputWireIds) {
      const d = deps.get(oId);
      if (d) {
        for (const iId of inputWireIds) {
          if (iId !== oId) d.add(iId);
        }
      }
    }
  }

  // Compute depth for each wire (longest path from any input)
  function computeDepth(wireId: number, visited: Set<number>): number {
    if (wireDepth.has(wireId)) return wireDepth.get(wireId)!;
    if (visited.has(wireId)) return 0; // cycle protection
    visited.add(wireId);

    const d = deps.get(wireId);
    if (!d || d.size === 0) {
      wireDepth.set(wireId, 0);
      return 0;
    }

    let maxDep = 0;
    for (const depId of d) {
      maxDep = Math.max(maxDep, computeDepth(depId, visited) + 1);
    }
    wireDepth.set(wireId, maxDep);
    return maxDep;
  }

  for (const w of visibleWires) {
    computeDepth(w.id, new Set());
  }

  // Assign layers
  // Input/public wires go to layer 0 regardless of computed depth
  for (const w of visibleWires) {
    if (w.type === 'input' || w.type === 'public') {
      wireLayer.set(w.id, 0);
    } else {
      wireLayer.set(w.id, (wireDepth.get(w.id) ?? 0) + 1);
    }
  }

  // Group wires by layer
  const layers = new Map<number, Wire[]>();
  for (const w of visibleWires) {
    const layer = wireLayer.get(w.id) ?? 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(w);
  }

  const maxLayer = Math.max(0, ...layers.keys());

  // Position wires in each layer
  for (let layer = 0; layer <= maxLayer; layer++) {
    const layerWires = layers.get(layer) ?? [];
    const x = PADDING + layer * LAYER_GAP_X;
    const startY = PADDING + (maxLayer > 0 ? 0 : 0);

    for (let i = 0; i < layerWires.length; i++) {
      const w = layerWires[i]!;
      const y = startY + i * NODE_GAP_Y + NODE_GAP_Y / 2;
      wirePositions.set(w.id, { x, y });
    }
  }

  // Position constraints between their inputs and outputs
  for (const c of constraints) {
    const inputPositions: { x: number; y: number }[] = [];
    const outputPositions: { x: number; y: number }[] = [];

    for (const wId of getInputWireIds(c, visibleWires)) {
      const pos = wirePositions.get(wId);
      if (pos) inputPositions.push(pos);
    }
    for (const wId of getOutputWireIds(c, visibleWires)) {
      const pos = wirePositions.get(wId);
      if (pos) outputPositions.push(pos);
    }

    if (inputPositions.length === 0 && outputPositions.length === 0) continue;

    const allPositions = [...inputPositions, ...outputPositions];
    const avgX = allPositions.reduce((s, p) => s + p.x, 0) / allPositions.length;
    const avgY = allPositions.reduce((s, p) => s + p.y, 0) / allPositions.length;

    // Place constraint between input and output layers
    const inputMaxX = inputPositions.length > 0
      ? Math.max(...inputPositions.map((p) => p.x))
      : avgX;
    const outputMinX = outputPositions.length > 0
      ? Math.min(...outputPositions.map((p) => p.x))
      : avgX;
    const cx = (inputMaxX + outputMinX) / 2;

    constraintPositions.set(c.id, {
      x: cx,
      y: avgY,
      width: CONSTRAINT_WIDTH,
      height: CONSTRAINT_HEIGHT,
    });

    // Build edges
    for (const wId of getInputWireIds(c, visibleWires)) {
      const pos = wirePositions.get(wId);
      if (!pos) continue;
      edges.push({
        from: pos,
        to: { x: cx - CONSTRAINT_WIDTH / 2, y: avgY },
        wireId: wId,
        constraintId: c.id,
        direction: 'input',
      });
    }
    for (const wId of getOutputWireIds(c, visibleWires)) {
      const pos = wirePositions.get(wId);
      if (!pos) continue;
      edges.push({
        from: { x: cx + CONSTRAINT_WIDTH / 2, y: avgY },
        to: pos,
        wireId: wId,
        constraintId: c.id,
        direction: 'output',
      });
    }
  }

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of wirePositions.values()) {
    minX = Math.min(minX, pos.x - WIRE_RADIUS);
    minY = Math.min(minY, pos.y - WIRE_RADIUS);
    maxX = Math.max(maxX, pos.x + WIRE_RADIUS);
    maxY = Math.max(maxY, pos.y + WIRE_RADIUS);
  }
  for (const pos of constraintPositions.values()) {
    minX = Math.min(minX, pos.x - pos.width / 2);
    minY = Math.min(minY, pos.y - pos.height / 2);
    maxX = Math.max(maxX, pos.x + pos.width / 2);
    maxY = Math.max(maxY, pos.y + pos.height / 2);
  }

  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300; }

  return {
    wirePositions,
    constraintPositions,
    edges,
    bounds: { minX: minX - PADDING, minY: minY - PADDING, maxX: maxX + PADDING, maxY: maxY + PADDING },
  };
}

function getInputWireIds(
  constraint: CompilationResult['constraints'][number],
  visibleWires: Wire[],
): number[] {
  const visibleIds = new Set(visibleWires.map((wire) => wire.id));
  const inputWireIds = new Set<number>();

  for (const wId of [...constraint.a.keys(), ...constraint.b.keys()]) {
    if (wId === 0 || wId === constraint.definesWireId || !visibleIds.has(wId)) continue;
    inputWireIds.add(wId);
  }

  return [...inputWireIds];
}

function getOutputWireIds(
  constraint: CompilationResult['constraints'][number],
  visibleWires: Wire[],
): number[] {
  const visibleIds = new Set(visibleWires.map((wire) => wire.id));
  const outputWireIds = new Set<number>();

  if (constraint.definesWireId !== null && visibleIds.has(constraint.definesWireId)) {
    outputWireIds.add(constraint.definesWireId);
  }

  for (const wId of constraint.c.keys()) {
    if (wId !== 0 && visibleIds.has(wId)) outputWireIds.add(wId);
  }

  return [...outputWireIds];
}

export { WIRE_RADIUS, CONSTRAINT_WIDTH, CONSTRAINT_HEIGHT };
