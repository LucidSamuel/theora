import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import type { BatchOpeningResult } from './batchOpening';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';

/* ── Types ───────────────────────────────────────────────────────────── */

export interface BatchRenderState {
  polynomials: bigint[][];
  evalPoint: bigint;
  gamma: bigint;
  result: BatchOpeningResult | null;
  fieldSize: bigint;
  activeStep: number; // 0..3 for highlighting which step is active
}

/* ── Layout constants ────────────────────────────────────────────────── */

const BOX_W = 200;
const BOX_H = 36;
const BOX_RADIUS = 6;
const CARD_W = 220;
const CARD_RADIUS = 8;
const CARD_PAD = 14;
const COL_GAP = 60;
const ARROW_HEAD = 6;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function bigStr(v: bigint): string {
  return v.toString();
}

function drawValueBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  isDark: boolean,
  highlight = false,
): void {
  const bgAlpha = highlight ? 0.7 : 0.5;
  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', bgAlpha);
  drawRoundedRect(ctx, x, y, w, BOX_H, BOX_RADIUS);
  ctx.fill();

  const borderColor = highlight
    ? (isDark ? '#52525b' : '#71717a')
    : (isDark ? '#3f3f46' : '#a1a1aa');
  ctx.strokeStyle = hexToRgba(borderColor, highlight ? 0.8 : 0.5);
  ctx.lineWidth = highlight ? 1.5 : 1;
  drawRoundedRect(ctx, x, y, w, BOX_H, BOX_RADIUS);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 10, y + BOX_H / 2);

  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w - 10, y + BOX_H / 2);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * ARROW_HEAD, y2 - uy * ARROW_HEAD);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * ARROW_HEAD * 2 - uy * ARROW_HEAD, y2 - uy * ARROW_HEAD * 2 + ux * ARROW_HEAD);
  ctx.lineTo(x2 - ux * ARROW_HEAD * 2 + uy * ARROW_HEAD, y2 - uy * ARROW_HEAD * 2 - ux * ARROW_HEAD);
  ctx.closePath();
  ctx.fill();
}

