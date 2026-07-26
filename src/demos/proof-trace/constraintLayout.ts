/**
 * Layered DAG layout for a trace's ConstraintSection, mirroring the
 * semantics of src/lib/circuitGraph/layout.ts but driven by the
 * JSON-safe TraceLinComb representation.
 */

import type { ConstraintSection, TraceConstraint, TraceLinComb } from './schema';
import { toDslLinComb } from './schema';

export const NODE_CAP = 500;

const LAYER_GAP_X = 200;
const NODE_GAP_Y = 80;
const PADDING = 60;
export const TRACE_WIRE_RADIUS = 28;
export const TRACE_CONSTRAINT_WIDTH = 160;
export const TRACE_CONSTRAINT_HEIGHT = 48;

export interface TraceGraphLayout {
  wirePositions: Map<number, { x: number; y: number }>;
  constraintPositions: Map<number, { x: number; y: number; width: number; height: number }>;
  edges: { from: { x: number; y: number }; to: { x: number; y: number } }[];
  satisfiedById: Map<number, boolean | null>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  truncated: boolean;
}

function linCombWireIds(lc: TraceLinComb): number[] {
  return lc.map(([wireId]) => wireId);
}

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function evalLinComb(lc: TraceLinComb, witness: Map<number, bigint>, p: bigint): bigint {
  let acc = 0n;
  for (const [wireId, coeff] of toDslLinComb(lc).entries()) {
    acc = mod(acc + coeff * (witness.get(wireId) ?? 0n), p);
  }
  return acc;
}

/** Satisfaction per constraint: stored flag, else recomputed from witness, else null. */
export function resolveSatisfaction(section: ConstraintSection, field: string): Map<number, boolean | null> {
  const p = BigInt(field);
  const witness = section.witness
    ? new Map(Object.entries(section.witness).map(([id, v]) => [Number(id), BigInt(v)]))
    : null;
  const out = new Map<number, boolean | null>();
  for (const constraint of section.constraints) {
    if (constraint.satisfied !== undefined) {
      out.set(constraint.id, constraint.satisfied);
    } else if (witness) {
      const a = evalLinComb(constraint.a, witness, p);
      const b = evalLinComb(constraint.b, witness, p);
      const c = evalLinComb(constraint.c, witness, p);
      out.set(constraint.id, mod(a * b, p) === c);
    } else {
      out.set(constraint.id, null);
    }
  }
  return out;
}

function definedWireId(constraint: TraceConstraint, wireTypeById: Map<number, string>): number | null {
  // A constraint "defines" the first intermediate wire appearing in its c side.
  for (const wireId of linCombWireIds(constraint.c)) {
    if (wireTypeById.get(wireId) === 'intermediate') return wireId;
  }
  return null;
}

