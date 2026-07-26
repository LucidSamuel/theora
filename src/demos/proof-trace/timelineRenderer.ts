import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { ProofTrace } from './schema';
import { TRANSCRIPT_EVENT_TYPES } from './schema';
import { ACCENT, hueRotate } from './renderer';

const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_300 = '#a1a1aa';
const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';

export const LANE_HEIGHT = 32;
export const LANE_GAP = 8;
export const EVENT_SPACING = 24;
const LANE_LABEL_WIDTH = 88;
const TOP_MARGIN = 60;

export interface TimelineViewState {
  trace: ProofTrace | null;
  step: number;
  hueShiftDeg: number;
}

export function timelineBounds(trace: ProofTrace): { minX: number; minY: number; maxX: number; maxY: number } {
  const lanes = TRANSCRIPT_EVENT_TYPES.length;
  return {
    minX: 0,
    minY: TOP_MARGIN - 20,
    maxX: LANE_LABEL_WIDTH + (trace.transcript.length + 1) * EVENT_SPACING + 40,
    maxY: TOP_MARGIN + lanes * (LANE_HEIGHT + LANE_GAP) + 40,
  };
}

export function renderTraceTimeline(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: TimelineViewState,
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

  const { trace, step } = state;
  if (!trace) return;

  const accent = hueRotate(ACCENT, state.hueShiftDeg);
  const laneIndex = new Map(TRANSCRIPT_EVENT_TYPES.map((t, i) => [t, i]));
  const laneY = (i: number) => TOP_MARGIN + i * (LANE_HEIGHT + LANE_GAP);
  const eventX = (i: number) => LANE_LABEL_WIDTH + (i + 1) * EVENT_SPACING;

  // Lanes
  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';
  TRANSCRIPT_EVENT_TYPES.forEach((type, i) => {
    const y = laneY(i);
    ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.35 : 0.6);
    drawRoundedRect(ctx, LANE_LABEL_WIDTH, y, (trace.transcript.length + 1) * EVENT_SPACING + 20, LANE_HEIGHT, 6);
    ctx.fill();
    ctx.fillStyle = hexToRgba(isDark ? ZINC_300 : ZINC_600, 0.85);
    ctx.textAlign = 'right';
    ctx.fillText(type, LANE_LABEL_WIDTH - 8, y + LANE_HEIGHT / 2);
  });

  // Round boundaries
  let lastRound: number | null = null;
  const lanesBottom = laneY(TRANSCRIPT_EVENT_TYPES.length - 1) + LANE_HEIGHT;
  trace.transcript.forEach((event, i) => {
    if (event.round !== lastRound) {
      const x = eventX(i) - EVENT_SPACING / 2;
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, TOP_MARGIN - 18);
      ctx.lineTo(x, lanesBottom + 6);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(isDark ? ZINC_300 : ZINC_600, 0.7);
      ctx.textAlign = 'left';
      ctx.fillText(`r${event.round}`, x + 4, TOP_MARGIN - 26);
      lastRound = event.round;
    }
  });

  // Events
  trace.transcript.forEach((event, i) => {
    const lane = laneIndex.get(event.t) ?? 0;
    const x = eventX(i);
    const y = laneY(lane) + LANE_HEIGHT / 2;
    const future = i > step;
    ctx.globalAlpha = future ? 0.25 : 1;
    const isCheck = event.t === 'check';
    const color = isCheck ? (event.ok === false ? COLOR_ERROR : COLOR_SUCCESS) : null;
    if (isCheck) {
      ctx.fillStyle = hexToRgba(color!, 0.95);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (event.t === 'challenge') {
      ctx.strokeStyle = accent.replace('hsl(', 'hsla(').replace(')', ', 0.9)');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (event.t === 'commit') {
      ctx.fillStyle = hexToRgba(isDark ? '#fafafa' : '#09090b', 0.8);
      drawRoundedRect(ctx, x - 5, y - 5, 10, 10, 2);
      ctx.fill();
    } else {
      ctx.fillStyle = accent.replace('hsl(', 'hsla(').replace(')', ', 0.85)');
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // Step cursor
  if (trace.transcript.length > 0) {
    const cursorX = eventX(Math.min(step, trace.transcript.length - 1));
    ctx.strokeStyle = accent.replace('hsl(', 'hsla(').replace(')', ', 0.85)');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, TOP_MARGIN - 12);
    ctx.lineTo(cursorX, lanesBottom + 12);
    ctx.stroke();
  }

  // Screen-space: current event caption
  const current = trace.transcript[Math.min(step, trace.transcript.length - 1)];
  if (current) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const caption = `${step + 1}/${trace.transcript.length} · ${current.t} · ${current.label}`;
    ctx.font = '11px monospace';
    const w = Math.min(ctx.measureText(caption).width + 32, width - 24);
    ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#e4e4e7', isDark ? 0.85 : 0.9);
    drawRoundedRect(ctx, width / 2 - w / 2, height - 46, w, 30, 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, width / 2 - w / 2, height - 46, w, 30, 8);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.textAlign = 'center';
    ctx.fillText(caption, width / 2, height - 31, w - 16);
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
