import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawArrow, hexToRgba, drawRoundedRect } from '@/lib/canvas';
import type { PedersenParams, Commitment, HomomorphicResult } from './logic';

interface HoverRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const BOX_W = 148;
const BOX_H = 56;
const BOX_R = 8;
const ROW_Y = 130;           // top of value/randomness boxes
const PRODUCT_Y = 290;       // top of g^v and h^r boxes
const COMMIT_Y = 430;        // top of commitment box
const ARROW_GAP = 10;        // gap between box edge and arrow tip

// ── Color helpers ─────────────────────────────────────────────────────────────
function accent(isDark: boolean): string {
  return isDark ? '#e4e4e7' : '#3f3f46';
}
function muted(isDark: boolean): string {
  return isDark ? '#71717a' : '#a1a1aa';
}
function success(isDark: boolean): string {
  void isDark;
  return '#22c55e';
}
function error(isDark: boolean): string {
  void isDark;
  return '#ef4444';
}
function boxBg(isDark: boolean): string {
  return isDark ? 'rgba(17,17,19,0.96)' : 'rgba(255,255,255,0.96)';
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  valueText: string,
  borderColor: string,
  isDark: boolean,
  hoverRegions?: HoverRegion[],
  hoverInfo?: { title: string; body: string },
): void {
  const x = cx - BOX_W / 2;
  const y = cy - BOX_H / 2;

  if (hoverRegions) {
    hoverRegions.push({
      x,
      y,
      w: BOX_W,
      h: BOX_H,
      title: hoverInfo?.title ?? label,
      body: hoverInfo?.body ?? valueText,
    });
  }

  // Background
  ctx.fillStyle = boxBg(isDark);
  drawRoundedRect(ctx, x, y, BOX_W, BOX_H, BOX_R);
  ctx.fill();

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, BOX_W, BOX_H, BOX_R);
  ctx.stroke();

  // Label (top kicker)
  ctx.fillStyle = muted(isDark);
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, cx, y + 18);

  // Value (large)
  ctx.fillStyle = accent(isDark);
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(valueText, cx, y + BOX_H - 14);
}

function arrowDown(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
): void {
  drawArrow(ctx, fromX, fromY + ARROW_GAP, toX, toY - ARROW_GAP, color, 7);
}

function operatorText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  isDark: boolean,
): void {
  ctx.fillStyle = muted(isDark);
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  region: HoverRegion,
  isDark: boolean,
): void {
  const padding = 10;
  const lineHeight = 14;

  ctx.save();
  ctx.font = '700 11px "Space Grotesk", sans-serif';
  const titleWidth = ctx.measureText(region.title).width;
  ctx.font = '11px "JetBrains Mono", monospace';
  const bodyWidth = ctx.measureText(region.body).width;
  const tooltipW = Math.max(titleWidth, bodyWidth) + padding * 2;
  const tooltipH = padding * 2 + lineHeight * 2 + 4;

  let tooltipX = region.x + region.w + 10;
  if (tooltipX + tooltipW > width - 10) tooltipX = region.x - tooltipW - 10;
  if (tooltipX < 10) tooltipX = 10;

  let tooltipY = region.y + region.h / 2 - tooltipH / 2;
  if (tooltipY + tooltipH > height - 10) tooltipY = height - tooltipH - 10;
  if (tooltipY < 10) tooltipY = 10;

  ctx.fillStyle = isDark ? 'rgba(24,24,27,0.96)' : 'rgba(255,255,255,0.96)';
  drawRoundedRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 8);
  ctx.fill();
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = '700 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(region.title, tooltipX + padding, tooltipY + padding + 10);
  ctx.fillStyle = isDark ? '#d4d4d8' : '#52525b';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(region.body, tooltipX + padding, tooltipY + padding + 10 + lineHeight + 4);
  ctx.restore();
}

// ── Single-commitment layout ──────────────────────────────────────────────────

