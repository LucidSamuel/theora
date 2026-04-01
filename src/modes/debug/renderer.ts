import type { CompilationResult, WitnessResult, CheckResult, FailureTrace } from './dsl/types';
import type { GraphLayout } from './layout';
import { WIRE_RADIUS } from './layout';
import type { FrameInfo } from '@/components/shared/AnimatedCanvas';

export interface DebugRenderState {
  compilation: CompilationResult;
  witness: WitnessResult;
  checks: CheckResult;
  failureTrace: FailureTrace | null;
  selectedWire: number | null;
  selectedConstraint: number | null;
  hoveredElement: { type: 'wire' | 'constraint'; id: number } | null;
  layout: GraphLayout;
}

const COLORS = {
  wireInput: '#5588cc',
  wirePublic: '#44aa66',
  wireIntermediate: '#888888',
  wireFailed: '#cc4444',
  wireUnconstrained: '#cc8844',
  constraintOk: '#2d6b3f',
  constraintOkBg: 'rgba(45, 107, 63, 0.15)',
  constraintFailed: '#cc4444',
  constraintFailedBg: 'rgba(204, 68, 68, 0.15)',
  edge: '#555555',
  edgeFailed: '#cc4444',
  text: '#d4d4d8',
  textDim: '#71717a',
  bg: '#18181b',
};

const COLORS_LIGHT = {
  wireInput: '#3366aa',
  wirePublic: '#228844',
  wireIntermediate: '#666666',
  wireFailed: '#cc3333',
  wireUnconstrained: '#cc7722',
  constraintOk: '#228844',
  constraintOkBg: 'rgba(34, 136, 68, 0.12)',
  constraintFailed: '#cc3333',
  constraintFailedBg: 'rgba(204, 51, 51, 0.12)',
  edge: '#999999',
  edgeFailed: '#cc3333',
  text: '#27272a',
  textDim: '#a1a1aa',
  bg: '#ffffff',
};

