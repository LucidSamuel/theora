import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { hexToRgba } from '@/lib/canvas';
import type {
  NaiveStep,
  AccumulatedStep,
  Settlement,
} from './logic';

// ── Layout constants ───────────────────────────────────────────────

const ACCENT_NAIVE = '#ef4444';
const ACCENT_ACCUM = '#22c55e';
const ACCENT_FOLD = '#a78bfa';

const PANEL_GAP = 48;
const STEP_W = 130;
const STEP_H = 44;
const STEP_GAP = 14;
const ACC_BOX_W = 90;
const ACC_BOX_H = 56;
const COST_BAR_MAX_W = 110;
const COST_BAR_H = 12;
const HEADER_Y = 22;

// ── Main renderer ──────────────────────────────────────────────────

export function renderSplitAccumulation(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  naiveSteps: NaiveStep[],
  accumulatedSteps: AccumulatedStep[],
  currentStep: number,
  settlement: Settlement | null,
  msmBaseCost: number,
  showCostComparison: boolean,
  isDark: boolean
) {
  const { width, height, time } = frame;
  const numSteps = naiveSteps.length;

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const textMuted = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
  const borderBase = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const cx = width / 2;

  // ── Panel layout ──
  const panelW = (width - PANEL_GAP - 80) / 2;
  const leftX = cx - PANEL_GAP / 2 - panelW;
  const rightX = cx + PANEL_GAP / 2;
  const naiveCircuitMax = naiveSteps[numSteps - 1]?.circuitCost ?? Math.max(msmBaseCost, 1);

  const stepsTop = HEADER_Y + 50;

  // ── Divider ──
  ctx.strokeStyle = borderBase;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, HEADER_Y + 30);
  ctx.lineTo(cx, height - 20);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Panel headers ──
  ctx.textAlign = 'center';
  ctx.font = '600 13px "Space Grotesk", sans-serif';

  ctx.fillStyle = hexToRgba(ACCENT_NAIVE, 0.9);
  ctx.fillText('Naive Recursion', leftX + panelW / 2, HEADER_Y);
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.fillText('Full MSM at every step', leftX + panelW / 2, HEADER_Y + 16);

  ctx.font = '600 13px "Space Grotesk", sans-serif';
  ctx.fillStyle = hexToRgba(ACCENT_ACCUM, 0.9);
  ctx.fillText('Split Accumulation', rightX + panelW / 2, HEADER_Y);
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.fillText('Cheap folds + one final MSM', rightX + panelW / 2, HEADER_Y + 16);

  // ── Draw naive steps ──
  for (let i = 0; i < numSteps; i++) {
    const step = naiveSteps[i]!;
    const y = stepsTop + i * (STEP_H + STEP_GAP);
    const isActive = i === currentStep;
    const isDone = i < currentStep;
    const isPending = i > currentStep;

    drawStepBox(ctx, leftX + 8, y, STEP_W, STEP_H, `Step ${i + 1}`, step.claim.commitment.slice(0, 8),
      isActive, isDone, isPending, ACCENT_NAIVE, textPrimary, textMuted, borderBase, time);

    // MSM cost bar
    const barX = leftX + 8 + STEP_W + 12;
    const barY = y + (STEP_H - COST_BAR_H) / 2;
    const barW = (step.circuitCost / naiveCircuitMax) * COST_BAR_MAX_W;

    if (!isPending) {
      ctx.fillStyle = hexToRgba(ACCENT_NAIVE, isDone ? 0.5 : 0.7);
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, COST_BAR_H, 3);
      ctx.fill();

      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = isDone ? textSecondary : textPrimary;
      ctx.textAlign = 'left';
      ctx.fillText(`${step.embeddedVerifierCount}x MSM`, barX + barW + 6, barY + COST_BAR_H - 2);
    }

    // Arrow to next step
    if (i < numSteps - 1 && !isPending) {
      const arrowX = leftX + 8 + STEP_W / 2;
      drawVerticalArrow(ctx, arrowX, y + STEP_H, arrowX, y + STEP_H + STEP_GAP,
        isDone ? hexToRgba(ACCENT_NAIVE, 0.3) : hexToRgba(ACCENT_NAIVE, 0.6));
    }
  }

  // ── Draw accumulated steps ──
  const accStepX = rightX + 8;
  const accBoxX = rightX + panelW - ACC_BOX_W - 8;

  for (let i = 0; i < numSteps; i++) {
    const step = accumulatedSteps[i]!;
    const y = stepsTop + i * (STEP_H + STEP_GAP);
    const isActive = i === currentStep;
    const isDone = i < currentStep;
    const isPending = i > currentStep;

    drawStepBox(ctx, accStepX, y, STEP_W, STEP_H, `Step ${i + 1}`, step.claim.commitment.slice(0, 8),
      isActive, isDone, isPending, ACCENT_ACCUM, textPrimary, textMuted, borderBase, time);

    // Field ops cost bar (small)
    const barX = accStepX + STEP_W + 12;
    const barY = y + (STEP_H - COST_BAR_H) / 2;
    const barW = (step.fieldOpsCost / (msmBaseCost + 12)) * COST_BAR_MAX_W;

    if (!isPending) {
      ctx.fillStyle = hexToRgba(ACCENT_ACCUM, isDone ? 0.4 : 0.7);
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(barW, 4), COST_BAR_H, 3);
      ctx.fill();

      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = isDone ? textSecondary : textPrimary;
      ctx.textAlign = 'left';
      ctx.fillText(`fold: ${step.fieldOpsCost}`, barX + Math.max(barW, 4) + 6, barY + COST_BAR_H - 2);
    }

    // Fold arrow to accumulator
    if (!isPending) {
      const fromY = y + STEP_H / 2;

      if (isActive || isDone) {
        drawFoldArrow(ctx, accStepX + STEP_W + COST_BAR_MAX_W + 44, fromY, accBoxX, fromY, isActive, time);
      }
    }
  }

  // ── Accumulator box ──
  const accY = stepsTop + Math.max(0, Math.min(currentStep, numSteps - 1)) * (STEP_H + STEP_GAP);
  const accBoxY = accY + (STEP_H - ACC_BOX_H) / 2;
  const foldedCount = currentStep >= 0
    ? (accumulatedSteps[Math.min(currentStep, numSteps - 1)]?.accumulator.foldedCount ?? 0)
    : 0;

  if (currentStep >= 0) {
    drawAccumulatorBox(ctx, accBoxX, accBoxY, ACC_BOX_W, ACC_BOX_H,
      foldedCount, settlement !== null, textPrimary, textSecondary, time);
  }

  // ── Settlement ──
  if (settlement) {
    const settlementY = stepsTop + numSteps * (STEP_H + STEP_GAP) + 10;
    drawSettlement(ctx, rightX + 8, settlementY, panelW - 16, 40,
      settlement, textSecondary, time);
  }

  // ── Cost comparison ──
  if (showCostComparison && currentStep >= 0) {
    const compY = stepsTop + numSteps * (STEP_H + STEP_GAP) + (settlement ? 70 : 20);
    drawCostComparison(ctx, 40, compY, width - 80,
      naiveSteps, accumulatedSteps, currentStep, settlement,
      textPrimary, textSecondary, isDark);
  }

  // ── Flow particles ──
  if (currentStep >= 0) {
    drawParticles(ctx, leftX + 8, rightX + 8, stepsTop, numSteps, currentStep, time);
  }
}