function renderSingleCommitment(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  params: PedersenParams,
  commitment: Commitment | null,
  showBlinding: boolean,
  isDark: boolean,
  isDraft: boolean = false,
  hoverRegions: HoverRegion[],
): void {
  const { width } = frame;
  const cx = width / 2;

  // ── Title ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = accent(isDark);
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Pedersen Commitment  C = g^v · h^r  mod p', 60, 52);

  ctx.fillStyle = muted(isDark);
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`p = ${params.p}    g = ${params.g}    h = ${params.h}`, 60, 72);

  // ── Row 1: value and randomness input boxes ────────────────────────────────
  const leftCX = cx - 110;
  const rightCX = cx + 110;

  const v = commitment?.value ?? 0;
  const r = commitment?.randomness ?? 0;

  drawBox(ctx, leftCX, ROW_Y, 'value (v)', String(v), hexToRgba(accent(isDark), 0.45), isDark, hoverRegions);
  if (showBlinding) {
    drawBox(ctx, rightCX, ROW_Y, 'blinding (r)', String(r), hexToRgba(muted(isDark), 0.55), isDark, hoverRegions);
  } else {
    // Hidden blinding factor — show as masked
    drawBox(
      ctx,
      rightCX,
      ROW_Y,
      'blinding (r)',
      '●●●',
      hexToRgba(muted(isDark), 0.35),
      isDark,
      hoverRegions,
      { title: 'blinding (r)', body: 'Hidden — toggle reveal to inspect the opening randomness.' },
    );
  }

  // ── Arrows: value → g^v, randomness → h^r ─────────────────────────────────
  const arrowColor = hexToRgba(muted(isDark), isDark ? 0.5 : 0.4);
  arrowDown(ctx, leftCX, ROW_Y + BOX_H / 2, leftCX, PRODUCT_Y - BOX_H / 2, arrowColor);
  arrowDown(ctx, rightCX, ROW_Y + BOX_H / 2, rightCX, PRODUCT_Y - BOX_H / 2, arrowColor);

  // ── Row 2: g^v and h^r boxes ──────────────────────────────────────────────
  const gvLabel = `g^v = ${params.g}^${v}`;
  const hrLabel = showBlinding ? `h^r = ${params.h}^${r}` : `h^r = ${params.h}^r`;

  const { modPow } = await_modPow();
  const gv = modPow(params.g, v, params.p);
  const hr = modPow(params.h, r, params.p);

  drawBox(ctx, leftCX, PRODUCT_Y, gvLabel, `≡ ${gv}`, hexToRgba(accent(isDark), 0.35), isDark, hoverRegions);
  drawBox(
    ctx,
    rightCX,
    PRODUCT_Y,
    hrLabel,
    showBlinding ? `≡ ${hr}` : '≡ ?',
    hexToRgba(muted(isDark), 0.35),
    isDark,
    hoverRegions,
    showBlinding ? undefined : { title: hrLabel, body: 'Hidden until the blinding factor is revealed.' },
  );

  // ── Converging arrows → commitment ────────────────────────────────────────
  const midX = cx;
  const midY = (PRODUCT_Y + BOX_H / 2 + COMMIT_Y - BOX_H / 2) / 2;

  // From g^v box to midpoint
  const fromLeftX = leftCX + BOX_W / 2;
  const fromLeftY = PRODUCT_Y + BOX_H / 2;
  const fromRightX = rightCX - BOX_W / 2;
  const fromRightY = PRODUCT_Y + BOX_H / 2;

  // Draw elbow: right-angle path
  drawElbow(ctx, fromLeftX, fromLeftY, midX, midY + 18, arrowColor);
  drawElbow(ctx, fromRightX, fromRightY, midX, midY + 18, arrowColor);

  // Multiply operator at merge
  operatorText(ctx, midX - 50, midY, '×', isDark);

  // Arrow from midpoint down to commitment
  arrowDown(ctx, midX, midY + 20, midX, COMMIT_Y - BOX_H / 2, arrowColor);

  // ── Commitment box ────────────────────────────────────────────────────────
  const commitVal = commitment !== null ? String(commitment.commitment) : '—';
  const commitLabel = `C = (${gv} · ${showBlinding ? hr : '?'}) mod ${params.p}`;
  const commitBorder = isDraft
    ? hexToRgba(isDark ? '#a1a1aa' : '#71717a', 0.4)
    : hexToRgba(success(isDark), isDark ? 0.7 : 0.6);

  if (isDraft) ctx.setLineDash([4, 4]);
  drawBox(ctx, midX, COMMIT_Y, commitLabel, commitVal, commitBorder, isDark, hoverRegions);
  if (isDraft) ctx.setLineDash([]);

  // ── Status strip ─────────────────────────────────────────────────────────
  const statusY = COMMIT_Y + BOX_H / 2 + 28;
  if (isDraft) {
    ctx.fillStyle = hexToRgba(isDark ? '#a1a1aa' : '#71717a', 0.6);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('draft — click Commit to lock', midX, statusY);
  } else {
    const statusColor = success(isDark);
    ctx.fillStyle = hexToRgba(statusColor, isDark ? 0.1 : 0.07);
    drawRoundedRect(ctx, midX - 100, statusY - 14, 200, 28, 6);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(statusColor, isDark ? 0.55 : 0.45);
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, midX - 100, statusY - 14, 200, 28, 6);
    ctx.stroke();
    ctx.fillStyle = statusColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓ Commitment computed', midX, statusY);
  }
}

// ── Homomorphic layout ────────────────────────────────────────────────────────

