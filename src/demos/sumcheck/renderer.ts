import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { SumcheckRound } from './logic';

/* ── Public render state ─────────────────────────────────────────────── */

export interface SumcheckRenderState {
  numVariables: number;
  fieldSize: bigint;
  claimedSum: bigint;
  rounds: SumcheckRound[];
  currentRound: number; // 0 = setup, 1..n = active round, n+1 = oracle check
  verdict: 'honest' | 'cheating_caught' | null;
  phase: 'setup' | 'proving' | 'verifying' | 'complete';
}

/* ── Layout constants ────────────────────────────────────────────────── */

// Round card dimensions
const CARD_W = 164;
const CARD_H = 190;
const CARD_GAP = 48;  // horizontal gap between cards (enough for the arrow)
const CARD_RADIUS = 10;

// Oracle card is slightly wider
const ORACLE_W = 164;
const ORACLE_H = 130;

// Internal card row heights
const CARD_HEADER_H = 32;
const ROW_H = 28;
const ROW_PAD_X = 12;

// Arrow geometry
const ARROW_HEAD = 7;

// Badge dimensions
const BADGE_H = 30;
const BADGE_RADIUS = 8;

// Verdict badge
const VERDICT_H = 34;
const VERDICT_RADIUS = 8;

/* ── Palette ─────────────────────────────────────────────────────────── */

// Zinc
const ZINC_900 = '#09090b';
const ZINC_800 = '#111113'; // unused but kept for reference
void ZINC_800;
const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_500 = '#52525b';
const ZINC_400 = '#71717a';
const ZINC_300 = '#a1a1aa';
const ZINC_100 = '#e4e4e7';

// Semantic
const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';
const COLOR_ACTIVE_BORDER = '#a1a1aa';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function bstr(v: bigint): string {
  return v.toString();
}

/** Format a degree-1 polynomial [c0, c1] as "c0 + c1·x" or just "c0". */
function formatPoly(coeffs: bigint[], p: bigint): string {
  if (coeffs.length === 0) return '0';
  const c0 = coeffs[0] ?? 0n;
  const c1 = coeffs[1] ?? 0n;
  if (c1 === 0n) return bstr(c0);
  if (c0 === 0n) return `${bstr(c1)}\u00b7x`;
  // keep short so it fits in a card
  const c1Str = bstr(c1 % p);
  const c0Str = bstr(c0 % p);
  return `${c0Str} + ${c1Str}\u00b7x`;
}

/** Draw a horizontal dashed separator inside a card. */
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

/** Draw a single key=value row inside a card. */
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
  // Optional tinted background for pass/fail rows
  if (highlight) {
    const bg = highlight === 'pass'
      ? hexToRgba(COLOR_SUCCESS, 0.08)
      : hexToRgba(COLOR_ERROR, 0.08);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, ROW_H);
  }

  // Label (left)
  ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + ROW_PAD_X, y + ROW_H / 2);

  // Value (right) — colored for pass/fail status indicators
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

/** Draw a horizontal connection arrow between two horizontal points. */
function drawHorizArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
  color: string,
  label?: string,
  isDark?: boolean,
): void {
  if (x2 <= x1 + 4) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - ARROW_HEAD, y);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 - ARROW_HEAD, y - ARROW_HEAD * 0.55);
  ctx.lineTo(x2 - ARROW_HEAD, y + ARROW_HEAD * 0.55);
  ctx.closePath();
  ctx.fill();

  // Optional midpoint label
  if (label) {
    const midX = (x1 + x2) / 2;
    ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, midX, y - 4);
  }
}

/* ── Round card ──────────────────────────────────────────────────────── */

/**
 * Draw one round card at (x, y).
 * Returns the y-center of the "g_i(r_i)" output row so the caller
 * can draw the connection arrow to the next card.
 */
function drawRoundCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  round: SumcheckRound,
  isActive: boolean,
  isComplete: boolean,
  isDark: boolean,
  t: number,
): { outputY: number; inputY: number } {
  const p = round.univariatePoly;

  // ── Card background ───────────────────────────────────────────────
  const borderAlpha = isActive ? (0.7 + 0.3 * Math.sin(t * 2.8)) : (isComplete ? 0.45 : 0.2);
  const borderColor = isActive
    ? hexToRgba(COLOR_ACTIVE_BORDER, borderAlpha)
    : isComplete
      ? hexToRgba(ZINC_500, borderAlpha)
      : hexToRgba(ZINC_600, borderAlpha);

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.55 : 0.85);
  drawRoundedRect(ctx, x, y, CARD_W, CARD_H, CARD_RADIUS);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isActive ? 1.5 : 1;
  drawRoundedRect(ctx, x, y, CARD_W, CARD_H, CARD_RADIUS);
  ctx.stroke();

  // ── Header ─────────────────────────────────────────────────────
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

  // Round label "Round i"
  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Round ${round.roundNumber}`, x + ROW_PAD_X, y + CARD_HEADER_H / 2);

  // Compact poly string on right side of header
  const polyStr = formatPoly(p, round.expectedSum);
  ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(polyStr, x + CARD_W - ROW_PAD_X, y + CARD_HEADER_H / 2);

  // ── Body rows ─────────────────────────────────────────────────
  let rowY = y + CARD_HEADER_H;

  // Expected sum row
  const inputY = rowY + ROW_H / 2; // vertical midpoint — for incoming arrow
  drawCardRow(ctx, x, rowY, CARD_W, 'expected', bstr(round.expectedSum), isDark);
  rowY += ROW_H;

  drawCardDivider(ctx, x, rowY, CARD_W, isDark);

  // g_i(0) and g_i(1)
  drawCardRow(ctx, x, rowY, CARD_W, 'g(0)', bstr(round.evalAt0), isDark);
  rowY += ROW_H;
  drawCardRow(ctx, x, rowY, CARD_W, 'g(1)', bstr(round.evalAt1), isDark);
  rowY += ROW_H;

  // Sum check row
  const sumCheckLabel = 'g(0)+g(1)';
  const sumCheckValue = round.sumCheck ? '\u2713 pass' : '\u2717 fail';
  drawCardRow(ctx, x, rowY, CARD_W, sumCheckLabel, sumCheckValue, isDark, round.sumCheck ? 'pass' : 'fail');
  rowY += ROW_H;

  drawCardDivider(ctx, x, rowY, CARD_W, isDark);

  // Challenge
  const challengeStr = round.challenge !== null ? `r = ${bstr(round.challenge)}` : '—';
  drawCardRow(ctx, x, rowY, CARD_W, 'challenge', challengeStr, isDark);
  rowY += ROW_H;

  // g(r) output row — this is the "output" the arrow leaves from
  const outputY = rowY + ROW_H / 2;
  const evalStr = round.evalAtChallenge !== null ? bstr(round.evalAtChallenge) : '—';
  drawCardRow(ctx, x, rowY, CARD_W, 'g(r)', evalStr, isDark);

  return { outputY, inputY };
}

/* ── Oracle card ─────────────────────────────────────────────────────── */

function drawOracleCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lastRound: SumcheckRound | undefined,
  challenges: bigint[],
  oracleValue: bigint | null,
  isActive: boolean,
  isDark: boolean,
  t: number,
): { inputY: number } {
  const borderAlpha = isActive ? (0.7 + 0.3 * Math.sin(t * 2.8)) : 0.3;
  const oraclePassed = lastRound !== null &&
    lastRound !== undefined &&
    oracleValue !== null &&
    lastRound.evalAtChallenge !== null &&
    oracleValue === lastRound.evalAtChallenge;

  const accentColor = oraclePassed
    ? COLOR_SUCCESS
    : (lastRound && oracleValue !== null && !oraclePassed ? COLOR_ERROR : ZINC_400);

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.55 : 0.85);
  drawRoundedRect(ctx, x, y, ORACLE_W, ORACLE_H, CARD_RADIUS);
  ctx.fill();

  ctx.strokeStyle = isActive
    ? hexToRgba(accentColor, borderAlpha)
    : hexToRgba(ZINC_600, 0.3);
  ctx.lineWidth = isActive ? 1.5 : 1;
  drawRoundedRect(ctx, x, y, ORACLE_W, ORACLE_H, CARD_RADIUS);
  ctx.stroke();

  // Header
  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : ZINC_300, 0.4);
  ctx.beginPath();
  ctx.moveTo(x + CARD_RADIUS, y);
  ctx.lineTo(x + ORACLE_W - CARD_RADIUS, y);
  ctx.quadraticCurveTo(x + ORACLE_W, y, x + ORACLE_W, y + CARD_RADIUS);
  ctx.lineTo(x + ORACLE_W, y + CARD_HEADER_H);
  ctx.lineTo(x, y + CARD_HEADER_H);
  ctx.lineTo(x, y + CARD_RADIUS);
  ctx.quadraticCurveTo(x, y, x + CARD_RADIUS, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Oracle Check', x + ROW_PAD_X, y + CARD_HEADER_H / 2);

  let rowY = y + CARD_HEADER_H;

  // "g_n(r_n)" row
  const inputY = rowY + ROW_H / 2;
  const gnStr = lastRound?.evalAtChallenge !== null && lastRound?.evalAtChallenge !== undefined
    ? bstr(lastRound.evalAtChallenge)
    : '—';
  drawCardRow(ctx, x, rowY, ORACLE_W, 'g\u2099(r\u2099)', gnStr, isDark);
  rowY += ROW_H;

  drawCardDivider(ctx, x, rowY, ORACLE_W, isDark);

  // Oracle point: f(r_1,...,r_n) row
  const challengePoint = challenges.length > 0
    ? `(${challenges.slice(0, 3).map(bstr).join(',')}${challenges.length > 3 ? ',\u2026' : ''})`
    : '—';
  drawCardRow(ctx, x, rowY, ORACLE_W, 'f' + challengePoint, oracleValue !== null ? bstr(oracleValue) : '?', isDark);
  rowY += ROW_H;

  drawCardDivider(ctx, x, rowY, ORACLE_W, isDark);

  // Match row
  const matchHl: 'pass' | 'fail' | null =
    oracleValue !== null && lastRound !== undefined && lastRound.evalAtChallenge !== null
      ? (oraclePassed ? 'pass' : 'fail')
      : null;
  const matchVal = matchHl === 'pass' ? '\u2713 match' : matchHl === 'fail' ? '\u2717 mismatch' : '—';
  drawCardRow(ctx, x, rowY, ORACLE_W, 'result', matchVal, isDark, matchHl);

  return { inputY };
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderSumcheck(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: SumcheckRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height, time } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const t = time;
  const isDark = theme === 'dark';
  const n = state.numVariables;

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
  // Total width needed: n round cards + 1 oracle card + arrows between them.
  // We center the whole row horizontally.
  const cardCount = n + 1; // n rounds + oracle
  const totalW = cardCount * CARD_W + (cardCount - 1) * CARD_GAP;
  const startX = width / 2 - totalW / 2;

  // Vertically: leave ~60px at top for header badge, rest centered.
  const topPadding = 70;
  const bottomPadding = 60;
  const availH = height - topPadding - bottomPadding;
  const cardY = topPadding + Math.max(0, (availH - CARD_H) / 2);

  // Oracle card is shorter; vertically center it with the round cards.
  const oracleY = cardY + (CARD_H - ORACLE_H) / 2;

  // ── Draw round cards + connecting arrows ─────────────────────────
  const roundOutputYs: number[] = [];
  const roundInputYs: number[] = [];

  for (let i = 0; i < n; i++) {
    const round = state.rounds[i];
    const cardX = startX + i * (CARD_W + CARD_GAP);
    const isActive = state.currentRound === i + 1;
    const isComplete = state.currentRound > i + 1 || state.phase === 'complete';

    if (!round) {
      // Placeholder card for rounds not yet computed
      ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', 0.25);
      drawRoundedRect(ctx, cardX, cardY, CARD_W, CARD_H, CARD_RADIUS);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(ZINC_600, 0.15);
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, cardX, cardY, CARD_W, CARD_H, CARD_RADIUS);
      ctx.stroke();

      // Round label on placeholder
      ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.4);
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Round ${i + 1}`, cardX + CARD_W / 2, cardY + CARD_H / 2);

      roundOutputYs.push(cardY + CARD_H / 2);
      roundInputYs.push(cardY + CARD_HEADER_H + ROW_H / 2);
      continue;
    }

    const { outputY, inputY } = drawRoundCard(
      ctx, cardX, cardY, round, isActive, isComplete, isDark, t,
    );
    roundOutputYs.push(outputY);
    roundInputYs.push(inputY);
  }

  // Oracle card
  const oracleX = startX + n * (CARD_W + CARD_GAP);
  const isOracleActive = state.currentRound === n + 1 || state.phase === 'complete';

  // Compute oracle value from rounds if all are complete
  const lastRound = state.rounds[n - 1];
  const oracleValue: bigint | null =
    state.phase === 'complete' || isOracleActive
      ? (lastRound?.evalAtChallenge ?? null)
      : null;

  const { inputY: oracleInputY } = drawOracleCard(
    ctx,
    oracleX,
    oracleY,
    lastRound,
    state.rounds.map(r => r.challenge ?? 0n).filter((_, i) => i < state.rounds.length && state.rounds[i]?.challenge !== null),
    oracleValue,
    isOracleActive,
    isDark,
    t,
  );

  // ── Arrows between cards ───────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const fromCardX = startX + i * (CARD_W + CARD_GAP) + CARD_W;
    const toCardX = startX + (i + 1) * (CARD_W + CARD_GAP);

    const fromY = roundOutputYs[i] ?? (cardY + CARD_H * 0.75);
    const toY = i < n - 1
      ? (roundInputYs[i + 1] ?? (cardY + CARD_HEADER_H + ROW_H / 2))
      : oracleInputY;

    // Draw a bent arrow: exit card → right, then down/up to next card entry
    const midX = (fromCardX + toCardX) / 2;
    const arrowColor = isDark ? ZINC_500 : ZINC_400;

    if (Math.abs(fromY - toY) < 2) {
      // Straight horizontal arrow
      drawHorizArrow(ctx, fromCardX + 2, fromY, toCardX - 2, hexToRgba(arrowColor, 0.7), undefined, isDark);
    } else {
      // Elbow arrow: horizontal segment → vertical → horizontal to card
      ctx.strokeStyle = hexToRgba(arrowColor, 0.6);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(fromCardX + 2, fromY);
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
      ctx.lineTo(toCardX - ARROW_HEAD - 2, toY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = hexToRgba(arrowColor, 0.6);
      ctx.beginPath();
      ctx.moveTo(toCardX - 2, toY);
      ctx.lineTo(toCardX - 2 - ARROW_HEAD, toY - ARROW_HEAD * 0.55);
      ctx.lineTo(toCardX - 2 - ARROW_HEAD, toY + ARROW_HEAD * 0.55);
      ctx.closePath();
      ctx.fill();

      // Small label "g(r)" floating above the elbow midpoint
      const round = state.rounds[i];
      if (round?.evalAtChallenge !== null && round?.evalAtChallenge !== undefined) {
        const labelX = midX;
        const labelY = (fromY + toY) / 2;
        ctx.fillStyle = hexToRgba(isDark ? ZINC_300 : ZINC_500, 0.75);
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bstr(round.evalAtChallenge), labelX + 10, labelY);
      }
    }
  }

  // ── Screen-space overlays ─────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Header badge ─────────────────────────────────────────────────
  const headerText = `Sumcheck Protocol \u2014 ${n} variable${n !== 1 ? 's' : ''} over GF(${bstr(state.fieldSize)})`;
  ctx.font = '11px monospace';
  const maxBadgeW = width - 180;
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
  ctx.fillText(headerText, width / 2, headerY + BADGE_H / 2, headerW - 24);

  // Claimed sum sub-label
  ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.8);
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`claimed sum = ${bstr(state.claimedSum)}`, width / 2, headerY + BADGE_H + 10);

  // ── Verdict badge ─────────────────────────────────────────────────
  if (state.verdict !== null) {
    const isHonest = state.verdict === 'honest';
    const verdictText = isHonest ? '\u2713 HONEST: Verified' : '\u2717 CHEATING CAUGHT';
    const verdictColor = isHonest ? COLOR_SUCCESS : COLOR_ERROR;

    ctx.font = 'bold 13px monospace';
    const verdictW = ctx.measureText(verdictText).width + 48;
    const verdictX = width / 2 - verdictW / 2;
    const verdictY = height - VERDICT_H - 16;

    // Tinted background
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
  } else if (state.phase === 'proving' || state.phase === 'verifying') {
    // Phase indicator while in-progress
    const phaseText = state.phase === 'proving' ? 'Prover computing rounds\u2026' : 'Verifier checking\u2026';
    ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.9);
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phaseText, width / 2, height - 24);
  }

  ctx.restore();
}