// ── Step box ───────────────────────────────────────────────────────

function drawStepBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, sublabel: string,
  isActive: boolean, isDone: boolean, isPending: boolean,
  accent: string,
  textPrimary: string, textMuted: string, borderBase: string,
  time: number
) {
  const r = 10;

  if (isActive) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
  }

  // Background
  ctx.fillStyle = isActive
    ? hexToRgba(accent, 0.1)
    : isDone
      ? hexToRgba(accent, 0.04)
      : 'rgba(255,255,255,0.02)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  // Border
  const borderAlpha = isActive ? 0.7 + 0.3 * Math.sin(time * 3) : isDone ? 0.4 : 0.1;
  ctx.strokeStyle = isPending ? borderBase : hexToRgba(accent, borderAlpha);
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Label
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.fillStyle = isPending ? textMuted : textPrimary;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 18);

  // Sublabel (commitment hash)
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = isPending ? textMuted : hexToRgba(accent, 0.6);
  ctx.fillText(`0x${sublabel}`, x + 12, y + 32);

  // Status indicator
  if (isDone) {
    ctx.font = '11px sans-serif';
    ctx.fillStyle = hexToRgba(accent, 0.8);
    ctx.textAlign = 'right';
    ctx.fillText('\u2713', x + w - 10, y + h / 2 + 4);
  }
}

