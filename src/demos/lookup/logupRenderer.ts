import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { LogUpResult } from './logup';

/* ── types ─────────────────────────────────────────────────── */

export interface LogUpRenderState {
  tableValues: bigint[];
  wireValues: bigint[];
  beta: bigint;
  fieldSize: bigint;
  result: LogUpResult | null;
  activeStep: number;
}

/* ── palette ───────────────────────────────────────────────── */

const ZINC = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

const GREEN = '#22c55e';
const RED = '#ef4444';

/* ── main render ───────────────────────────────────────────── */

export function renderLogUp(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: LogUpRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';
  const { tableValues, wireValues, beta, fieldSize, result, activeStep } = state;

  // ── background ──────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? ZINC[950] : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : ZINC[50]);
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

  // ── badge ───────────────────────────────────────────────
  const badgeText = `LogUp — ${wireValues.length} wires, ${tableValues.length} table entries, β=${beta}, GF(${fieldSize})`;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = isDark ? ZINC[200] : ZINC[700];
  ctx.fillText(badgeText, 72, 36);

  if (!result) {
    ctx.font = '12px monospace';
    ctx.fillStyle = isDark ? ZINC[500] : ZINC[400];
    ctx.fillText('Press "Run LogUp Check" to compute the argument.', 72, 72);
    return;
  }

  // ── layout constants ────────────────────────────────────
  const colTop = 80;
  const rowH = 38;
  const wireColW = 220;
  const tableColW = 260;
  const centerGap = 120;
  const leftX = 72;
  const rightX = leftX + wireColW + centerGap;
  const centerX = leftX + wireColW + centerGap / 2;

  const invalidSet = new Set(result.invalidWires);

  // ── wire column ─────────────────────────────────────────
  drawColumnBox(ctx, leftX, colTop, wireColW, wireValues.length, rowH, 'Wire Side', isDark, isDark ? ZINC[400] : ZINC[500]);

  for (let i = 0; i < wireValues.length; i++) {
    const y = colTop + 36 + i * rowH;
    const isInvalid = invalidSet.has(i);
    const rowColor = isInvalid ? RED : (isDark ? ZINC[300] : ZINC[600]);

    // value label
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rowColor;
    ctx.fillText(`w${subscript(i)} = ${wireValues[i]}`, leftX + 12, y + rowH / 2 - 2);

    // fraction
    ctx.font = '10px monospace';
    ctx.fillStyle = isInvalid
      ? hexToRgba(RED, 0.7)
      : (isDark ? ZINC[500] : ZINC[400]);
    const fracText = isInvalid
      ? 'not in table'
      : `1/(${beta}+${wireValues[i]}) = ${result.wireFractions[i]}`;
    ctx.fillText(fracText, leftX + 12, y + rowH / 2 + 12);

    // row separator
    if (i < wireValues.length - 1) {
      ctx.strokeStyle = hexToRgba(isDark ? ZINC[700] : ZINC[300], 0.5);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(leftX + 8, y + rowH);
      ctx.lineTo(leftX + wireColW - 8, y + rowH);
      ctx.stroke();
    }
  }

  // wire sum
  const wireSumY = colTop + 36 + wireValues.length * rowH + 8;
  drawSumBox(ctx, leftX, wireSumY, wireColW, `Σ 1/(β+wᵢ) = ${result.wireSum}`, isDark, isDark ? ZINC[400] : ZINC[500]);

  // ── table column ────────────────────────────────────────
  drawColumnBox(ctx, rightX, colTop, tableColW, tableValues.length, rowH, 'Table Side', isDark, isDark ? ZINC[200] : ZINC[700]);

  for (let i = 0; i < tableValues.length; i++) {
    const y = colTop + 36 + i * rowH;
    const m = result.multiplicities.get(tableValues[i]!) ?? 0;
    const dimmed = m === 0;
    const rowColor = dimmed
      ? (isDark ? ZINC[700] : ZINC[300])
      : (isDark ? ZINC[200] : ZINC[700]);

    // value + multiplicity label
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rowColor;
    ctx.fillText(`t${subscript(i)} = ${tableValues[i]}`, rightX + 12, y + rowH / 2 - 2);

    ctx.font = '10px monospace';
    ctx.fillStyle = dimmed
      ? (isDark ? ZINC[800] : ZINC[300])
      : (isDark ? ZINC[500] : ZINC[400]);
    const mText = `m=${m}  →  ${m}/(${beta}+${tableValues[i]}) = ${result.tableFractions[i]}`;
    ctx.fillText(mText, rightX + 12, y + rowH / 2 + 12);

    // row separator
    if (i < tableValues.length - 1) {
      ctx.strokeStyle = hexToRgba(isDark ? ZINC[700] : ZINC[300], 0.5);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(rightX + 8, y + rowH);
      ctx.lineTo(rightX + tableColW - 8, y + rowH);
      ctx.stroke();
    }
  }

  // table sum
  const tableSumY = colTop + 36 + tableValues.length * rowH + 8;
  drawSumBox(ctx, rightX, tableSumY, tableColW, `Σ mⱼ/(β+tⱼ) = ${result.tableSum}`, isDark, isDark ? ZINC[200] : ZINC[700]);

  // ── center balance ──────────────────────────────────────
  const maxRows = Math.max(wireValues.length, tableValues.length);
  const balanceCenterY = colTop + 36 + (maxRows * rowH) / 2;
  const satisfied = result.satisfied;
  const balanceColor = satisfied ? GREEN : RED;

  // equals / not-equals sign
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = balanceColor;
  ctx.fillText(satisfied ? '=' : '≠', centerX, balanceCenterY);

  // label
  ctx.font = '10px monospace';
  ctx.fillStyle = hexToRgba(balanceColor, 0.8);
  ctx.fillText(satisfied ? 'BALANCED' : 'UNBALANCED', centerX, balanceCenterY + 24);

  // glow ring around the balance symbol
  const glowRadius = 24 + Math.sin(frame.time * 2) * 3;
  ctx.beginPath();
  ctx.arc(centerX, balanceCenterY, glowRadius, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(balanceColor, isDark ? 0.2 : 0.15);
  ctx.lineWidth = 2;
  ctx.stroke();

  // connecting lines from columns to center
  ctx.strokeStyle = hexToRgba(balanceColor, isDark ? 0.15 : 0.1);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(leftX + wireColW, balanceCenterY);
  ctx.lineTo(centerX - glowRadius - 4, balanceCenterY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX + glowRadius + 4, balanceCenterY);
  ctx.lineTo(rightX, balanceCenterY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── pass/fail badge ─────────────────────────────────────
  const badgeBoxX = rightX + tableColW + 24;
  const badgeBoxY = colTop;
  const badgeW = 130;
  const badgeH = 44;
  drawRoundedRect(ctx, badgeBoxX, badgeBoxY, badgeW, badgeH, 6);
  ctx.fillStyle = hexToRgba(balanceColor, isDark ? 0.1 : 0.07);
  ctx.fill();
  drawRoundedRect(ctx, badgeBoxX, badgeBoxY, badgeW, badgeH, 6);
  ctx.strokeStyle = hexToRgba(balanceColor, isDark ? 0.6 : 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = balanceColor;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(satisfied ? '✓ SATISFIED' : '✗ FAILED', badgeBoxX + badgeW / 2, badgeBoxY + badgeH / 2);

  // ── step cards ──────────────────────────────────────────
  const stepsY = Math.max(wireSumY, tableSumY) + 54;
  const stepsX = 72;
  const stepsW = rightX + tableColW - 72;

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = isDark ? ZINC[300] : ZINC[600];
  ctx.fillText('PROTOCOL STEPS', stepsX, stepsY);

  for (let i = 0; i < result.steps.length; i++) {
    const step = result.steps[i]!;
    const sy = stepsY + 22 + i * 44;
    const isActive = i <= activeStep;
    const opacity = isActive ? 1 : 0.35;

    // step card background
    drawRoundedRect(ctx, stepsX, sy, stepsW, 38, 5);
    ctx.fillStyle = hexToRgba(isDark ? ZINC[800] : ZINC[100], opacity);
    ctx.fill();
    drawRoundedRect(ctx, stepsX, sy, stepsW, 38, 5);
    ctx.strokeStyle = hexToRgba(isDark ? ZINC[700] : ZINC[300], opacity * 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();

    // step number
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = hexToRgba(isDark ? ZINC[400] : ZINC[500], opacity);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, stepsX + 12, sy + 19);

    // step name
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = hexToRgba(isDark ? ZINC[200] : ZINC[700], opacity);
    ctx.fillText(step.stepName, stepsX + 32, sy + 12);

    // step description
    ctx.font = '10px monospace';
    ctx.fillStyle = hexToRgba(isDark ? ZINC[500] : ZINC[400], opacity);
    ctx.fillText(step.description, stepsX + 32, sy + 26);
  }
}

/* ── helpers ───────────────────────────────────────────────── */

function subscript(i: number): string {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return String(i).split('').map(c => subs[Number(c)] ?? c).join('');
}

function drawColumnBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  rowCount: number,
  rowH: number,
  title: string,
  isDark: boolean,
  accent: string,
): void {
  const h = Math.max(120, 36 + rowCount * rowH + 8);

  // background
  drawRoundedRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = hexToRgba(isDark ? '#111113' : '#ffffff', 0.96);
  ctx.fill();

  // border
  drawRoundedRect(ctx, x, y, w, h, 6);
  ctx.strokeStyle = hexToRgba(accent, isDark ? 0.4 : 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // header bar
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + w - 6, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + 6);
  ctx.lineTo(x + w, y + 30);
  ctx.lineTo(x, y + 30);
  ctx.lineTo(x, y + 6);
  ctx.quadraticCurveTo(x, y, x + 6, y);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(accent, isDark ? 0.1 : 0.08);
  ctx.fill();
  ctx.restore();

  // title
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.fillText(title, x + 12, y + 16);
}

function drawSumBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  text: string,
  isDark: boolean,
  accent: string,
): void {
  drawRoundedRect(ctx, x, y, w, 32, 5);
  ctx.fillStyle = hexToRgba(accent, isDark ? 0.08 : 0.06);
  ctx.fill();
  drawRoundedRect(ctx, x, y, w, 32, 5);
  ctx.strokeStyle = hexToRgba(accent, isDark ? 0.3 : 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.fillText(text, x + 12, y + 16);
}
