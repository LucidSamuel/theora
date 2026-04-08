import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { IPARound } from './ipa';

/* ── Types ───────────────────────────────────────────────────────────── */

export interface IPARenderState {
  coefficients: bigint[];
  generators: bigint[];
  commitment: bigint;
  evalPoint: bigint;
  evalValue: bigint;
  rounds: IPARound[];
  currentRound: number; // -1 = overview, 0..logn-1 = active round
  phase: 'committed' | 'proving' | 'verified' | 'failed';
  fieldSize: bigint;
}

/* ── Layout constants ────────────────────────────────────────────────── */

const CARD_W = 280;
const CARD_H = 120;
const CARD_GAP = 24;
const CARD_RADIUS = 8;
const SMALL_BOX_H = 28;
const SMALL_BOX_R = 4;

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
): void {
  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.5 : 0.6);
  drawRoundedRect(ctx, x, y, w, SMALL_BOX_H, SMALL_BOX_R);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.4);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, w, SMALL_BOX_H, SMALL_BOX_R);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 8, y + SMALL_BOX_H / 2);

  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w - 8, y + SMALL_BOX_H / 2);
}

function drawRoundCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  round: IPARound,
  isActive: boolean,
  isDark: boolean,
  cardW: number = CARD_W,
): void {
  const alpha = isActive ? 1.0 : 0.5;

  // Card background
  ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#f4f4f5', alpha);
  drawRoundedRect(ctx, x, y, cardW, CARD_H, CARD_RADIUS);
  ctx.fill();

  // Card border
  const borderColor = isActive
    ? (isDark ? '#52525b' : '#a1a1aa')
    : (isDark ? '#27272a' : '#d4d4d8');
  ctx.strokeStyle = hexToRgba(borderColor, alpha);
  ctx.lineWidth = isActive ? 2 : 1;
  drawRoundedRect(ctx, x, y, cardW, CARD_H, CARD_RADIUS);
  ctx.stroke();

  // Round title
  ctx.fillStyle = hexToRgba(isDark ? '#a1a1aa' : '#52525b', alpha);
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`ROUND ${round.roundNumber}`, x + 12, y + 18);

  // Vector lengths
  const halfLen = round.aLeft.length;
  ctx.fillStyle = hexToRgba(isDark ? '#71717a' : '#a1a1aa', alpha);
  ctx.font = '9px monospace';
  ctx.fillText(`${halfLen * 2} \u2192 ${halfLen}`, x + cardW - 60, y + 18);

  // L and R cross products
  const rowY = y + 30;
  const halfW = (cardW - 36) / 2;
  drawValueBox(ctx, x + 12, rowY, halfW, 'L', bigStr(round.L), isDark);
  drawValueBox(ctx, x + 12 + halfW + 12, rowY, halfW, 'R', bigStr(round.R), isDark);

  // Challenge
  drawValueBox(ctx, x + 12, rowY + SMALL_BOX_H + 6, cardW - 24, 'u', bigStr(round.challenge), isDark);

  // New commitment
  drawValueBox(ctx, x + 12, rowY + 2 * (SMALL_BOX_H + 6), cardW - 24, "C'", bigStr(round.newCommitment), isDark);
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderIPA(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: IPARenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
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

  // ── Commitment box (top) ────────────────────────────────────────────
  const commitBoxW = 320;
  const commitBoxH = 80;
  const commitX = (width - commitBoxW) / 2;
  const commitY = 60;

  ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#f4f4f5', 0.9);
  drawRoundedRect(ctx, commitX, commitY, commitBoxW, commitBoxH, CARD_RADIUS);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.6);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, commitX, commitY, commitBoxW, commitBoxH, CARD_RADIUS);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('COMMITMENT', commitX + 16, commitY + 20);

  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`C = ${bigStr(state.commitment)}`, commitX + commitBoxW / 2, commitY + 42);

  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '10px monospace';
  ctx.fillText(
    `eval: p(${bigStr(state.evalPoint)}) \u2261 ${bigStr(state.evalValue)} (mod ${bigStr(state.fieldSize)})`,
    commitX + commitBoxW / 2,
    commitY + 62,
  );

  // ── Round cards ─────────────────────────────────────────────────────
  const numRounds = state.rounds.length;
  if (numRounds > 0) {
    const totalW = numRounds * CARD_W + (numRounds - 1) * CARD_GAP;
    const availableW = width - 80; // 40px margin on each side
    const scale = totalW > availableW ? availableW / totalW : 1;
    const effectiveCardW = Math.floor(CARD_W * scale);
    const effectiveGap = Math.floor(CARD_GAP * scale);
    const effectiveTotalW = numRounds * effectiveCardW + (numRounds - 1) * effectiveGap;
    const startX = Math.max(40, (width - effectiveTotalW) / 2);
    const cardsY = commitY + commitBoxH + 40;

    // Arrow from commitment to first card
    const arrowStartY = commitY + commitBoxH;
    const arrowEndY = cardsY;
    const arrowX = width / 2;
    ctx.strokeStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowStartY);
    ctx.lineTo(arrowX, arrowEndY - 8);
    ctx.stroke();
    // Arrowhead
    ctx.fillStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.5);
    ctx.beginPath();
    ctx.moveTo(arrowX - 5, arrowEndY - 12);
    ctx.lineTo(arrowX + 5, arrowEndY - 12);
    ctx.lineTo(arrowX, arrowEndY - 2);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < numRounds; i++) {
      const rx = startX + i * (effectiveCardW + effectiveGap);
      const isActive = state.currentRound === -1 || state.currentRound === i;
      drawRoundCard(ctx, rx, cardsY, state.rounds[i]!, isActive, isDark, effectiveCardW);

      // Arrow between cards
      if (i < numRounds - 1) {
        const fromX = rx + effectiveCardW;
        const toX = rx + effectiveCardW + effectiveGap;
        const arrowMidY = cardsY + CARD_H / 2;
        ctx.strokeStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.4);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fromX + 4, arrowMidY);
        ctx.lineTo(toX - 8, arrowMidY);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.4);
        ctx.beginPath();
        ctx.moveTo(toX - 12, arrowMidY - 4);
        ctx.lineTo(toX - 12, arrowMidY + 4);
        ctx.lineTo(toX - 4, arrowMidY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Final result box ──────────────────────────────────────────────
    if (state.phase === 'verified' || state.phase === 'failed') {
      const finalBoxW = 280;
      const finalBoxH = 64;
      const lastCardRight = startX + numRounds * (effectiveCardW + effectiveGap) - effectiveGap;
      const finalX = Math.max(startX, Math.min((startX + lastCardRight - finalBoxW) / 2, width - finalBoxW - 40));
      const finalY = cardsY + CARD_H + 40;

      const passed = state.phase === 'verified';
      const statusColor = passed ? '#22c55e' : '#ef4444';
      const statusBg = passed
        ? (isDark ? '#052e16' : '#dcfce7')
        : (isDark ? '#450a0a' : '#fef2f2');

      ctx.fillStyle = statusBg;
      drawRoundedRect(ctx, finalX, finalY, finalBoxW, finalBoxH, CARD_RADIUS);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(statusColor, 0.5);
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, finalX, finalY, finalBoxW, finalBoxH, CARD_RADIUS);
      ctx.stroke();

      // Arrow from last card to final box
      const midX = finalX + finalBoxW / 2;
      ctx.strokeStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', 0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midX, cardsY + CARD_H);
      ctx.lineTo(midX, finalY - 4);
      ctx.stroke();

      ctx.fillStyle = statusColor;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        passed ? 'VERIFIED' : 'VERIFICATION FAILED',
        finalX + finalBoxW / 2,
        finalY + 22,
      );

      const lastRound = state.rounds[numRounds - 1]!;
      ctx.fillStyle = hexToRgba(isDark ? '#a1a1aa' : '#52525b', 0.8);
      ctx.font = '10px monospace';
      ctx.fillText(
        `final a = ${bigStr(lastRound.newCoefficients[0]!)}, final G = ${bigStr(lastRound.newGenerators[0]!)}`,
        finalX + finalBoxW / 2,
        finalY + 44,
      );
    }
  } else {
    // No rounds yet — show waiting state
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Press "Prove" to run the IPA halving protocol', width / 2, commitY + commitBoxH + 60);
  }

  // ── Screen-space elements ────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Top badge
  const n = state.coefficients.length;
  const logn = Math.log2(n);
  const badgeText = `IPA — ${logn} halving rounds, GF(${bigStr(state.fieldSize)}), n = ${n}`;
  ctx.font = '11px monospace';
  const badgeW = ctx.measureText(badgeText).width + 40;
  const badgeX = width / 2 - badgeW / 2;
  const badgeY = 16;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.8);
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 28, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 28, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, badgeY + 14);

  ctx.restore();
}