export function renderDebugGraph(
  ctx: CanvasRenderingContext2D,
  _frame: FrameInfo,
  state: DebugRenderState,
  theme: 'dark' | 'light',
): void {
  const c = theme === 'dark' ? COLORS : COLORS_LIGHT;
  const { layout, checks, failureTrace, selectedWire, selectedConstraint, hoveredElement } = state;

  // Track which wires/constraints are on the failure trace
  const failedWireIds = new Set<number>();
  const failedConstraintIds = new Set<number>();
  if (failureTrace) {
    for (const node of failureTrace.traceBack) failedWireIds.add(node.wireId);
    failedConstraintIds.add(failureTrace.failedConstraint.constraintId);
  }

  // Check status map
  const constraintSatisfied = new Map<number, boolean>();
  for (const check of checks.checks) {
    constraintSatisfied.set(check.constraintId, check.satisfied);
  }

  // --- Draw edges ---
  for (const edge of layout.edges) {
    const isFailed = failedWireIds.has(edge.wireId) || failedConstraintIds.has(edge.constraintId);
    ctx.beginPath();
    ctx.moveTo(edge.from.x, edge.from.y);

    // Bezier curve
    const midX = (edge.from.x + edge.to.x) / 2;
    ctx.bezierCurveTo(midX, edge.from.y, midX, edge.to.y, edge.to.x, edge.to.y);

    ctx.strokeStyle = isFailed ? c.edgeFailed : c.edge;
    ctx.lineWidth = isFailed ? 2 : 1;
    ctx.globalAlpha = failureTrace && !isFailed ? 0.25 : 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Arrowhead
    const angle = Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x);
    const arrowLen = 8;
    ctx.beginPath();
    ctx.moveTo(edge.to.x, edge.to.y);
    ctx.lineTo(
      edge.to.x - arrowLen * Math.cos(angle - 0.3),
      edge.to.y - arrowLen * Math.sin(angle - 0.3),
    );
    ctx.lineTo(
      edge.to.x - arrowLen * Math.cos(angle + 0.3),
      edge.to.y - arrowLen * Math.sin(angle + 0.3),
    );
    ctx.closePath();
    ctx.fillStyle = isFailed ? c.edgeFailed : c.edge;
    ctx.globalAlpha = failureTrace && !isFailed ? 0.25 : 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --- Draw constraint boxes ---
  for (const [constraintId, pos] of layout.constraintPositions) {
    const satisfied = constraintSatisfied.get(constraintId) ?? true;
    const isFailed = failedConstraintIds.has(constraintId);
    const isSelected = selectedConstraint === constraintId;
    const isHovered = hoveredElement?.type === 'constraint' && hoveredElement.id === constraintId;
    const dimmed = failureTrace && !isFailed && !satisfied;

    const x = pos.x - pos.width / 2;
    const y = pos.y - pos.height / 2;

    ctx.globalAlpha = dimmed ? 0.3 : 1;

    // Background
    ctx.fillStyle = satisfied ? c.constraintOkBg : c.constraintFailedBg;
    ctx.beginPath();
    roundRect(ctx, x, y, pos.width, pos.height, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = satisfied ? c.constraintOk : c.constraintFailed;
    ctx.lineWidth = isSelected || isHovered ? 2.5 : 1.5;
    ctx.stroke();

    // Label
    const constraint = state.compilation.constraints.find((c) => c.id === constraintId);
    if (constraint) {
      ctx.fillStyle = satisfied ? c.constraintOk : c.constraintFailed;
      ctx.font = '11px var(--font-mono, monospace)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = constraint.sourceExpr.length > 22
        ? constraint.sourceExpr.slice(0, 20) + '...'
        : constraint.sourceExpr;
      ctx.fillText(label, pos.x, pos.y - 6);

      // Status
      ctx.font = '9px var(--font-mono, monospace)';
      ctx.fillStyle = c.textDim;
      const statusText = satisfied ? 'satisfied' : 'FAILED';
      ctx.fillText(statusText, pos.x, pos.y + 10);
    }

    ctx.globalAlpha = 1;
  }

  // --- Draw wire nodes ---
  for (const [wireId, pos] of layout.wirePositions) {
    const wire = state.compilation.wires.find((w) => w.id === wireId);
    if (!wire) continue;

    const isFailed = failedWireIds.has(wireId);
    const isSelected = selectedWire === wireId;
    const isHovered = hoveredElement?.type === 'wire' && hoveredElement.id === wireId;
    const dimmed = failureTrace && !isFailed;

    let strokeColor = c.wireIntermediate;
    if (wire.type === 'input') strokeColor = c.wireInput;
    else if (wire.type === 'public') strokeColor = c.wirePublic;
    if (isFailed) strokeColor = c.wireFailed;

    ctx.globalAlpha = dimmed ? 0.3 : 1;

    // Circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, WIRE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = theme === 'dark' ? 'rgba(24, 24, 27, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected || isHovered ? 3 : 1.5;
    ctx.stroke();

    // Wire name
    ctx.fillStyle = c.text;
    ctx.font = 'bold 11px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wire.name, pos.x, pos.y - 6);

    // Wire value
    const value = state.witness.values.get(wireId);
    if (value !== undefined) {
      ctx.fillStyle = c.textDim;
      ctx.font = '10px var(--font-mono, monospace)';
      ctx.fillText(String(value), pos.x, pos.y + 8);
    }

    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Hit test: returns which element (wire or constraint) is at the given canvas coordinates. */
export function hitTest(
  layout: GraphLayout,
  x: number,
  y: number,
): { type: 'wire' | 'constraint'; id: number } | null {
  // Check wires first (smaller targets, priority)
  for (const [wireId, pos] of layout.wirePositions) {
    const dx = x - pos.x;
    const dy = y - pos.y;
    if (dx * dx + dy * dy <= WIRE_RADIUS * WIRE_RADIUS) {
      return { type: 'wire', id: wireId };
    }
  }

  // Check constraints
  for (const [constraintId, pos] of layout.constraintPositions) {
    const halfW = pos.width / 2;
    const halfH = pos.height / 2;
    if (x >= pos.x - halfW && x <= pos.x + halfW && y >= pos.y - halfH && y <= pos.y + halfH) {
      return { type: 'constraint', id: constraintId };
    }
  }

  return null;
}
