import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { FRILayer, FRIQueryRound } from './logic';

/* ── Public render state ─────────────────────────────────────────────── */

export interface FRIRenderState {
  layers: FRILayer[];
  queries: FRIQueryRound[];
  fieldSize: bigint;
  currentLayer: number; // -1 = overview, 0..n = active layer
  phase: 'setup' | 'committing' | 'querying' | 'complete';
  accepted: boolean | null;
  finalConstant: bigint | null;
}

/* ── Layout constants ────────────────────────────────────────────────── */

const CARD_W = 200;
const CARD_H_BASE = 100; // minimum height per layer card
const CARD_GAP = 56;     // vertical gap between cards (enough for arrow)
const CARD_RADIUS = 10;

const CARD_HEADER_H = 32;
const ROW_H = 24;
const ROW_PAD_X = 12;

const DOT_R = 4;
const DOT_GAP = 14;
const DOT_MAX = 8; // max evaluation dots shown per layer

const ARROW_HEAD = 7;

const BADGE_H = 30;
const BADGE_RADIUS = 8;

const VERDICT_H = 34;
const VERDICT_RADIUS = 8;

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
const COLOR_ACTIVE_BORDER = '#a1a1aa';
const COLOR_QUERY = '#06b6d4'; // cyan accent for query paths

/* ── Helpers ─────────────────────────────────────────────────────────── */

function bstr(v: bigint): string {
  return v.toString();
}

/** Draw a key=value row inside a card. */
function drawCardRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  isDark: boolean,
  highlight?: 'pass' | 'fail' | null,
): void {
  if (highlight) {
    const bg = highlight === 'pass'
      ? hexToRgba(COLOR_SUCCESS, 0.08)
      : hexToRgba(COLOR_ERROR, 0.08);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, ROW_H);
  }

  ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + ROW_PAD_X, y + ROW_H / 2);

  if (highlight === 'pass') {
    ctx.fillStyle = COLOR_SUCCESS;
  } else if (highlight === 'fail') {
    ctx.fillStyle = COLOR_ERROR;
  } else {
    ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  }
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w - ROW_PAD_X, y + ROW_H / 2);
}

/** Draw a horizontal dashed divider inside a card. */
function drawCardDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  isDark: boolean,
): void {
  ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x + w - 8, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Draw evaluation dots (a mini bar showing domain values). */
function drawEvalDots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  evaluations: bigint[],
  fieldSize: bigint,
  isDark: boolean,
  highlightIndices?: Set<number>,
): void {
  const count = Math.min(evaluations.length, DOT_MAX);
  const totalW = (count - 1) * DOT_GAP;
  const startX = cx - totalW / 2;

  const maxVal = Number(fieldSize);

  for (let i = 0; i < count; i++) {
    const dx = startX + i * DOT_GAP;
    const val = Number(evaluations[i]!);
    const normalized = val / maxVal;
    const r = DOT_R * 0.6 + DOT_R * 0.8 * normalized;

    const isHighlighted = highlightIndices?.has(i);

    if (isHighlighted) {
      // Glow for query-highlighted dots
      ctx.fillStyle = hexToRgba(COLOR_QUERY, 0.25);
      ctx.beginPath();
      ctx.arc(dx, cy, r + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isHighlighted
      ? COLOR_QUERY
      : hexToRgba(isDark ? ZINC_300 : ZINC_500, 0.7);
    ctx.beginPath();
    ctx.arc(dx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ellipsis if truncated
  if (evaluations.length > DOT_MAX) {
    ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.5);
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2026', startX + count * DOT_GAP, cy);
  }
}

/** Draw a vertical downward arrow between two points. */
function drawVertArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y1: number,
  y2: number,
  color: string,
  label?: string,
  isDark?: boolean,
): void {
  if (y2 <= y1 + 4) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2 - ARROW_HEAD);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x, y2);
  ctx.lineTo(x - ARROW_HEAD * 0.55, y2 - ARROW_HEAD);
  ctx.lineTo(x + ARROW_HEAD * 0.55, y2 - ARROW_HEAD);
  ctx.closePath();
  ctx.fill();

  // Optional midpoint label
  if (label) {
    const midY = (y1 + y2) / 2;
    ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 8, midY);
  }
}