// ── Accumulator box ────────────────────────────────────────────────

function drawAccumulatorBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  foldedCount: number,
  settled: boolean,
  textPrimary: string, textSecondary: string,
  time: number
) {
  const r = 12;
  const pulse = settled ? 0 : 0.15 * Math.sin(time * 2);
  const accent = settled ? '#22c55e' : ACCENT_FOLD;

  ctx.shadowColor = accent;
  ctx.shadowBlur = settled ? 12 : 8 + pulse * 40;

  ctx.fillStyle = hexToRgba(accent, 0.08 + pulse * 0.04);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(accent, 0.5 + pulse);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = '600 10px "Space Grotesk", sans-serif';
  ctx.fillStyle = hexToRgba(accent, 0.9);
  ctx.textAlign = 'center';
  ctx.fillText('Accumulator', x + w / 2, y + 18);

  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillStyle = textPrimary;
  ctx.fillText(`${foldedCount}`, x + w / 2, y + 36);

  ctx.font = '9px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.fillText(settled ? 'settled' : `claim${foldedCount === 1 ? '' : 's'} folded`, x + w / 2, y + 50);
}

// ── Settlement box ─────────────────────────────────────────────────

function drawSettlement(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  settlement: Settlement,
  textSecondary: string,
  time: number
) {
  const r = 10;
  const pulse = 0.8 + 0.2 * Math.sin(time * 2);

  ctx.fillStyle = hexToRgba(ACCENT_ACCUM, 0.06);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(ACCENT_ACCUM, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.fillStyle = hexToRgba(ACCENT_ACCUM, pulse);
  ctx.textAlign = 'left';
  ctx.fillText(`Final MSM: ${settlement.msmCost} gates`, x + 14, y + 16);

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.fillText(`One MSM settles ${settlement.foldedCount} deferred claim${settlement.foldedCount === 1 ? '' : 's'}`, x + 14, y + 32);

  ctx.font = '11px sans-serif';
  ctx.fillStyle = hexToRgba(ACCENT_ACCUM, 0.9);
  ctx.textAlign = 'right';
  ctx.fillText(settlement.verified ? '\u2713 verified' : '\u2717 failed', x + w - 14, y + 24);
}

// ── Cost comparison bar ────────────────────────────────────────────

function drawCostComparison(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  naiveSteps: NaiveStep[],
  accumulatedSteps: AccumulatedStep[],
  currentStep: number,
  settlement: Settlement | null,
  textPrimary: string, textSecondary: string,
  isDark: boolean
) {
  const clampedStep = Math.min(currentStep, naiveSteps.length - 1);

  // Calculate costs
  let naiveCost = 0;
  for (let i = 0; i <= clampedStep; i++) naiveCost += naiveSteps[i]!.circuitCost;

  let accFieldCost = 0;
  for (let i = 0; i <= clampedStep; i++) accFieldCost += accumulatedSteps[i]!.fieldOpsCost;
  const accMsmCost = settlement ? settlement.msmCost : 0;
  const accTotalCost = accFieldCost + accMsmCost;

  const maxCost = Math.max(naiveCost, accTotalCost, 1);

  // Panel background
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 80, 12);
  ctx.fill();
  ctx.stroke();

  // Title
  ctx.font = '600 10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.textAlign = 'left';
  ctx.fillText('COST COMPARISON', x + 16, y + 18);

  // Naive bar
  const barX = x + 120;
  const barMaxW = w - 200;
  const naiveBarW = (naiveCost / maxCost) * barMaxW;

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.textAlign = 'right';
  ctx.fillText('Naive:', barX - 8, y + 38);

  ctx.fillStyle = hexToRgba(ACCENT_NAIVE, 0.6);
  ctx.beginPath();
  ctx.roundRect(barX, y + 28, Math.max(naiveBarW, 2), 14, 3);
  ctx.fill();

  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillStyle = textPrimary;
  ctx.textAlign = 'left';
  ctx.fillText(`${naiveCost}`, barX + naiveBarW + 8, y + 40);

  // Accumulated bar (split: green for field ops, yellow-ish cap for MSM)
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.textAlign = 'right';
  ctx.fillText('Accum:', barX - 8, y + 62);

  const fieldBarW = (accFieldCost / maxCost) * barMaxW;
  const msmCapW = (accMsmCost / maxCost) * barMaxW;

  ctx.fillStyle = hexToRgba(ACCENT_ACCUM, 0.5);
  ctx.beginPath();
  ctx.roundRect(barX, y + 52, Math.max(fieldBarW, 2), 14, msmCapW > 0 ? [3, 0, 0, 3] : 3);
  ctx.fill();

  if (msmCapW > 0) {
    ctx.fillStyle = hexToRgba(ACCENT_NAIVE, 0.4);
    ctx.beginPath();
    ctx.roundRect(barX + fieldBarW, y + 52, Math.max(msmCapW, 2), 14, [0, 3, 3, 0]);
    ctx.fill();
  }

  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillStyle = textPrimary;
  ctx.textAlign = 'left';
  ctx.fillText(`${accTotalCost}`, barX + Math.max(fieldBarW + msmCapW, 4) + 8, y + 64);

  // Savings ratio
  if (naiveCost > 0 && accTotalCost > 0) {
    const ratio = naiveCost / accTotalCost;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = hexToRgba(ACCENT_ACCUM, 0.9);
    ctx.textAlign = 'right';
    ctx.fillText(`${ratio.toFixed(1)}x cheaper`, x + w - 16, y + 18);
  }
}

