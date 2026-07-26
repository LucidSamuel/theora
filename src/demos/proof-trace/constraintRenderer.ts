import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { ConstraintSection } from './schema';
import type { TraceGraphLayout } from './constraintLayout';
import { TRACE_WIRE_RADIUS } from './constraintLayout';
import { ACCENT, hueRotate } from './renderer';

const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_300 = '#a1a1aa';
const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';

export interface ConstraintViewState {
  section: ConstraintSection | null;
  layout: TraceGraphLayout | null;
  hueShiftDeg: number;
}

export function renderTraceConstraints(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: ConstraintViewState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  bg.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = bg;
  ctx.fillRect(-50000, -50000, 100000, 100000);
  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)');

  const { section, layout } = state;
  if (!section || !layout) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = hexToRgba(isDark ? ZINC_300 : ZINC_600, 0.7);
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('This trace has no constraint section.', width / 2, height / 2);
    ctx.restore();
    ctx.textAlign = 'left';
    return;
  }

  const accent = hueRotate(ACCENT, state.hueShiftDeg);
  const wireById = new Map(section.wires.map((w) => [w.id, w]));
  const witness = section.witness ?? {};

  ctx.lineWidth = 1;
  for (const edge of layout.edges) {
    ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.4);
    ctx.beginPath();
    ctx.moveTo(edge.from.x, edge.from.y);
    ctx.lineTo(edge.to.x, edge.to.y);
    ctx.stroke();
  }

  for (const [constraintId, pos] of layout.constraintPositions.entries()) {
    const satisfied = layout.satisfiedById.get(constraintId);
    const constraint = section.constraints.find((c) => c.id === constraintId);
    const borderColor = satisfied === false ? COLOR_ERROR : satisfied === true ? COLOR_SUCCESS : isDark ? ZINC_600 : ZINC_300;
    if (satisfied === false) {
      ctx.fillStyle = hexToRgba(COLOR_ERROR, 0.12);
      drawRoundedRect(ctx, pos.x - 4, pos.y - 4, pos.width + 8, pos.height + 8, 10);
      ctx.fill();
    }
    ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.75 : 0.9);
    drawRoundedRect(ctx, pos.x, pos.y, pos.width, pos.height, 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(borderColor, 0.8);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, pos.x, pos.y, pos.width, pos.height, 8);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = constraint?.label ?? `constraint ${constraintId}`;
    ctx.fillText(label.length > 22 ? `${label.slice(0, 21)}…` : label, pos.x + pos.width / 2, pos.y + pos.height / 2 - 7, pos.width - 12);
    ctx.fillStyle = hexToRgba(satisfied === false ? COLOR_ERROR : satisfied === true ? COLOR_SUCCESS : isDark ? ZINC_300 : ZINC_600, 0.9);
    ctx.fillText(satisfied === false ? 'FAILED' : satisfied === true ? 'satisfied' : 'unchecked', pos.x + pos.width / 2, pos.y + pos.height / 2 + 9);
  }

  for (const [wireId, pos] of layout.wirePositions.entries()) {
    const wire = wireById.get(wireId);
    const cx = pos.x + TRACE_WIRE_RADIUS;
    const cy = pos.y + TRACE_WIRE_RADIUS;
    const isIo = wire?.type === 'input' || wire?.type === 'public';
    ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.85 : 0.95);
    ctx.beginPath();
    ctx.arc(cx, cy, TRACE_WIRE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isIo ? accent.replace('hsl(', 'hsla(').replace(')', ', 0.8)') : hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, TRACE_WIRE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = wire?.name ?? String(wireId);
    ctx.fillText(name.length > 7 ? `${name.slice(0, 6)}…` : name, cx, cy - 6, TRACE_WIRE_RADIUS * 2 - 8);
    const value = witness[String(wireId)];
    if (value !== undefined) {
      ctx.fillStyle = hexToRgba(isDark ? ZINC_300 : ZINC_600, 0.9);
      ctx.fillText(value.length > 7 ? `${value.slice(0, 6)}…` : value, cx, cy + 8, TRACE_WIRE_RADIUS * 2 - 8);
    }
  }

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (layout.truncated) {
    ctx.fillStyle = hexToRgba(COLOR_ERROR, 0.85);
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Graph truncated to 500 nodes', width / 2, height - 16);
  }
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
