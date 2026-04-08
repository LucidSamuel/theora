import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { MLEFunction, MLEEvaluation, PartialEvalResult } from './logic';

/* ── Public render state ─────────────────────────────────────────────── */

export interface MLERenderState {
  mle: MLEFunction;
  evaluation: MLEEvaluation | null;
  partialResult: PartialEvalResult | null;
  attackClaim: bigint | null;
  hypercubeSum: bigint;
  phase: 'viewing' | 'evaluating' | 'partial';
}

/* ── Layout constants ────────────────────────────────────────────────── */

const BOX_SIZE = 100;
const BOX_GAP = 28;
const BOX_RADIUS = 10;
const DEPTH_OFFSET_X = 60;
const DEPTH_OFFSET_Y = 50;

const EVAL_PANEL_W = 240;
const EVAL_PANEL_PAD = 14;
const EVAL_ROW_H = 22;

const PARTIAL_BOX_SIZE = 80;
const PARTIAL_BOX_GAP = 20;

const BADGE_H = 30;
const BADGE_RADIUS = 8;

const SUM_BADGE_H = 28;

/* ── Palette ─────────────────────────────────────────────────────────── */

const ZINC_900 = '#09090b';
const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_500 = '#52525b';
const ZINC_400 = '#71717a';
const ZINC_300 = '#a1a1aa';
const ZINC_100 = '#e4e4e7';
const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';
const ACCENT = '#8b5cf6'; // MLE accent (violet)

/* ── Helpers ─────────────────────────────────────────────────────────── */

function bstr(v: bigint): string {
  return v.toString();
}

function bitsToStr(bits: number[]): string {
  return bits.join('');
}

/**
 * Compute a glow intensity for a basis weight relative to fieldSize.
 * Returns a value in [0.15, 1].
 */
function weightIntensity(weight: bigint, fieldSize: bigint): number {
  const ratio = Number(weight) / Number(fieldSize);
  return 0.15 + 0.85 * Math.min(ratio * 2, 1);
}

/* ── Hypercube vertex box ────────────────────────────────────────────── */

function drawVertexBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  bits: number[],
  value: bigint,
  isDark: boolean,
  t: number,
  basisWeight: bigint | null,
  fieldSize: bigint,
): void {
  // Border color: if evaluating, tint with accent proportional to eq weight
  let borderAlpha = 0.3;
  let borderColor = isDark ? ZINC_600 : ZINC_300;

  if (basisWeight !== null && basisWeight > 0n) {
    const intensity = weightIntensity(basisWeight, fieldSize);
    borderAlpha = 0.4 + 0.6 * intensity;
    borderColor = ACCENT;
    // Subtle pulse on active weights
    borderAlpha += 0.1 * Math.sin(t * 2.5) * intensity;
  }

  // Background
  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.6 : 0.85);
  drawRoundedRect(ctx, x, y, size, size, BOX_RADIUS);
  ctx.fill();

  // Border
  ctx.strokeStyle = hexToRgba(borderColor, Math.min(borderAlpha, 1));
  ctx.lineWidth = basisWeight !== null && basisWeight > 0n ? 2 : 1;
  drawRoundedRect(ctx, x, y, size, size, BOX_RADIUS);
  ctx.stroke();

  // Bit label centered near top
  ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bitsToStr(bits), x + size / 2, y + 22);

  // Value centered
  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bstr(value), x + size / 2, y + size / 2 + 4);

  // Basis weight label at bottom if evaluating
  if (basisWeight !== null) {
    // Ensure minimum alpha of 0.55 so small weights remain readable
    const textAlpha = Math.max(0.55, weightIntensity(basisWeight, fieldSize));
    ctx.fillStyle = hexToRgba(ACCENT, textAlpha);
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`eq=${bstr(basisWeight)}`, x + size / 2, y + size - 14);
  }
}

/* ── Hypercube layout computation ────────────────────────────────────── */

interface VertexLayout {
  x: number;
  y: number;
  index: number;
}