// ── Arrows and particles ───────────────────────────────────────────

function drawVerticalArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const headLen = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 3, y2 - headLen);
  ctx.lineTo(x2 + 3, y2 - headLen);
  ctx.closePath();
  ctx.fill();
}

function drawFoldArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  isActive: boolean, time: number
) {
  const alpha = isActive ? 0.4 + 0.2 * Math.sin(time * 3) : 0.2;
  ctx.strokeStyle = hexToRgba(ACCENT_FOLD, alpha);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  naiveBaseX: number, accumBaseX: number,
  stepsTop: number, numSteps: number,
  currentStep: number, time: number
) {
  // Naive panel: particles flowing down between completed steps
  for (let i = 0; i < Math.min(currentStep, numSteps - 1); i++) {
    const y1 = stepsTop + i * (STEP_H + STEP_GAP) + STEP_H;
    const y2 = y1 + STEP_GAP;
    const px = naiveBaseX + STEP_W / 2;

    for (let p = 0; p < 2; p++) {
      const t = ((time * 0.8 + p * 0.5 + i * 0.2) % 1);
      const py = y1 + (y2 - y1) * t;
      const alpha = Math.sin(t * Math.PI) * 0.6;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ACCENT_NAIVE, alpha);
      ctx.fill();
    }
  }

  // Accumulation panel: particles flowing into accumulator
  for (let i = 0; i < Math.min(currentStep + 1, numSteps); i++) {
    const y = stepsTop + i * (STEP_H + STEP_GAP) + STEP_H / 2;

    for (let p = 0; p < 2; p++) {
      const t = ((time * 0.6 + p * 0.5 + i * 0.3) % 1);
      const px = accumBaseX + STEP_W + 12 + t * (COST_BAR_MAX_W + 30);
      const alpha = Math.sin(t * Math.PI) * 0.5;
      ctx.beginPath();
      ctx.arc(px, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ACCENT_FOLD, alpha);
      ctx.fill();
    }
  }
}

// ── Bounds for fit-to-view ─────────────────────────────────────────

export function getSplitAccBounds(
  width: number,
  numSteps: number,
  settlement: Settlement | null,
  showCostComparison: boolean
): { minX: number; minY: number; maxX: number; maxY: number } {
  const stepsBottom = HEADER_Y + 50 + numSteps * (STEP_H + STEP_GAP);
  let bottomY = stepsBottom;
  if (settlement) bottomY += 70;
  if (showCostComparison) bottomY += 100;

  return {
    minX: 20,
    minY: 0,
    maxX: width - 20,
    maxY: bottomY,
  };
}