function renderHomomorphic(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  params: PedersenParams,
  result: HomomorphicResult,
  isDark: boolean,
  hoverRegions: HoverRegion[],
): void {
  const { width } = frame;
  const { modPow } = await_modPow();

  // ── Title ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = accent(isDark);
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Homomorphic Addition  C1 · C2 = commit(v1+v2, r1+r2)', 48, 52);

  ctx.fillStyle = muted(isDark);
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`p = ${params.p}    g = ${params.g}    h = ${params.h}`, 48, 72);

  // Two commitments side by side
  const col1X = width / 2 - 190;
  const col2X = width / 2 + 190;
  const arrowColor = hexToRgba(muted(isDark), isDark ? 0.5 : 0.4);

  // ── Commitment 1 column ──────────────────────────────────────────────────
  const v1 = result.c1.value;
  const r1 = result.c1.randomness;
  const gv1 = modPow(params.g, v1, params.p);
  const hr1 = modPow(params.h, r1, params.p);

  drawBox(ctx, col1X, ROW_Y, 'value v₁', String(v1), hexToRgba(accent(isDark), 0.45), isDark, hoverRegions);
  drawBox(ctx, col1X + 130, ROW_Y, 'random r₁', String(r1), hexToRgba(muted(isDark), 0.4), isDark, hoverRegions);

  arrowDown(ctx, col1X, ROW_Y + BOX_H / 2, col1X, PRODUCT_Y - BOX_H / 2, arrowColor);
  arrowDown(ctx, col1X + 130, ROW_Y + BOX_H / 2, col1X + 130, PRODUCT_Y - BOX_H / 2, arrowColor);

  drawBox(ctx, col1X, PRODUCT_Y, `g^${v1}`, `≡ ${gv1}`, hexToRgba(accent(isDark), 0.3), isDark, hoverRegions);
  drawBox(ctx, col1X + 130, PRODUCT_Y, `h^${r1}`, `≡ ${hr1}`, hexToRgba(muted(isDark), 0.3), isDark, hoverRegions);

  // converging to C1
  const midC1 = col1X + 65;
  const midC1Y = (PRODUCT_Y + BOX_H / 2 + COMMIT_Y - BOX_H / 2) / 2;
  drawElbow(ctx, col1X + BOX_W / 2, PRODUCT_Y + BOX_H / 2, midC1, midC1Y + 18, arrowColor);
  drawElbow(ctx, col1X + 130 - BOX_W / 2, PRODUCT_Y + BOX_H / 2, midC1, midC1Y + 18, arrowColor);
  arrowDown(ctx, midC1, midC1Y + 20, midC1, COMMIT_Y - BOX_H / 2, arrowColor);
  drawBox(ctx, midC1, COMMIT_Y, `C₁ = ${gv1}·${hr1} mod p`, String(result.c1.commitment), hexToRgba(accent(isDark), 0.45), isDark, hoverRegions);

  // ── Commitment 2 column ──────────────────────────────────────────────────
  const v2 = result.c2.value;
  const r2 = result.c2.randomness;
  const gv2 = modPow(params.g, v2, params.p);
  const hr2 = modPow(params.h, r2, params.p);

  drawBox(ctx, col2X - 130, ROW_Y, 'value v₂', String(v2), hexToRgba(accent(isDark), 0.45), isDark, hoverRegions);
  drawBox(ctx, col2X, ROW_Y, 'random r₂', String(r2), hexToRgba(muted(isDark), 0.4), isDark, hoverRegions);

  arrowDown(ctx, col2X - 130, ROW_Y + BOX_H / 2, col2X - 130, PRODUCT_Y - BOX_H / 2, arrowColor);
  arrowDown(ctx, col2X, ROW_Y + BOX_H / 2, col2X, PRODUCT_Y - BOX_H / 2, arrowColor);

  drawBox(ctx, col2X - 130, PRODUCT_Y, `g^${v2}`, `≡ ${gv2}`, hexToRgba(accent(isDark), 0.3), isDark, hoverRegions);
  drawBox(ctx, col2X, PRODUCT_Y, `h^${r2}`, `≡ ${hr2}`, hexToRgba(muted(isDark), 0.3), isDark, hoverRegions);

  const midC2 = col2X - 65;
  const midC2Y = midC1Y;
  drawElbow(ctx, col2X - 130 + BOX_W / 2, PRODUCT_Y + BOX_H / 2, midC2, midC2Y + 18, arrowColor);
  drawElbow(ctx, col2X - BOX_W / 2, PRODUCT_Y + BOX_H / 2, midC2, midC2Y + 18, arrowColor);
  arrowDown(ctx, midC2, midC2Y + 20, midC2, COMMIT_Y - BOX_H / 2, arrowColor);
  drawBox(ctx, midC2, COMMIT_Y, `C₂ = ${gv2}·${hr2} mod p`, String(result.c2.commitment), hexToRgba(accent(isDark), 0.45), isDark, hoverRegions);

  // ── Product section ────────────────────────────────────────────────────────
  const productY = COMMIT_Y + BOX_H / 2 + 60;
  const resultCX = width / 2;

  // Draw arrows from C1 and C2 toward product row
  const prodArrowY = productY - BOX_H / 2;
  drawElbow(ctx, midC1, COMMIT_Y + BOX_H / 2, resultCX, prodArrowY + 10, arrowColor);
  drawElbow(ctx, midC2, COMMIT_Y + BOX_H / 2, resultCX, prodArrowY + 10, arrowColor);

  operatorText(ctx, resultCX - 80, productY - 10, '×', isDark);

  arrowDown(ctx, resultCX, prodArrowY + 12, resultCX, productY - BOX_H / 2, arrowColor);

  // Combined product box
  const validColor = result.valid ? success(isDark) : error(isDark);
  drawBox(
    ctx,
    resultCX,
    productY,
    `C₁ · C₂ mod p`,
    String(result.combined),
    hexToRgba(validColor, isDark ? 0.7 : 0.6),
    isDark,
    hoverRegions,
  );

  // ── Expected direct commit ────────────────────────────────────────────────
  const sumV = result.sumValue;
  const sumR = result.sumRandomness;
  const sumVReduced = sumV % params.p;
  const sumRReduced = sumR % params.p;
  const expectedY = productY + BOX_H / 2 + 54;

  arrowDown(ctx, resultCX, productY + BOX_H / 2, resultCX, expectedY - BOX_H / 2, arrowColor);

  // Show the direct recomputed commitment
  const expectedGv = modPow(params.g, sumVReduced, params.p);
  const expectedHr = modPow(params.h, sumRReduced, params.p);
  const expectedC = (expectedGv * expectedHr) % params.p;

  drawBox(
    ctx,
    resultCX,
    expectedY,
    `commit(${sumVReduced}, ${sumRReduced})`,
    String(expectedC),
    hexToRgba(validColor, isDark ? 0.5 : 0.4),
    isDark,
    hoverRegions,
  );

  // ── Match badge ───────────────────────────────────────────────────────────
  const badgeY = expectedY + BOX_H / 2 + 28;
  ctx.fillStyle = hexToRgba(validColor, isDark ? 0.1 : 0.07);
  drawRoundedRect(ctx, resultCX - 110, badgeY - 14, 220, 28, 6);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(validColor, isDark ? 0.55 : 0.45);
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, resultCX - 110, badgeY - 14, 220, 28, 6);
  ctx.stroke();
  ctx.fillStyle = validColor;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    result.valid ? '✓ Homomorphic property holds' : '✗ Mismatch — check values',
    resultCX,
    badgeY,
  );
}