export function computeTraceLayout(section: ConstraintSection, field: string): TraceGraphLayout {
  const totalNodes = section.wires.length + section.constraints.length;
  const truncated = totalNodes > NODE_CAP;
  const wires = truncated ? section.wires.slice(0, NODE_CAP) : section.wires;
  const keptWireIds = new Set(wires.map((w) => w.id));
  const constraints = (truncated
    ? section.constraints.slice(0, Math.max(0, NODE_CAP - wires.length))
    : section.constraints
  ).filter((c) =>
    [...linCombWireIds(c.a), ...linCombWireIds(c.b), ...linCombWireIds(c.c)].every((id) => keptWireIds.has(id)),
  );

  const wireTypeById = new Map(wires.map((w) => [w.id, w.type]));
  const visibleWires = wires.filter((w) => w.type !== 'one' && !w.name.startsWith('_mul'));

  // Wire depth: 1 + max depth of wires in the a/b of the defining constraint.
  const depth = new Map<number, number>();
  for (const w of visibleWires) {
    if (w.type === 'input' || w.type === 'public') depth.set(w.id, 0);
  }
  const definingByWire = new Map<number, TraceConstraint>();
  for (const c of constraints) {
    const defined = definedWireId(c, wireTypeById);
    if (defined !== null && !definingByWire.has(defined)) definingByWire.set(defined, c);
  }
  const resolveDepth = (wireId: number, visiting: Set<number>): number => {
    const known = depth.get(wireId);
    if (known !== undefined) return known;
    if (visiting.has(wireId)) return 0;
    visiting.add(wireId);
    const defining = definingByWire.get(wireId);
    if (!defining) {
      depth.set(wireId, 0);
      return 0;
    }
    const inputIds = [...linCombWireIds(defining.a), ...linCombWireIds(defining.b)].filter(
      (id) => id !== wireId && wireTypeById.get(id) !== 'one',
    );
    const d = inputIds.length === 0 ? 1 : 1 + Math.max(...inputIds.map((id) => resolveDepth(id, visiting)));
    depth.set(wireId, d);
    return d;
  };
  for (const w of visibleWires) resolveDepth(w.id, new Set());

  // Group wires by layer, position top-to-bottom within each layer.
  const layers = new Map<number, number[]>();
  for (const w of visibleWires) {
    const d = depth.get(w.id) ?? 0;
    const list = layers.get(d);
    if (list) list.push(w.id);
    else layers.set(d, [w.id]);
  }

  const wirePositions = new Map<number, { x: number; y: number }>();
  for (const [layer, ids] of [...layers.entries()].sort(([a], [b]) => a - b)) {
    ids.forEach((wireId, i) => {
      wirePositions.set(wireId, {
        x: PADDING + layer * LAYER_GAP_X * 2,
        y: PADDING + i * NODE_GAP_Y,
      });
    });
  }

  // Constraints sit between their deepest input layer and their output.
  const constraintPositions = new Map<number, { x: number; y: number; width: number; height: number }>();
  const edges: TraceGraphLayout['edges'] = [];
  constraints.forEach((c, i) => {
    const inputIds = [...new Set([...linCombWireIds(c.a), ...linCombWireIds(c.b)])].filter((id) =>
      wirePositions.has(id),
    );
    const outputId = definedWireId(c, wireTypeById);
    const inputPositions = inputIds.map((id) => wirePositions.get(id)!);
    const outputPos = outputId !== null ? wirePositions.get(outputId) : undefined;
    const maxInputX = inputPositions.length > 0 ? Math.max(...inputPositions.map((p) => p.x)) : PADDING;
    const x = outputPos ? (maxInputX + outputPos.x) / 2 : maxInputX + LAYER_GAP_X;
    const avgY = inputPositions.length > 0
      ? inputPositions.reduce((sum, p) => sum + p.y, 0) / inputPositions.length
      : PADDING + i * NODE_GAP_Y;
    const pos = {
      x: x - TRACE_CONSTRAINT_WIDTH / 2 + TRACE_WIRE_RADIUS,
      y: (outputPos ? (avgY + outputPos.y) / 2 : avgY) - TRACE_CONSTRAINT_HEIGHT / 2 + TRACE_WIRE_RADIUS,
      width: TRACE_CONSTRAINT_WIDTH,
      height: TRACE_CONSTRAINT_HEIGHT,
    };
    constraintPositions.set(c.id, pos);
    const cCenter = { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
    for (const p of inputPositions) {
      edges.push({ from: { x: p.x + TRACE_WIRE_RADIUS, y: p.y + TRACE_WIRE_RADIUS }, to: cCenter });
    }
    if (outputPos) {
      edges.push({ from: cCenter, to: { x: outputPos.x + TRACE_WIRE_RADIUS, y: outputPos.y + TRACE_WIRE_RADIUS } });
    }
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of wirePositions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + TRACE_WIRE_RADIUS * 2);
    maxY = Math.max(maxY, p.y + TRACE_WIRE_RADIUS * 2);
  }
  for (const p of constraintPositions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }

  return {
    wirePositions,
    constraintPositions,
    edges,
    satisfiedById: resolveSatisfaction(section, field),
    bounds: { minX: minX - PADDING, minY: minY - PADDING, maxX: maxX + PADDING, maxY: maxY + PADDING },
    truncated,
  };
}