/* ── Layer card ──────────────────────────────────────────────────────── */

function computeCardH(layer: FRILayer): number {
  // header + degree row + domain row + divider + eval dots row + (optional challenge row)
  let h = CARD_HEADER_H + ROW_H + ROW_H + ROW_H; // header + degree + domain + dots
  if (layer.challenge !== null) {
    h += ROW_H; // challenge row
  }
  return Math.max(CARD_H_BASE, h + 8);
}

function drawLayerCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  layer: FRILayer,
  layerIndex: number,
  isActive: boolean,
  isComplete: boolean,
  isDark: boolean,
  t: number,
  fieldSize: bigint,
  queryHighlightIndices?: Set<number>,
): { bottomY: number } {
  const cardH = computeCardH(layer);

  // Card background
  const borderAlpha = isActive ? (0.7 + 0.3 * Math.sin(t * 2.8)) : (isComplete ? 0.45 : 0.2);
  const borderColor = isActive
    ? hexToRgba(COLOR_ACTIVE_BORDER, borderAlpha)
    : isComplete
      ? hexToRgba(ZINC_500, borderAlpha)
      : hexToRgba(ZINC_600, borderAlpha);

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.55 : 0.85);
  drawRoundedRect(ctx, x, y, CARD_W, cardH, CARD_RADIUS);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isActive ? 1.5 : 1;
  drawRoundedRect(ctx, x, y, CARD_W, cardH, CARD_RADIUS);
  ctx.stroke();

  // Header bar
  const headerBg = isActive
    ? hexToRgba(ZINC_500, 0.25)
    : hexToRgba(isDark ? ZINC_700 : ZINC_300, 0.4);

  ctx.fillStyle = headerBg;
  ctx.beginPath();
  ctx.moveTo(x + CARD_RADIUS, y);
  ctx.lineTo(x + CARD_W - CARD_RADIUS, y);
  ctx.quadraticCurveTo(x + CARD_W, y, x + CARD_W, y + CARD_RADIUS);
  ctx.lineTo(x + CARD_W, y + CARD_HEADER_H);
  ctx.lineTo(x, y + CARD_HEADER_H);
  ctx.lineTo(x, y + CARD_RADIUS);
  ctx.quadraticCurveTo(x, y, x + CARD_RADIUS, y);
  ctx.closePath();
  ctx.fill();

  // Header label
  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Layer ${layerIndex}`, x + ROW_PAD_X, y + CARD_HEADER_H / 2);

  // Domain size on right side of header
  ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`|D| = ${layer.domain.length}`, x + CARD_W - ROW_PAD_X, y + CARD_HEADER_H / 2);

  // Body rows
  let rowY = y + CARD_HEADER_H;

  // Degree row
  drawCardRow(ctx, x, rowY, CARD_W, 'degree', `\u2264 ${layer.degree}`, isDark);
  rowY += ROW_H;

  // Challenge row (if not the first layer)
  if (layer.challenge !== null) {
    drawCardRow(ctx, x, rowY, CARD_W, '\u03b1', bstr(layer.challenge), isDark);
    rowY += ROW_H;
  }

  drawCardDivider(ctx, x, rowY, CARD_W, isDark);
  rowY += 2;

  // Evaluation dots
  drawEvalDots(ctx, x + CARD_W / 2, rowY + ROW_H / 2, layer.evaluations, fieldSize, isDark, queryHighlightIndices);
  rowY += ROW_H;

  return { bottomY: y + cardH };
}

/* ── Query path overlay ─────────────────────────────────────────────── */

function drawQueryPaths(
  ctx: CanvasRenderingContext2D,
  queries: FRIQueryRound[],
  layerCardYs: number[],
  layerCardHs: number[],
  centerX: number,
  isDark: boolean,
  t: number,
): void {
  if (queries.length === 0) return;

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi]!;
    const offsetX = (qi - (queries.length - 1) / 2) * 24;
    const pathX = centerX + CARD_W / 2 + 20 + offsetX;

    for (let l = 0; l < query.layerValues.length; l++) {
      const lv = query.layerValues[l]!;
      const cardY = layerCardYs[l]!;
      const cardH = layerCardHs[l]!;
      const nextCardY = layerCardYs[l + 1]!;

      const fromY = cardY + cardH / 2;
      const toY = nextCardY + (layerCardHs[l + 1]! / 2);

      // Connecting line
      ctx.strokeStyle = hexToRgba(lv.consistent ? COLOR_SUCCESS : COLOR_ERROR, 0.5);
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pathX, fromY);
      ctx.lineTo(pathX, toY);
      ctx.stroke();

      // Consistency marker
      const markerY = (fromY + toY) / 2;
      const markerR = 8;

      ctx.fillStyle = hexToRgba(lv.consistent ? COLOR_SUCCESS : COLOR_ERROR, isDark ? 0.15 : 0.1);
      ctx.beginPath();
      ctx.arc(pathX, markerY, markerR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = lv.consistent ? COLOR_SUCCESS : COLOR_ERROR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pathX, markerY, markerR, 0, Math.PI * 2);
      ctx.stroke();

      // Check or X icon
      ctx.fillStyle = lv.consistent ? COLOR_SUCCESS : COLOR_ERROR;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lv.consistent ? '\u2713' : '\u2717', pathX, markerY);

      // Pulsing glow for active queries
      const pulse = 0.15 + 0.1 * Math.sin(t * 3 + qi * 1.5 + l * 0.8);
      ctx.fillStyle = hexToRgba(lv.consistent ? COLOR_SUCCESS : COLOR_ERROR, pulse);
      ctx.beginPath();
      ctx.arc(pathX, markerY, markerR + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Query index label at the top
    if (layerCardYs.length > 0) {
      ctx.fillStyle = hexToRgba(COLOR_QUERY, isDark ? 0.9 : 0.8);
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`q=${query.queryIndex}`, pathX, layerCardYs[0]! - 6);
    }
  }
}

/* ── Final constant badge ────────────────────────────────────────────── */

function drawFinalConstantBadge(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  finalConstant: bigint,
  isDark: boolean,
): void {
  const text = `Final constant = ${bstr(finalConstant)}`;
  ctx.font = 'bold 11px monospace';
  const textW = ctx.measureText(text).width + 32;
  const badgeX = centerX - textW / 2;
  const badgeY = y;

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#e4e4e7', isDark ? 0.75 : 0.85);
  drawRoundedRect(ctx, badgeX, badgeY, textW, BADGE_H, BADGE_RADIUS);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(isDark ? ZINC_500 : ZINC_300, 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, badgeX, badgeY, textW, BADGE_H, BADGE_RADIUS);
  ctx.stroke();

  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, centerX, badgeY + BADGE_H / 2);
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderFRI(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: FRIRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height, time } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const t = time;
  const isDark = theme === 'dark';

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

  // ── Layout ────────────────────────────────────────────────────────
  const layerCount = state.layers.length;

  if (layerCount === 0) {
    // Empty state: show placeholder
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.6);
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Configure polynomial and run the commit phase', width / 2, height / 2);

    ctx.restore();
    return;
  }

  // Compute card heights for each layer
  const cardHeights = state.layers.map((layer) => computeCardH(layer));
  const totalCardsH = cardHeights.reduce((s, h) => s + h, 0) + (layerCount - 1) * CARD_GAP;
  const finalBadgeSpace = state.finalConstant !== null ? (BADGE_H + 24) : 0;
  const totalH = totalCardsH + finalBadgeSpace;

  const topPadding = 70;
  const startY = topPadding + Math.max(0, (height - topPadding - 60 - totalH) / 2);
  const centerX = width / 2 - CARD_W / 2;

  // Build query highlight indices per layer
  const queryHighlightsByLayer: Map<number, Set<number>> = new Map();
  if (state.phase === 'querying' || state.phase === 'complete') {
    for (const query of state.queries) {
      let idx = query.queryIndex;
      for (let l = 0; l < query.layerValues.length; l++) {
        if (!queryHighlightsByLayer.has(l)) {
          queryHighlightsByLayer.set(l, new Set());
        }
        const layer = state.layers[l]!;
        const n = layer.evaluations.length;
        const currentIdx = ((idx % n) + n) % n;
        queryHighlightsByLayer.get(l)!.add(currentIdx);
        idx = currentIdx % (n / 2);
      }
    }
  }

  // ── Draw layer cards ──────────────────────────────────────────────
  const layerCardYs: number[] = [];
  const layerCardHs: number[] = [];
  let curY = startY;

  for (let i = 0; i < layerCount; i++) {
    const layer = state.layers[i]!;
    const cardH = cardHeights[i]!;
    const isActive = state.currentLayer === i;
    const isComplete = state.currentLayer > i || state.phase === 'querying' || state.phase === 'complete';

    layerCardYs.push(curY);
    layerCardHs.push(cardH);

    drawLayerCard(
      ctx, centerX, curY, layer, i, isActive, isComplete, isDark, t,
      state.fieldSize,
      queryHighlightsByLayer.get(i),
    );

    // Arrow to next layer
    if (i < layerCount - 1) {
      const nextChallenge = state.layers[i + 1]?.challenge;
      const arrowLabel = nextChallenge !== null && nextChallenge !== undefined
        ? `\u03b1 = ${bstr(nextChallenge)}`
        : undefined;
      const arrowColor = hexToRgba(isDark ? ZINC_500 : ZINC_400, 0.7);

      drawVertArrow(
        ctx,
        centerX + CARD_W / 2,
        curY + cardH + 2,
        curY + cardH + CARD_GAP - 2,
        arrowColor,
        arrowLabel,
        isDark,
      );
    }

    curY += cardH + CARD_GAP;
  }

  // ── Final constant badge ──────────────────────────────────────────
  if (state.finalConstant !== null) {
    drawFinalConstantBadge(
      ctx,
      centerX + CARD_W / 2,
      curY - CARD_GAP + 16,
      state.finalConstant,
      isDark,
    );
  }

  // ── Query paths (overlay on right side) ───────────────────────────
  if ((state.phase === 'querying' || state.phase === 'complete') && state.queries.length > 0) {
    drawQueryPaths(ctx, state.queries, layerCardYs, layerCardHs, centerX, isDark, t);
  }

  // ── Screen-space overlays ─────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Header badge ──────────────────────────────────────────────────
  const degree = state.layers[0]?.degree ?? '?';
  const domainSize = state.layers[0]?.domain.length ?? '?';
  const headerText = `FRI Protocol \u2014 degree ${degree}, domain ${domainSize}, GF(${bstr(state.fieldSize)})`;
  ctx.font = '11px monospace';
  const headerW = ctx.measureText(headerText).width + 40;
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
  ctx.fillText(headerText, width / 2, headerY + BADGE_H / 2);

  // Layer progress sub-label
  const progressText = state.phase === 'setup'
    ? 'Ready to commit'
    : state.phase === 'committing'
      ? `Folding layer ${state.currentLayer + 1} of ${layerCount}`
      : state.phase === 'querying'
        ? `${state.queries.length} quer${state.queries.length === 1 ? 'y' : 'ies'} running`
        : 'Protocol complete';
  ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.8);
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(progressText, width / 2, headerY + BADGE_H + 10);

  // ── Verdict badge ─────────────────────────────────────────────────
  if (state.accepted !== null) {
    const isAccepted = state.accepted;
    const verdictText = isAccepted ? '\u2713 ACCEPTED' : '\u2717 REJECTED';
    const verdictColor = isAccepted ? COLOR_SUCCESS : COLOR_ERROR;

    ctx.font = 'bold 13px monospace';
    const verdictW = ctx.measureText(verdictText).width + 48;
    const verdictX = width / 2 - verdictW / 2;
    const verdictY = height - VERDICT_H - 16;

    ctx.fillStyle = hexToRgba(verdictColor, isDark ? 0.12 : 0.08);
    drawRoundedRect(ctx, verdictX, verdictY, verdictW, VERDICT_H, VERDICT_RADIUS);
    ctx.fill();

    ctx.strokeStyle = hexToRgba(verdictColor, isDark ? 0.55 : 0.45);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, verdictX, verdictY, verdictW, VERDICT_H, VERDICT_RADIUS);
    ctx.stroke();

    ctx.fillStyle = verdictColor;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(verdictText, width / 2, verdictY + VERDICT_H / 2);
  } else if (state.phase === 'committing') {
    ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.9);
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Prover folding polynomial\u2026', width / 2, height - 24);
  } else if (state.phase === 'querying') {
    ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.9);
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Verifier checking consistency\u2026', width / 2, height - 24);
  }

  ctx.restore();
}