// ── Elbow connector helper ────────────────────────────────────────────────────

function drawElbow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  if (x1 === x2) {
    drawArrow(ctx, x1, y1 + ARROW_GAP, x2, y2 - ARROW_GAP, color, 7);
    return;
  }
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1, (y1 + y2) / 2);
  ctx.lineTo(x2, (y1 + y2) / 2);
  ctx.lineTo(x2, y2 - 6);
  ctx.stroke();
  // Arrowhead
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 5, y2 - 9);
  ctx.lineTo(x2 + 5, y2 - 9);
  ctx.closePath();
  ctx.fill();
}

// Lazy import helper — avoids circular deps and keeps renderer pure
function await_modPow(): { modPow: (base: number, exp: number, mod: number) => number } {
  // Inline the algorithm here to keep renderer self-contained (no dynamic import)
  function modPow(base: number, exp: number, mod: number): number {
    if (mod === 1) return 0;
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0) {
      if (e % 2 === 1) result = (result * b) % mod;
      b = (b * b) % mod;
      e = Math.floor(e / 2);
    }
    return result;
  }
  return { modPow };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderPedersen(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  params: PedersenParams,
  commitment: Commitment | null,
  homomorphic: HomomorphicResult | null,
  showBlinding: boolean,
  theme: 'dark' | 'light',
  isDraft: boolean = false,
  mouseX?: number,
  mouseY?: number,
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';
  const hoverRegions: HoverRegion[] = [];

  // ── Background ─────────────────────────────────────────────────────────────
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

  // ── Dispatch to sub-renderer ───────────────────────────────────────────────
  if (homomorphic) {
    renderHomomorphic(ctx, frame, params, homomorphic, isDark, hoverRegions);
  } else {
    renderSingleCommitment(ctx, frame, params, commitment, showBlinding, isDark, isDraft, hoverRegions);
  }

  if (typeof mouseX === 'number' && typeof mouseY === 'number') {
    const hovered = hoverRegions.find((region) =>
      mouseX >= region.x && mouseX <= region.x + region.w && mouseY >= region.y && mouseY <= region.y + region.h
    );
    if (hovered) {
      drawTooltip(ctx, width, height, hovered, isDark);
    }
  }
}