function formatCoeffs(poly: bigint[]): string {
  if (poly.length === 0) return '0';
  const parts: string[] = [];
  for (let i = poly.length - 1; i >= 0; i--) {
    if (poly[i] === 0n) continue;
    const coeff = poly[i]!;
    if (i === 0) {
      parts.push(coeff.toString());
    } else if (i === 1) {
      parts.push(coeff === 1n ? 'x' : `${coeff}x`);
    } else {
      parts.push(coeff === 1n ? `x^${i}` : `${coeff}x^${i}`);
    }
  }
  return parts.length > 0 ? parts.join(' + ') : '0';
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  isDark: boolean,
  highlight: boolean,
): void {
  ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#f4f4f5', highlight ? 0.95 : 0.7);
  drawRoundedRect(ctx, x, y, w, h, CARD_RADIUS);
  ctx.fill();

  const borderColor = highlight
    ? (isDark ? '#52525b' : '#a1a1aa')
    : (isDark ? '#27272a' : '#d4d4d8');
  ctx.strokeStyle = hexToRgba(borderColor, highlight ? 0.8 : 0.5);
  ctx.lineWidth = highlight ? 2 : 1;
  drawRoundedRect(ctx, x, y, w, h, CARD_RADIUS);
  ctx.stroke();

  // Title
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, x + CARD_PAD, y + 18);
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderBatch(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: BatchRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ──────────────────────────────────────────────────────
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
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Screen-space overlay (badge + status) ─────────────────────────
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Top badge
  const badgeText = `Batch Opening \u2014 k=${state.polynomials.length}, z=${bigStr(state.evalPoint)}, \u03b3=${bigStr(state.gamma)}, GF(${bigStr(state.fieldSize)})`;
  ctx.font = 'bold 12px monospace';
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = badgeMetrics.width + 32;
  const badgeH = 32;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 20;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#f4f4f5', 0.9);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, badgeY + badgeH / 2);

  // Consistency badge (bottom right)
  if (state.result) {
    const statusText = state.result.consistent ? 'CONSISTENT' : 'INCONSISTENT';
    const statusColor = state.result.consistent ? '#10b981' : '#ef4444';
    const statusW = 160;
    const statusH = 32;
    const statusX = width - statusW - 20;
    const statusY = height - statusH - 20;

    drawRoundedRect(ctx, statusX, statusY, statusW, statusH, 6);
    ctx.fillStyle = hexToRgba(statusColor, 0.15);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(statusColor, 0.6);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, statusX, statusY, statusW, statusH, 6);
    ctx.stroke();

    ctx.fillStyle = statusColor;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, statusX + statusW / 2, statusY + statusH / 2);
  }

  ctx.restore();

  // ── Layout columns ────────────────────────────────────────────────
  // Col 1: Polynomial boxes
  // Col 2: Combine (merge arrow + weights)
  // Col 3: h(x) combined poly
  // Col 4: q(x) quotient
  // Col 5: consistency check

  const k = state.polynomials.length;
  const polyCardH = CARD_PAD + 22 + k * (BOX_H + 6) + 10;
  const contentStartY = 80;

  // Column X positions
  const col1X = Math.max(40, (width - (CARD_W * 4 + COL_GAP * 3 + 60)) / 2);
  const col2X = col1X + CARD_W + COL_GAP;
  const col3X = col2X + CARD_W + COL_GAP;
  const col4X = col3X + CARD_W + COL_GAP;

  const arrowColor = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.5);

  // ── Column 1: Individual polynomials ──────────────────────────────
  const polyBoxes: { x: number; y: number; midY: number }[] = [];
  const col1CardH = polyCardH;
  const isStep0 = state.activeStep === 0;
  drawCard(ctx, col1X, contentStartY, CARD_W, col1CardH, 'POLYNOMIALS', isDark, isStep0);

  for (let i = 0; i < k; i++) {
    const poly = state.polynomials[i]!;
    const boxY = contentStartY + 28 + i * (BOX_H + 6);
    const coeffStr = formatCoeffs(poly);
    const label = `f${i + 1}(x)`;
    let value = coeffStr.length > 14 ? coeffStr.slice(0, 14) + '..' : coeffStr;
    if (state.result) {
      value = `= ${bigStr(state.result.individualEvals[i]!)} at z`;
    }
    drawValueBox(ctx, col1X + CARD_PAD, boxY, BOX_W - 10, label, value, isDark, isStep0);
    polyBoxes.push({ x: col1X + CARD_W, y: boxY, midY: boxY + BOX_H / 2 });
  }

  // ── Column 2: Combined polynomial h(x) ───────────────────────────
  const isStep1 = state.activeStep === 1;
  const col2CardH = 28 + BOX_H + 6 + BOX_H + 10 + (state.result ? BOX_H + 6 : 0);
  drawCard(ctx, col2X, contentStartY, CARD_W, col2CardH, 'COMBINE h(x)', isDark, isStep1);

  // Show gamma weight info
  const gammaInfoY = contentStartY + 28;
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`h(x) = \u03a3 \u03b3\u2071 \u00b7 f\u1d62(x)`, col2X + CARD_PAD, gammaInfoY + BOX_H / 2);

  if (state.result) {
    const combinedStr = formatCoeffs(state.result.combinedPoly);
    const displayCombined = combinedStr.length > 16 ? combinedStr.slice(0, 16) + '..' : combinedStr;
    drawValueBox(ctx, col2X + CARD_PAD, gammaInfoY + BOX_H + 6, BOX_W - 10, 'h(x)', displayCombined, isDark, isStep1);
    drawValueBox(ctx, col2X + CARD_PAD, gammaInfoY + 2 * (BOX_H + 6), BOX_W - 10, 'h(z)', bigStr(state.result.combinedEval), isDark, isStep1);
  }

  // Arrows from poly column to combine column
  const combineMidY = contentStartY + col2CardH / 2;
  for (const box of polyBoxes) {
    drawArrow(ctx, box.x + 4, box.midY, col2X - 4, combineMidY, arrowColor);
  }

  // gamma weight labels on arrows
  for (let i = 0; i < polyBoxes.length; i++) {
    const box = polyBoxes[i]!;
    const midX = (box.x + col2X) / 2;
    const midY = (box.midY + combineMidY) / 2 - 8;
    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`\u03b3^${i}`, midX, midY);
  }

  // ── Column 3: Consistency check ───────────────────────────────────
  const isStep2 = state.activeStep === 2;
  const col3CardH = 28 + BOX_H + 6 + BOX_H + 10;
  drawCard(ctx, col3X, contentStartY, CARD_W, col3CardH, 'CONSISTENCY', isDark, isStep2);

  if (state.result) {
    drawValueBox(ctx, col3X + CARD_PAD, contentStartY + 28, BOX_W - 10, 'h(z)', bigStr(state.result.combinedEval), isDark, isStep2);
    drawValueBox(ctx, col3X + CARD_PAD, contentStartY + 28 + BOX_H + 6, BOX_W - 10, '\u03a3\u03b3\u2071f\u1d62(z)', bigStr(state.result.combinedEvalCheck), isDark, isStep2);

    // Match indicator
    const matchY = contentStartY + 28 + 2 * (BOX_H + 6) + 4;
    const matchColor = state.result.consistent ? '#10b981' : '#ef4444';
    ctx.fillStyle = matchColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      state.result.consistent ? 'MATCH' : 'MISMATCH',
      col3X + CARD_W / 2,
      matchY,
    );
  } else {
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Run to check', col3X + CARD_W / 2, contentStartY + 28 + BOX_H / 2);
  }

  // Arrow from combine to consistency
  drawArrow(ctx, col2X + CARD_W + 4, contentStartY + col2CardH / 2, col3X - 4, contentStartY + col3CardH / 2, arrowColor);

  // ── Column 4: Quotient polynomial ─────────────────────────────────
  const isStep3 = state.activeStep === 3;
  const col4CardH = 28 + BOX_H + 6 + BOX_H + 10;
  drawCard(ctx, col4X, contentStartY, CARD_W, col4CardH, 'QUOTIENT q(x)', isDark, isStep3);

  if (state.result) {
    const quotStr = formatCoeffs(state.result.quotientPoly);
    const displayQuot = quotStr.length > 16 ? quotStr.slice(0, 16) + '..' : quotStr;
    drawValueBox(ctx, col4X + CARD_PAD, contentStartY + 28, BOX_W - 10, 'q(x)', displayQuot, isDark, isStep3);

    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('(h(x) \u2212 h(z)) / (x \u2212 z)', col4X + CARD_PAD, contentStartY + 28 + BOX_H + 6 + BOX_H / 2);
  } else {
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Run to compute', col4X + CARD_W / 2, contentStartY + 28 + BOX_H / 2);
  }

  // Arrow from consistency to quotient
  drawArrow(ctx, col3X + CARD_W + 4, contentStartY + col3CardH / 2, col4X - 4, contentStartY + col4CardH / 2, arrowColor);

  // ── Steps summary (below cards) ───────────────────────────────────
  if (state.result) {
    const stepsY = contentStartY + Math.max(polyCardH, col2CardH, col3CardH, col4CardH) + 30;
    const stepsCardW = Math.min(width - 80, col4X + CARD_W - col1X);
    const stepLineH = 24;
    const stepsCardH = 28 + state.result.steps.length * stepLineH + 10;

    drawCard(ctx, col1X, stepsY, stepsCardW, stepsCardH, 'STEPS', isDark, false);

    for (let i = 0; i < state.result.steps.length; i++) {
      const step = state.result.steps[i]!;
      const lineY = stepsY + 28 + i * stepLineH;
      const isActiveStep = state.activeStep === i;

      // Step number
      ctx.fillStyle = isActiveStep
        ? (isDark ? '#e4e4e7' : '#27272a')
        : (isDark ? '#71717a' : '#a1a1aa');
      ctx.font = isActiveStep ? 'bold 11px monospace' : '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}. ${step.stepName}`, col1X + CARD_PAD, lineY + stepLineH / 2);

      // Description
      ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(step.description, col1X + CARD_PAD + 240, lineY + stepLineH / 2);
    }
  }
}
