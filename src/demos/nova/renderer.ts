import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, drawArrow, hexToRgba } from '@/lib/canvas';
import type { FoldingStep, R1CSMatrices } from './logic';

// ── Palette ──────────────────────────────────────────────────────────────────

const ZINC_900 = '#09090b';
const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_500 = '#52525b';
const ZINC_400 = '#71717a';
const ZINC_300 = '#a1a1aa';
const ZINC_100 = '#e4e4e7';
const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';
const COLOR_ACCENT = '#f59e0b'; // amber accent for nova

// ── Layout constants ─────────────────────────────────────────────────────────

const CARD_W = 150;
const CARD_H = 120;
const CARD_R = 10;
const HEADER_H = 30;
const MERGE_CARD_W = 170;
const MERGE_CARD_H = 140;
const STEP_GAP_X = 60;   // horizontal gap between fold steps
const CONVERGE_GAP_Y = 40; // vertical gap between instance cards and merge row
const ARROW_HEAD = 7;

// ── Render state ─────────────────────────────────────────────────────────────

export interface NovaRenderState {
  steps: FoldingStep[];
  currentStep: number;    // -1 = overview, 0..n-1 = specific step
  fieldSize: bigint;
  phase: 'setup' | 'folding' | 'complete';
  matrices: R1CSMatrices;
}

// ── Main render ──────────────────────────────────────────────────────────────

export function renderNova(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: NovaRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ──────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, isDark ? ZINC_900 : '#ffffff');
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

  // ── Screen-space title badge ────────────────────────────────────────────
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const stepCount = state.steps.length;
  const headerText = `Nova IVC \u2014 ${stepCount} folding step${stepCount !== 1 ? 's' : ''} over GF(${state.fieldSize})`;
  ctx.font = '11px monospace';
  const maxBadgeW = width - 180;
  const headerW = Math.min(ctx.measureText(headerText).width + 40, maxBadgeW);
  const headerX = width / 2 - headerW / 2;
  const headerY = 16;
  const BADGE_H = 30;
  const BADGE_RADIUS = 8;

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

  // Sub-label
  ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.8);
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Relaxed R1CS folding scheme', width / 2, headerY + BADGE_H + 10);

  ctx.restore();

  // ── Decide what to draw ─────────────────────────────────────────────────
  if (state.phase === 'setup' || state.steps.length === 0) {
    drawSetupView(ctx, width, height, state, isDark);
    return;
  }

  if (state.currentStep >= 0 && state.currentStep < state.steps.length) {
    drawStepDetail(ctx, width, height, state.steps[state.currentStep]!, state.currentStep, isDark);
  } else {
    drawChainView(ctx, width, height, state, isDark);
  }
}

// ── Setup view (no steps yet) ────────────────────────────────────────────────

function drawSetupView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: NovaRenderState,
  isDark: boolean,
): void {
  const cx = width / 2;
  const cy = height / 2;

  // Draw a single card representing the circuit
  const cw = 220;
  const ch = 130;
  const x = cx - cw / 2;
  const y = cy - ch / 2;

  drawInstanceCard(ctx, x, y, cw, ch, 'Circuit: f(x) = x\u00B2 + x + 5', isDark, true, [
    { label: 'Constraints', value: `${state.matrices.m}` },
    { label: 'Variables', value: `${state.matrices.n}` },
    { label: 'Field', value: `GF(${state.fieldSize})` },
    { label: 'Status', value: state.phase === 'setup' ? 'ready to fold' : 'idle' },
  ]);

  // Hint text
  ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.7);
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Press "Fold Step" or "Fold All" to begin IVC', cx, y + ch + 24);
}

// ── Step detail view (one fold shown in detail) ──────────────────────────────

