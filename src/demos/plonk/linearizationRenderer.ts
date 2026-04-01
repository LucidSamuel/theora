import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { LinearizationResult } from './linearization';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LinearizationRenderState {
  result: LinearizationResult;
  fieldSize: bigint;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const MARGIN_X = 60;
const MARGIN_Y = 72;

const HALF_PAD = 24;

// Term box dimensions
const TERM_BOX_H = 54;
const TERM_BOX_W = 76;
const TERM_GAP = 10;

// Arrow section height (between top/bottom halves)
const ARROW_SECTION_H = 56;

// Consistency check box
const CHECK_BOX_W = 280;
const CHECK_BOX_H = 56;

// ── Helpers ───────────────────────────────────────────────────────────────────

function bigStr(v: bigint): string {
  return v.toString();
}

function drawPlusSep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  isDark: boolean,
): void {
  ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', cx, cy);
}

function drawTermBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  coefficient: string,
  polynomial: string,
  isScalar: boolean,
  isDark: boolean,
): void {
  const borderColor = isScalar
    ? (isDark ? '#818cf8' : '#6366f1')
    : (isDark ? '#52525b' : '#a1a1aa');
  const bgAlpha = isDark ? 0.08 : 0.06;

  // Box background
  ctx.fillStyle = hexToRgba(borderColor, bgAlpha);
  drawRoundedRect(ctx, x, y, TERM_BOX_W, TERM_BOX_H, 7);
  ctx.fill();

  // Box border
  ctx.strokeStyle = hexToRgba(borderColor, isDark ? 0.55 : 0.45);
  ctx.lineWidth = isScalar ? 1.5 : 1;
  drawRoundedRect(ctx, x, y, TERM_BOX_W, TERM_BOX_H, 7);
  ctx.stroke();

  // Coefficient row (top)
  const coeffColor = isScalar
    ? (isDark ? '#a5b4fc' : '#4f46e5')
    : (isDark ? '#a1a1aa' : '#71717a');
  ctx.fillStyle = coeffColor;
  ctx.font = `bold 9px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Clamp coefficient display length
  const coeffDisplay = coefficient.length > 9 ? coefficient.slice(0, 8) + '\u2026' : coefficient;
  ctx.fillText(coeffDisplay, x + TERM_BOX_W / 2, y + 15, TERM_BOX_W - 8);

  // Horizontal divider
  ctx.strokeStyle = hexToRgba(borderColor, isDark ? 0.2 : 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + TERM_BOX_H / 2 - 2);
  ctx.lineTo(x + TERM_BOX_W - 6, y + TERM_BOX_H / 2 - 2);
  ctx.stroke();

  // Polynomial row (bottom)
  const polyColor = isDark ? '#e4e4e7' : '#27272a';
  ctx.fillStyle = polyColor;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(polynomial, x + TERM_BOX_W / 2, y + TERM_BOX_H - 15, TERM_BOX_W - 8);
}

function drawSectionLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  subtitle: string,
  isDark: boolean,
): void {
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, x, y);

  ctx.fillStyle = isDark ? '#3f3f46' : '#d4d4d8';
  ctx.font = '9px monospace';
  ctx.fillText(subtitle, x, y + 14);
}

// ── Degree badge ──────────────────────────────────────────────────────────────

function drawDegreeBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  degree: number,
  label: string,
  isDark: boolean,
): void {
  const text = `${label} deg ${degree}`;
  ctx.font = '9px monospace';
  const tw = ctx.measureText(text).width + 16;
  const bh = 20;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.7 : 0.6);
  drawRoundedRect(ctx, x, y, tw, bh, 4);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, tw, bh, 4);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 8, y + bh / 2);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderLinearization(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: LinearizationRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';
  const { result } = state;

  // ── Background ──────────────────────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
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

  // ── Screen-space badge ───────────────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const badgeText = `Linearization — \u03b6 = ${bigStr(result.challengePoint)}, a(\u03b6)=${bigStr(result.wireEvals.a)}, b(\u03b6)=${bigStr(result.wireEvals.b)}, c(\u03b6)=${bigStr(result.wireEvals.c)}`;
  ctx.font = '11px monospace';
  const bw = ctx.measureText(badgeText).width + 32;
  const bx = width / 2 - bw / 2;
  const by = 16;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.85);
  drawRoundedRect(ctx, bx, by, bw, 30, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, bx, by, bw, 30, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, by + 15);

  ctx.restore();

  // ── Geometry ─────────────────────────────────────────────────────────────────
  const originX = MARGIN_X;
  const originY = MARGIN_Y;

  // Compute term row width: 5 terms + 4 plus separators
  const PLUS_W = 18;
  const termRowW = 5 * TERM_BOX_W + 4 * (TERM_GAP + PLUS_W + TERM_GAP);

  // ── BEFORE section: Full polynomial terms ────────────────────────────────────
  const beforeY = originY;

  drawSectionLabel(
    ctx,
    originX,
    beforeY,
    'Before Linearization — C(x)',
    'selector polynomials \u00d7 wire polynomials (degree ~2(n-1))',
    isDark,
  );

  const beforeTerms = result.fullSteps[0]!.terms;
  const fullDegree = result.fullSteps[0]!.totalDegree;

  let tx = originX;
  const beforeTermY = beforeY + 24;

  beforeTerms.forEach((term, ti) => {
    drawTermBox(ctx, tx, beforeTermY, term.coefficient, term.polynomial, false, isDark);
    if (ti < beforeTerms.length - 1) {
      drawPlusSep(ctx, tx + TERM_BOX_W + TERM_GAP + PLUS_W / 2, beforeTermY + TERM_BOX_H / 2, isDark);
      tx += TERM_BOX_W + TERM_GAP + PLUS_W + TERM_GAP;
    } else {
      tx += TERM_BOX_W;
    }
  });

  // Degree badge to the right of terms
  drawDegreeBadge(ctx, tx + 16, beforeTermY + (TERM_BOX_H - 20) / 2, fullDegree, 'C(x)', isDark);

  // ── Arrow section (center) ───────────────────────────────────────────────────
  const arrowY = beforeY + 24 + TERM_BOX_H + HALF_PAD;
  const arrowCenterX = originX + termRowW / 2;
  const arrowTopY = arrowY;
  const arrowBottomY = arrowY + ARROW_SECTION_H;
  const arrowMidY = (arrowTopY + arrowBottomY) / 2;

  // Vertical arrow line
  ctx.strokeStyle = hexToRgba(isDark ? '#818cf8' : '#6366f1', isDark ? 0.7 : 0.6);
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(arrowCenterX, arrowTopY);
  ctx.lineTo(arrowCenterX, arrowBottomY - 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  const headSz = 8;
  ctx.fillStyle = hexToRgba(isDark ? '#818cf8' : '#6366f1', isDark ? 0.7 : 0.6);
  ctx.beginPath();
  ctx.moveTo(arrowCenterX, arrowBottomY);
  ctx.lineTo(arrowCenterX - headSz / 2, arrowBottomY - headSz);
  ctx.lineTo(arrowCenterX + headSz / 2, arrowBottomY - headSz);
  ctx.closePath();
  ctx.fill();

  // Arrow label
  const arrowLabelText = 'plug in wire evaluations at \u03b6';
  ctx.font = '10px monospace';
  const arrowLabelW = ctx.measureText(arrowLabelText).width + 20;
  const arrowLabelX = arrowCenterX - arrowLabelW / 2;
  const arrowLabelY = arrowMidY - 10;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#f4f4f5', isDark ? 0.85 : 0.9);
  drawRoundedRect(ctx, arrowLabelX, arrowLabelY, arrowLabelW, 20, 4);
  ctx.fill();

  ctx.fillStyle = isDark ? '#818cf8' : '#4f46e5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(arrowLabelText, arrowCenterX, arrowLabelY + 10);

  // Wire evaluation badges flanking the label
  const wireEvals = [
    `a(\u03b6)=${bigStr(result.wireEvals.a)}`,
    `b(\u03b6)=${bigStr(result.wireEvals.b)}`,
    `c(\u03b6)=${bigStr(result.wireEvals.c)}`,
  ];
  const badgeStartX = arrowLabelX - 8 - wireEvals.length * 68;
  wireEvals.forEach((evText, ei) => {
    const evX = badgeStartX + ei * 72;
    const evW = 64;
    const evH = 20;
    ctx.fillStyle = hexToRgba(isDark ? '#312e81' : '#e0e7ff', isDark ? 0.5 : 0.6);
    drawRoundedRect(ctx, evX, arrowLabelY, evW, evH, 4);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(isDark ? '#818cf8' : '#6366f1', 0.4);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, evX, arrowLabelY, evW, evH, 4);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#a5b4fc' : '#4338ca';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(evText, evX + evW / 2, arrowLabelY + evH / 2);
  });

  // ── AFTER section: Linearized polynomial ─────────────────────────────────────
  const afterY = arrowBottomY + HALF_PAD;

  drawSectionLabel(
    ctx,
    originX,
    afterY,
    'After Linearization — r(x)',
    'wire evaluations are scalars; only selector polys remain (degree n-1)',
    isDark,
  );

  const afterTerms = result.linearizedSteps[0]!.terms;
  const linDegree = result.linearizedSteps[0]!.totalDegree;

  tx = originX;
  const afterTermY = afterY + 24;

  afterTerms.forEach((term, ti) => {
    // In the linearized version, the coefficient is a scalar (evaluated wire value)
    const isScalarCoeff = ti < 4; // first 4 terms have scalar coefficients; qC stays poly
    drawTermBox(ctx, tx, afterTermY, term.coefficient, term.polynomial, isScalarCoeff, isDark);
    if (ti < afterTerms.length - 1) {
      drawPlusSep(ctx, tx + TERM_BOX_W + TERM_GAP + PLUS_W / 2, afterTermY + TERM_BOX_H / 2, isDark);
      tx += TERM_BOX_W + TERM_GAP + PLUS_W + TERM_GAP;
    } else {
      tx += TERM_BOX_W;
    }
  });

  // Degree badge
  drawDegreeBadge(ctx, tx + 16, afterTermY + (TERM_BOX_H - 20) / 2, linDegree, 'r(x)', isDark);

  // Degree reduction callout
  if (fullDegree > linDegree && linDegree >= 0) {
    const calloutX = tx + 16;
    const calloutY = afterTermY + (TERM_BOX_H - 20) / 2 + 28;
    const reductionText = `reduced from ${fullDegree} \u2192 ${linDegree}`;
    ctx.font = 'bold 9px monospace';
    const rw = ctx.measureText(reductionText).width + 16;

    ctx.fillStyle = hexToRgba('#22c55e', isDark ? 0.1 : 0.07);
    drawRoundedRect(ctx, calloutX, calloutY, rw, 20, 4);
    ctx.fill();
    ctx.strokeStyle = hexToRgba('#22c55e', isDark ? 0.5 : 0.4);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, calloutX, calloutY, rw, 20, 4);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#86efac' : '#15803d';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(reductionText, calloutX + 8, calloutY + 10);
  }

  // ── Consistency check box ────────────────────────────────────────────────────
  const checkBoxY = afterY + 24 + TERM_BOX_H + 24;
  const checkBoxX = originX;
  const isConsistent = result.consistent;
  const checkColor = isConsistent ? '#22c55e' : '#ef4444';

  ctx.fillStyle = hexToRgba(checkColor, isDark ? 0.1 : 0.07);
  drawRoundedRect(ctx, checkBoxX, checkBoxY, CHECK_BOX_W, CHECK_BOX_H, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(checkColor, isDark ? 0.65 : 0.5);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, checkBoxX, checkBoxY, CHECK_BOX_W, CHECK_BOX_H, 8);
  ctx.stroke();

  ctx.fillStyle = checkColor;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isConsistent ? '\u2713 Consistency check passed' : '\u2717 Consistency check FAILED',
    checkBoxX + CHECK_BOX_W / 2,
    checkBoxY + 18,
  );

  // Sub-line: T(ζ) vs r(ζ)
  ctx.font = '9px monospace';
  ctx.fillStyle = hexToRgba(isDark ? '#fafafa' : '#09090b', 0.55);
  ctx.fillText(
    `C(\u03b6) = ${bigStr(result.fullCheckValue)}   r(\u03b6) = ${bigStr(result.linearizedCheckValue)}`,
    checkBoxX + CHECK_BOX_W / 2,
    checkBoxY + 38,
  );

  // Additional info box (explanation)
  const infoX = checkBoxX + CHECK_BOX_W + 24;
  const infoW = 220;
  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.35 : 0.25);
  drawRoundedRect(ctx, infoX, checkBoxY, infoW, CHECK_BOX_H, 8);
  ctx.fill();

  const infoLines = [
    'C(\u03b6) = r(\u03b6) by construction.',
    'The verifier only needs r(x)',
    '(degree n-1, not ~2n-2).',
  ];
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  infoLines.forEach((line, li) => {
    ctx.fillText(line, infoX + 10, checkBoxY + 8 + li * 14);
  });

  ctx.textBaseline = 'alphabetic';
}