function computeHypercubeLayout(
  numVars: number,
  centerX: number,
  centerY: number,
): VertexLayout[] {
  const layouts: VertexLayout[] = [];
  const count = 1 << numVars;

  if (numVars === 1) {
    // Two boxes side by side
    const totalW = 2 * BOX_SIZE + BOX_GAP;
    const startX = centerX - totalW / 2;
    const startY = centerY - BOX_SIZE / 2;
    for (let i = 0; i < 2; i++) {
      layouts.push({
        x: startX + i * (BOX_SIZE + BOX_GAP),
        y: startY,
        index: i,
      });
    }
  } else if (numVars === 2) {
    // 2x2 grid
    const totalW = 2 * BOX_SIZE + BOX_GAP;
    const totalH = 2 * BOX_SIZE + BOX_GAP;
    const startX = centerX - totalW / 2;
    const startY = centerY - totalH / 2;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      layouts.push({
        x: startX + col * (BOX_SIZE + BOX_GAP),
        y: startY + row * (BOX_SIZE + BOX_GAP),
        index: i,
      });
    }
  } else if (numVars === 3) {
    // Two 2x2 grids side by side with depth offset (front and back face)
    // Front face: indices 0-3 (first bit = 0)
    // Back face: indices 4-7 (first bit = 1)
    const gridW = 2 * BOX_SIZE + BOX_GAP;
    const gridH = 2 * BOX_SIZE + BOX_GAP;
    const totalW = gridW + DEPTH_OFFSET_X + 30;
    const startX = centerX - totalW / 2;
    const startY = centerY - gridH / 2 + DEPTH_OFFSET_Y / 2;

    // Front face (bit 0 = 0)
    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      layouts.push({
        x: startX + col * (BOX_SIZE + BOX_GAP),
        y: startY + row * (BOX_SIZE + BOX_GAP),
        index: i,
      });
    }
    // Back face (bit 0 = 1), offset to upper-right
    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      layouts.push({
        x: startX + col * (BOX_SIZE + BOX_GAP) + DEPTH_OFFSET_X,
        y: startY + row * (BOX_SIZE + BOX_GAP) - DEPTH_OFFSET_Y,
        index: i + 4,
      });
    }
  }

  return layouts;
}

/* ── Depth lines for n=3 ─────────────────────────────────────────────── */