function drawStepDetail(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step: FoldingStep,
  stepIndex: number,
  isDark: boolean,
): void {
  const centerX = width / 2;
  // Layout: two cards at the top converging to one card at the bottom
  const topY = height * 0.18;
  const spacing = CARD_W + 60;
  const leftX = centerX - spacing / 2 - CARD_W / 2;
  const rightX = centerX + spacing / 2 - CARD_W / 2;
  const mergeY = topY + CARD_H + CONVERGE_GAP_Y + 60;
  const mergeX = centerX - MERGE_CARD_W / 2;

  // Instance 1 (running accumulator)
  drawInstanceCard(ctx, leftX, topY, CARD_W, CARD_H,
    stepIndex === 0 ? 'Initial Instance' : 'Accumulator',
    isDark, false, [
      { label: 'u', value: `${step.instance1.u}` },
      { label: 'commit', value: `${step.instance1.commitment}` },
      { label: 'x', value: `[${step.instance1.x.map(String).join(', ')}]` },
    ]);

  // Instance 2 (new witness)
  drawInstanceCard(ctx, rightX, topY, CARD_W, CARD_H, 'New Instance', isDark, false, [
    { label: 'u', value: `${step.instance2.u}` },
    { label: 'commit', value: `${step.instance2.commitment}` },
    { label: 'x', value: `[${step.instance2.x.map(String).join(', ')}]` },
  ]);

  // Arrows from both instances converging to the merge
  const arrowColor = hexToRgba(isDark ? ZINC_300 : ZINC_500, 0.7);
  drawArrow(ctx,
    leftX + CARD_W / 2, topY + CARD_H + 2,
    centerX - 20, mergeY - 2,
    arrowColor, ARROW_HEAD,
  );
  drawArrow(ctx,
    rightX + CARD_W / 2, topY + CARD_H + 2,
    centerX + 20, mergeY - 2,
    arrowColor, ARROW_HEAD,
  );

  // Cross-term and challenge labels at the merge point
  const midArrowY = topY + CARD_H + (mergeY - topY - CARD_H) / 2;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Cross-term T on the left arrow
  ctx.fillStyle = COLOR_ACCENT;
  ctx.fillText(`T = [${step.crossTerm.map(String).join(', ')}]`, centerX - spacing / 3, midArrowY - 8);

  // Challenge r on the right arrow
  ctx.fillStyle = hexToRgba(isDark ? ZINC_100 : ZINC_700, 0.9);
  ctx.fillText(`r = ${step.challenge}`, centerX + spacing / 3, midArrowY - 8);

  // Merge symbol (circle with fold icon)
  ctx.beginPath();
  ctx.arc(centerX, mergeY - 14, 12, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(COLOR_ACCENT, 0.15);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(COLOR_ACCENT, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = COLOR_ACCENT;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u2227', centerX, mergeY - 14); // ∧ fold symbol

  // Folded instance card
  const foldedTitle = `Step ${stepIndex + 1} \u2014 Folded`;
  const statusColor = step.satisfied ? COLOR_SUCCESS : COLOR_ERROR;
  drawInstanceCard(ctx, mergeX, mergeY + 10, MERGE_CARD_W, MERGE_CARD_H, foldedTitle, isDark, step.satisfied, [
    { label: 'u\'', value: `${step.foldedInstance.u}` },
    { label: 'commit\'', value: `${step.foldedInstance.commitment}` },
    { label: 'x\'', value: `[${step.foldedInstance.x.map(String).join(', ')}]` },
    { label: 'E\'', value: `[${step.foldedWitness.E.map(String).join(', ')}]` },
  ]);

  // Satisfied badge below the folded card
  ctx.fillStyle = statusColor;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    step.satisfied ? '\u2713 Relaxed R1CS satisfied' : '\u2717 Relaxed R1CS violated',
    centerX, mergeY + 10 + MERGE_CARD_H + 12,
  );
}

// ── Chain view (overview of all folds) ───────────────────────────────────────

function drawChainView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: NovaRenderState,
  isDark: boolean,
): void {
  const steps = state.steps;
  const n = steps.length;
  if (n === 0) return;

  // Compute chain layout — each fold is a compact card in a horizontal row
  const miniW = 130;
  const miniH = 100;
  const gap = STEP_GAP_X;
  const totalW = n * miniW + (n - 1) * gap;
  const startX = (width - totalW) / 2;
  const rowY = (height - miniH) / 2;

  steps.forEach((step, i) => {
    const x = startX + i * (miniW + gap);
    const isActive = state.currentStep === i;
    const statusColor = step.satisfied ? COLOR_SUCCESS : COLOR_ERROR;

    // Card
    const borderColor = isActive
      ? (isDark ? ZINC_100 : ZINC_600)
      : (isDark ? ZINC_600 : ZINC_300);
    const bgAlpha = isActive ? 0.08 : 0.04;

    ctx.fillStyle = hexToRgba(isDark ? '#ffffff' : '#000000', bgAlpha);
    drawRoundedRect(ctx, x, rowY, miniW, miniH, 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(borderColor, isActive ? 0.8 : 0.4);
    ctx.lineWidth = isActive ? 2 : 1.2;
    drawRoundedRect(ctx, x, rowY, miniW, miniH, 8);
    ctx.stroke();

    // Header
    const headerBg = hexToRgba(statusColor, isActive ? 0.12 : 0.06);
    ctx.save();
    drawRoundedRect(ctx, x, rowY, miniW, 26, 8);
    ctx.clip();
    ctx.fillStyle = headerBg;
    ctx.fillRect(x, rowY, miniW, 26);
    ctx.restore();

    // Separator
    ctx.strokeStyle = hexToRgba(borderColor, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, rowY + 26);
    ctx.lineTo(x + miniW, rowY + 26);
    ctx.stroke();

    // Header label
    ctx.fillStyle = isDark ? '#fafafa' : ZINC_900;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Fold ${step.stepNumber}`, x + miniW / 2, rowY + 13);

    // Content
    let cy = rowY + 34;
    const cx = x + 8;
    const lineH = 14;
    const maxW = miniW - 16;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // u'
    ctx.font = '8px monospace';
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_400;
    ctx.fillText("u':", cx, cy);
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? ZINC_100 : ZINC_700;
    ctx.fillText(`${step.foldedInstance.u}`, cx + 20, cy, maxW - 20);
    cy += lineH;

    // r
    ctx.font = '8px monospace';
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_400;
    ctx.fillText('r:', cx, cy);
    ctx.font = '9px monospace';
    ctx.fillStyle = COLOR_ACCENT;
    ctx.fillText(`${step.challenge}`, cx + 20, cy, maxW - 20);
    cy += lineH;

    // E'
    ctx.font = '8px monospace';
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_400;
    ctx.fillText("E':", cx, cy);
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? ZINC_100 : ZINC_700;
    ctx.fillText(`[${step.foldedWitness.E.map(String).join(',')}]`, cx + 20, cy, maxW - 20);
    cy += lineH;

    // Status badge
    ctx.fillStyle = statusColor;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      step.satisfied ? '\u2713 satisfied' : '\u2717 violated',
      x + miniW / 2, cy + 4,
    );

    // Arrow to next step
    if (i < n - 1) {
      const arrowColor = hexToRgba(isDark ? ZINC_300 : ZINC_500, 0.6);
      drawArrow(ctx, x + miniW + 2, rowY + miniH / 2, x + miniW + gap - 2, rowY + miniH / 2, arrowColor, ARROW_HEAD);
    }
  });

  // Final status badge below chain
  const allSatisfied = steps.every(s => s.satisfied);
  const badgeY = rowY + miniH + 28;
  ctx.fillStyle = allSatisfied ? COLOR_SUCCESS : COLOR_ERROR;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    allSatisfied
      ? `\u2713 IVC complete \u2014 ${n} fold${n !== 1 ? 's' : ''}, all satisfied`
      : `\u2717 IVC chain broken \u2014 folding error detected`,
    width / 2, badgeY,
  );
}

// ── Instance card helper ─────────────────────────────────────────────────────

interface CardField {
  label: string;
  value: string;
}

function drawInstanceCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  isDark: boolean,
  satisfied: boolean | null,
  fields: CardField[],
): void {
  const borderColor = satisfied === true
    ? COLOR_SUCCESS
    : satisfied === false
      ? COLOR_ERROR
      : isDark ? ZINC_600 : ZINC_300;
  const borderAlpha = satisfied !== null ? 0.7 : 0.5;
  const bgAlpha = 0.06;

  // Background
  ctx.fillStyle = hexToRgba(isDark ? '#ffffff' : '#000000', bgAlpha);
  drawRoundedRect(ctx, x, y, w, h, CARD_R);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(borderColor, borderAlpha);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, h, CARD_R);
  ctx.stroke();

  // Header bar
  const headerColor = satisfied === true
    ? COLOR_SUCCESS
    : satisfied === false
      ? COLOR_ERROR
      : COLOR_ACCENT;
  ctx.save();
  drawRoundedRect(ctx, x, y, w, HEADER_H, CARD_R);
  ctx.clip();
  ctx.fillStyle = hexToRgba(headerColor, 0.1);
  ctx.fillRect(x, y, w, HEADER_H);
  ctx.restore();

  // Separator
  ctx.strokeStyle = hexToRgba(borderColor, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + HEADER_H);
  ctx.lineTo(x + w, y + HEADER_H);
  ctx.stroke();

  // Header text
  ctx.fillStyle = isDark ? '#fafafa' : ZINC_900;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + w / 2, y + HEADER_H / 2, w - 16);

  // Fields
  let cy = y + HEADER_H + 10;
  const cx = x + 10;
  const lineH = 16;
  const maxW = w - 20;

  ctx.textAlign = 'left';
  fields.forEach(({ label, value }) => {
    ctx.font = '8px monospace';
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_400;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy, maxW);
    cy += 11;
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? ZINC_100 : ZINC_700;
    ctx.fillText(value, cx, cy, maxW);
    cy += lineH;
  });
}