function drawDepthLines(
  ctx: CanvasRenderingContext2D,
  layouts: VertexLayout[],
  isDark: boolean,
): void {
  if (layouts.length !== 8) return;

  ctx.strokeStyle = hexToRgba(isDark ? ZINC_500 : ZINC_400, 0.3);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  // Connect front face to back face (index i -> index i+4)
  for (let i = 0; i < 4; i++) {
    const front = layouts[i]!;
    const back = layouts[i + 4]!;
    ctx.beginPath();
    ctx.moveTo(front.x + BOX_SIZE / 2, front.y + BOX_SIZE / 2);
    ctx.lineTo(back.x + BOX_SIZE / 2, back.y + BOX_SIZE / 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

/* ── Evaluation panel ────────────────────────────────────────────────── */

function drawEvalPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  evaluation: MLEEvaluation,
  mle: MLEFunction,
  attackClaim: bigint | null,
  isDark: boolean,
): void {
  const termCount = evaluation.basisTerms.length;
  const headerH = 36;
  const attackSectionH = attackClaim !== null ? 76 : 0;
  const panelH = headerH + termCount * EVAL_ROW_H + 44 + attackSectionH;

  // Panel background
  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.7 : 0.9);
  drawRoundedRect(ctx, x, y, EVAL_PANEL_W, panelH, BOX_RADIUS);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(ACCENT, 0.4);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, EVAL_PANEL_W, panelH, BOX_RADIUS);
  ctx.stroke();

  // Header
  const pointStr = `r = (${evaluation.point.map(bstr).join(', ')})`;
  ctx.fillStyle = hexToRgba(ACCENT, 0.15);
  ctx.beginPath();
  ctx.moveTo(x + BOX_RADIUS, y);
  ctx.lineTo(x + EVAL_PANEL_W - BOX_RADIUS, y);
  ctx.quadraticCurveTo(x + EVAL_PANEL_W, y, x + EVAL_PANEL_W, y + BOX_RADIUS);
  ctx.lineTo(x + EVAL_PANEL_W, y + headerH);
  ctx.lineTo(x, y + headerH);
  ctx.lineTo(x, y + BOX_RADIUS);
  ctx.quadraticCurveTo(x, y, x + BOX_RADIUS, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Evaluation', x + EVAL_PANEL_PAD, y + headerH / 2 - 6);

  ctx.fillStyle = hexToRgba(ACCENT, 0.85);
  ctx.font = '10px monospace';
  ctx.fillText(pointStr, x + EVAL_PANEL_PAD, y + headerH / 2 + 8);

  // Basis terms
  let rowY = y + headerH + 4;
  for (let i = 0; i < termCount; i++) {
    const term = evaluation.basisTerms[i]!;
    const fVal = mle.evaluations[i]!.value;
    const contribution = (fVal * term.weight) % mle.fieldSize;

    // Label: eq(r, v)
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${bitsToStr(term.vertex)}: ${bstr(fVal)}*${bstr(term.weight)}`,
      x + EVAL_PANEL_PAD,
      rowY + EVAL_ROW_H / 2,
    );

    // Contribution value
    ctx.fillStyle = hexToRgba(ACCENT, weightIntensity(term.weight, mle.fieldSize));
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `= ${bstr(contribution)}`,
      x + EVAL_PANEL_W - EVAL_PANEL_PAD,
      rowY + EVAL_ROW_H / 2,
    );

    rowY += EVAL_ROW_H;
  }

  // Divider
  ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x + 10, rowY + 4);
  ctx.lineTo(x + EVAL_PANEL_W - 10, rowY + 4);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sum = f~(r)
  rowY += 12;
  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('f\u0303(r)', x + EVAL_PANEL_PAD, rowY + EVAL_ROW_H / 2);

  ctx.fillStyle = COLOR_SUCCESS;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    bstr(evaluation.value),
    x + EVAL_PANEL_W - EVAL_PANEL_PAD,
    rowY + EVAL_ROW_H / 2,
  );

  if (attackClaim !== null) {
    const accepted = attackClaim === evaluation.value;
    rowY += EVAL_ROW_H + 10;

    ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x + 10, rowY);
    ctx.lineTo(x + EVAL_PANEL_W - 10, rowY);
    ctx.stroke();
    ctx.setLineDash([]);

    rowY += 14;

    ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('claimed', x + EVAL_PANEL_PAD, rowY + EVAL_ROW_H / 2);

    ctx.fillStyle = hexToRgba(COLOR_ERROR, 0.92);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      bstr(attackClaim),
      x + EVAL_PANEL_W - EVAL_PANEL_PAD,
      rowY + EVAL_ROW_H / 2,
    );

    rowY += EVAL_ROW_H;

    ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('verifier', x + EVAL_PANEL_PAD, rowY + EVAL_ROW_H / 2);

    ctx.fillStyle = hexToRgba(COLOR_SUCCESS, 0.95);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      bstr(evaluation.value),
      x + EVAL_PANEL_W - EVAL_PANEL_PAD,
      rowY + EVAL_ROW_H / 2,
    );

    rowY += EVAL_ROW_H + 2;

    ctx.fillStyle = hexToRgba(accepted ? COLOR_SUCCESS : COLOR_ERROR, isDark ? 0.16 : 0.12);
    drawRoundedRect(ctx, x + EVAL_PANEL_PAD, rowY, EVAL_PANEL_W - EVAL_PANEL_PAD * 2, 24, 6);
    ctx.fill();

    ctx.fillStyle = accepted ? COLOR_SUCCESS : COLOR_ERROR;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      accepted ? 'ACCEPTED' : 'REJECTED',
      x + EVAL_PANEL_W / 2,
      rowY + 12,
    );
  }
}

/* ── Partial evaluation strip ────────────────────────────────────────── */

function drawPartialStrip(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  result: PartialEvalResult,
  isDark: boolean,
): void {
  const count = result.evaluations.length;
  if (count === 0) return;

  const totalW = count * PARTIAL_BOX_SIZE + (count - 1) * PARTIAL_BOX_GAP;
  const startX = centerX - totalW / 2;

  // Label
  const fixedStr = result.fixedVars.map(bstr).join(', ');
  ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `Partial eval: fixed (${fixedStr}) \u2014 ${result.remainingVars} var${result.remainingVars !== 1 ? 's' : ''} remain`,
    centerX,
    y - 14,
  );

  for (let i = 0; i < count; i++) {
    const pt = result.evaluations[i]!;
    const bx = startX + i * (PARTIAL_BOX_SIZE + PARTIAL_BOX_GAP);

    ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.55 : 0.85);
    drawRoundedRect(ctx, bx, y, PARTIAL_BOX_SIZE, PARTIAL_BOX_SIZE, 8);
    ctx.fill();

    ctx.strokeStyle = hexToRgba(ACCENT, 0.35);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, bx, y, PARTIAL_BOX_SIZE, PARTIAL_BOX_SIZE, 8);
    ctx.stroke();

    // Bit label
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bitsToStr(pt.bits), bx + PARTIAL_BOX_SIZE / 2, y + 18);

    // Value
    ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bstr(pt.value), bx + PARTIAL_BOX_SIZE / 2, y + PARTIAL_BOX_SIZE / 2 + 6);
  }
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderMLE(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: MLERenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height, time } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';
  const n = state.mle.numVars;
  const p = state.mle.fieldSize;

  // ── Background ────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  bg.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = bg;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.65,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)');

  // ── Compute layout ────────────────────────────────────────────────
  const hasPartial = state.phase === 'partial' && state.partialResult !== null;
  const hasEval = state.phase === 'evaluating' && state.evaluation !== null;

  // Shift hypercube left if evaluation panel is shown
  const cubeOffsetX = hasEval ? -EVAL_PANEL_W / 2 - 20 : 0;
  const cubeOffsetY = hasPartial ? -60 : 0;
  const cubeCenterX = width / 2 + cubeOffsetX;
  const cubeCenterY = height / 2 + cubeOffsetY;

  const layouts = computeHypercubeLayout(n, cubeCenterX, cubeCenterY);

  // ── Depth lines for n=3 ───────────────────────────────────────────
  if (n === 3) {
    drawDepthLines(ctx, layouts, isDark);
  }

  // ── Draw vertex boxes ─────────────────────────────────────────────
  for (const layout of layouts) {
    const pt = state.mle.evaluations[layout.index]!;
    const basisWeight = state.evaluation?.basisTerms[layout.index]?.weight ?? null;
    drawVertexBox(
      ctx,
      layout.x,
      layout.y,
      BOX_SIZE,
      pt.bits,
      pt.value,
      isDark,
      time,
      state.phase === 'evaluating' ? basisWeight : null,
      p,
    );
  }

  // ── Evaluation panel ──────────────────────────────────────────────
  if (hasEval && state.evaluation) {
    // Position to the right of the hypercube
    const rightMost = Math.max(...layouts.map(l => l.x + BOX_SIZE));
    const evalPanelX = rightMost + 40;
    const evalPanelY = cubeCenterY - 100;
    drawEvalPanel(ctx, evalPanelX, evalPanelY, state.evaluation, state.mle, state.attackClaim, isDark);
  }

  // ── Partial evaluation strip ──────────────────────────────────────
  if (hasPartial && state.partialResult) {
    const bottomMost = Math.max(...layouts.map(l => l.y + BOX_SIZE));
    const stripY = bottomMost + 50;
    drawPartialStrip(ctx, width / 2, stripY, state.partialResult, isDark);
  }

  // ── Screen-space overlays ─────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Header badge ──────────────────────────────────────────────────
  const headerText = `MLE \u2014 ${n} variable${n !== 1 ? 's' : ''}, ${1 << n} points, GF(${bstr(p)})`;
  ctx.font = '11px monospace';
  const maxBadgeW = Math.max(1, width - (width > 320 ? 180 : 24));
  const headerW = Math.min(ctx.measureText(headerText).width + 40, maxBadgeW);
  const headerX = width / 2 - headerW / 2;
  const headerY = 16;

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#e4e4e7', isDark ? 0.85 : 0.9);
  drawRoundedRect(ctx, headerX, headerY, headerW, BADGE_H, BADGE_RADIUS);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, headerX, headerY, headerW, BADGE_H, BADGE_RADIUS);
  ctx.stroke();

  ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headerText, width / 2, headerY + BADGE_H / 2, Math.max(1, headerW - 24));

  // ── Sum badge ─────────────────────────────────────────────────────
  const sumText = `\u03A3 f = ${bstr(state.hypercubeSum)}`;
  ctx.font = '11px monospace';
  const sumW = ctx.measureText(sumText).width + 32;
  const sumX = width / 2 - sumW / 2;
  const sumY = height - SUM_BADGE_H - 16;

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#e4e4e7', isDark ? 0.8 : 0.85);
  drawRoundedRect(ctx, sumX, sumY, sumW, SUM_BADGE_H, BADGE_RADIUS);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.4);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, sumX, sumY, sumW, SUM_BADGE_H, BADGE_RADIUS);
  ctx.stroke();

  ctx.fillStyle = hexToRgba(COLOR_SUCCESS, 0.9);
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sumText, width / 2, sumY + SUM_BADGE_H / 2);

  // ── Phase indicator ───────────────────────────────────────────────
  if (state.phase !== 'viewing') {
    const phaseLabel = state.phase === 'evaluating' ? 'Evaluating at point' : 'Partial evaluation';
    ctx.fillStyle = hexToRgba(ACCENT, 0.8);
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phaseLabel, width / 2, headerY + BADGE_H + 12);
  }

  ctx.restore();
}
