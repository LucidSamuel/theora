import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawArrow, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { PhaseData, Groth16Phase } from './logic';
import { PHASE_ORDER } from './logic';

// ── Layout constants ──────────────────────────────────────────────────────────

const BOX_W = 154;
const BOX_H = 188;
const BOX_GAP = 44;
const BOX_RADIUS = 12;
const HEADER_H = 36;

const PHASES: Groth16Phase[] = ['r1cs', 'qap', 'setup', 'prove', 'verify'];
const PHASE_TITLES: Record<string, string> = {
  r1cs:   'R1CS',
  qap:    'QAP',
  setup:  'Setup',
  prove:  'Prove',
  verify: 'Verify',
};

// ── Main render ───────────────────────────────────────────────────────────────

export function renderGroth16(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  data: PhaseData,
  showToxic: boolean,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ─────────────────────────────────────────────────────────────
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

  // ── Title ──────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to screen space for title
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Groth16 zkSNARK — f(x) = x² + x + 5', 24, 20);
  ctx.font = '11px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#71717a';
  ctx.fillText('Educational simulator over GF(101)', 24, 40);
  ctx.restore();

  // ── Pipeline boxes ─────────────────────────────────────────────────────────
  const totalW = PHASES.length * BOX_W + (PHASES.length - 1) * BOX_GAP;
  const startX = (width - totalW) / 2;
  const startY = (height - BOX_H) / 2;

  const activeOrder = PHASE_ORDER.indexOf(data.phase);

  PHASES.forEach((phase, i) => {
    const phaseOrder = PHASE_ORDER.indexOf(phase);
    const isActive    = data.phase === phase;
    const isCompleted = phaseOrder < activeOrder && activeOrder > 1;
    const isPending   = phaseOrder > activeOrder || data.phase === 'idle';

    const bx = startX + i * (BOX_W + BOX_GAP);
    const by = startY;

    const verifyFailed =
      phase === 'verify' &&
      data.verifyResult !== null &&
      !data.verifyResult.valid;
    const verifyPassed =
      phase === 'verify' &&
      data.verifyResult !== null &&
      data.verifyResult.valid;

    // Box border color
    let borderColor: string;
    if (verifyPassed)       borderColor = '#22c55e';
    else if (verifyFailed)  borderColor = '#ef4444';
    else if (isActive)      borderColor = isDark ? '#e4e4e7' : '#3f3f46';
    else if (isCompleted)   borderColor = isDark ? '#52525b' : '#a1a1aa';
    else                    borderColor = isDark ? '#27272a' : '#e4e4e7';

    const borderAlpha  = isActive ? 0.9 : isCompleted ? 0.55 : 0.35;
    const bgAlpha      = isActive ? 0.08 : isCompleted ? 0.04 : 0.02;

    // Box background
    ctx.fillStyle = hexToRgba(isDark ? '#ffffff' : '#000000', bgAlpha);
    drawRoundedRect(ctx, bx, by, BOX_W, BOX_H, BOX_RADIUS);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(borderColor, borderAlpha);
    ctx.lineWidth = isActive ? 2 : 1.5;
    drawRoundedRect(ctx, bx, by, BOX_W, BOX_H, BOX_RADIUS);
    ctx.stroke();

    // Active glow
    if (isActive) {
      ctx.save();
      ctx.shadowColor = hexToRgba(borderColor, 0.35);
      ctx.shadowBlur = 14;
      ctx.strokeStyle = hexToRgba(borderColor, 0.25);
      ctx.lineWidth = 6;
      drawRoundedRect(ctx, bx, by, BOX_W, BOX_H, BOX_RADIUS);
      ctx.stroke();
      ctx.restore();
    }

    // Header bar
    const headerAlpha = isActive ? 0.12 : isCompleted ? 0.07 : 0.04;
    ctx.fillStyle = hexToRgba(borderColor, headerAlpha);
    // Clip header to rounded top
    ctx.save();
    drawRoundedRect(ctx, bx, by, BOX_W, HEADER_H, BOX_RADIUS);
    ctx.clip();
    ctx.fillRect(bx, by, BOX_W, HEADER_H);
    ctx.restore();

    // Separator line between header and content
    ctx.strokeStyle = hexToRgba(borderColor, borderAlpha * 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by + HEADER_H);
    ctx.lineTo(bx + BOX_W, by + HEADER_H);
    ctx.stroke();

    // Header label
    ctx.fillStyle = isPending
      ? hexToRgba(isDark ? '#71717a' : '#a1a1aa', 0.8)
      : isDark ? '#fafafa' : '#09090b';
    ctx.font = `bold 12px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PHASE_TITLES[phase] ?? phase, bx + BOX_W / 2, by + HEADER_H / 2);

    // Completed checkmark (top-right corner)
    if (isCompleted) {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('✓', bx + BOX_W - 10, by + HEADER_H / 2 + 1);
    }

    // Content area
    const cx = bx + 12;
    let cy = by + HEADER_H + 14;
    const lineH = 17;
    const maxW  = BOX_W - 24;

    ctx.textAlign = 'left';

    if (isPending && data.phase !== phase) {
      ctx.fillStyle = hexToRgba(isDark ? '#71717a' : '#a1a1aa', 0.5);
      ctx.font = '10px monospace';
      ctx.fillText('waiting…', cx, cy);
      return;
    }

    switch (phase) {
      case 'r1cs':
        drawR1CSContent(ctx, cx, cy, lineH, maxW, data, isDark);
        break;
      case 'qap':
        drawQAPContent(ctx, cx, cy, lineH, maxW, data, isDark);
        break;
      case 'setup':
        drawSetupContent(ctx, cx, cy, lineH, maxW, data, isDark, showToxic);
        break;
      case 'prove':
        drawProveContent(ctx, cx, cy, lineH, maxW, data, isDark);
        break;
      case 'verify':
        drawVerifyContent(ctx, cx, cy, lineH, maxW, data, isDark);
        break;
    }
  });

  // ── Arrows between boxes ───────────────────────────────────────────────────
  PHASES.forEach((_phase, i) => {
    if (i === 0) return;
    const prevPhaseOrder = PHASE_ORDER.indexOf(PHASES[i - 1]!);
    const isFlowing = prevPhaseOrder < activeOrder;
    const arrowColor = isFlowing
      ? hexToRgba(isDark ? '#a1a1aa' : '#71717a', 0.7)
      : hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.5);

    const prevX = startX + (i - 1) * (BOX_W + BOX_GAP) + BOX_W;
    const curX  = startX + i * (BOX_W + BOX_GAP);
    const midY  = startY + BOX_H / 2;

    drawArrow(ctx, prevX + 4, midY, curX - 4, midY, arrowColor, 7);
  });
}

// ── Per-phase content painters ────────────────────────────────────────────────

function row(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  cx: number,
  cy: number,
  maxW: number,
  isDark: boolean,
  valueColor?: string,
): void {
  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);

  ctx.font = '10px monospace';
  ctx.fillStyle = valueColor ?? (isDark ? '#e4e4e7' : '#27272a');
  ctx.fillText(value, cx, cy + 12, maxW);
}

function drawR1CSContent(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, lineH: number, maxW: number,
  data: PhaseData, isDark: boolean,
): void {
  if (!data.r1cs) return;
  const { constraints, witness, satisfied } = data.r1cs;

  // Witness vector
  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.textBaseline = 'middle';
  ctx.fillText('witness w:', cx, cy);
  cy += 13;
  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.fillText(`[1, ${witness[1]}, ${witness[2]}, ${witness[3]}]`, cx, cy, maxW);
  cy += lineH + 4;

  constraints.forEach((con) => {
    const ok = data.r1cs?.satisfied;
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.fillText(con.label, cx, cy, maxW);
    cy += 13;
    ctx.font = '9px monospace';
    ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
    ctx.fillText(ok ? 'satisfied ✓' : 'unsatisfied ✗', cx, cy, maxW);
    cy += lineH;
  });

  cy += 4;
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = satisfied ? '#22c55e' : '#ef4444';
  ctx.fillText(satisfied ? 'all constraints pass' : 'constraint failure!', cx, cy, maxW);
}

function drawQAPContent(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, lineH: number, maxW: number,
  data: PhaseData, isDark: boolean,
): void {
  if (!data.qap) return;
  const { a_polys, b_polys, domain } = data.qap;

  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.textBaseline = 'middle';
  ctx.fillText(`domain: {${domain.join(', ')}}`, cx, cy, maxW);
  cy += lineH + 2;

  // Show first two A polys as illustration
  ctx.fillText('A-polys (first 2):', cx, cy, maxW);
  cy += 13;
  for (let i = 0; i < Math.min(2, a_polys.length); i++) {
    const p = a_polys[i]!;
    const terms = p.map((c, j) => j === 0 ? `${c}` : `${c}x${j > 1 ? '^' + j : ''}`).join('+');
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.fillText(`a${i}: ${terms}`, cx, cy, maxW);
    cy += 13;
  }
  cy += 4;

  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText('B-polys (first 2):', cx, cy, maxW);
  cy += 13;
  for (let i = 0; i < Math.min(2, b_polys.length); i++) {
    const p = b_polys[i]!;
    const terms = p.map((c, j) => j === 0 ? `${c}` : `${c}x${j > 1 ? '^' + j : ''}`).join('+');
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.fillText(`b${i}: ${terms}`, cx, cy, maxW);
    cy += 13;
  }
}

function drawSetupContent(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, lineH: number, maxW: number,
  data: PhaseData, isDark: boolean, showToxic: boolean,
): void {
  if (!data.setup) return;
  const { alpha, beta, gamma, delta, toxic } = data.setup;

  ctx.textBaseline = 'middle';
  row(ctx, 'α (alpha):', `${alpha}`, cx, cy, maxW, isDark);
  cy += lineH + 4;
  row(ctx, 'β (beta):', `${beta}`, cx, cy, maxW, isDark);
  cy += lineH + 4;
  row(ctx, 'γ (gamma):', `${gamma}`, cx, cy, maxW, isDark);
  cy += lineH + 4;
  row(ctx, 'δ (delta):', `${delta}`, cx, cy, maxW, isDark);
  cy += lineH + 8;

  if (showToxic) {
    ctx.font = '8px monospace';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚠ toxic waste', cx, cy, maxW);
    cy += 13;
    ctx.font = '8px monospace';
    ctx.fillStyle = hexToRgba('#ef4444', 0.8);
    ctx.fillText(toxic.slice(0, 28), cx, cy, maxW);
  } else {
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.fillText('[toxic waste hidden]', cx, cy, maxW);
  }
}

function drawProveContent(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, lineH: number, maxW: number,
  data: PhaseData, isDark: boolean,
): void {
  if (!data.proof) return;
  const { A, B, C, corrupted } = data.proof;

  ctx.textBaseline = 'middle';
  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText('π = (A, B, C)', cx, cy, maxW);
  cy += lineH + 4;

  const colorA = corrupted === 'A' ? '#ef4444' : (isDark ? '#e4e4e7' : '#27272a');
  const colorB = corrupted === 'B' ? '#ef4444' : (isDark ? '#e4e4e7' : '#27272a');
  const colorC = corrupted === 'C' ? '#ef4444' : (isDark ? '#e4e4e7' : '#27272a');

  row(ctx, 'A (G1):', `${A}`, cx, cy, maxW, isDark, colorA);
  cy += lineH + 4;
  row(ctx, 'B (G2):', `${B}`, cx, cy, maxW, isDark, colorB);
  cy += lineH + 4;
  row(ctx, 'C (G1):', `${C}`, cx, cy, maxW, isDark, colorC);
  cy += lineH + 8;

  if (corrupted) {
    ctx.font = '9px monospace';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`⚠ ${corrupted} corrupted`, cx, cy, maxW);
  } else {
    ctx.font = '9px monospace';
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.fillText('proof well-formed', cx, cy, maxW);
  }
}

function drawVerifyContent(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, lineH: number, maxW: number,
  data: PhaseData, isDark: boolean,
): void {
  if (!data.verifyResult) return;
  const { lhsPairing, rhsPairing, valid } = data.verifyResult;

  ctx.textBaseline = 'middle';
  ctx.font = '9px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText('e(A,B) ?= e(α,β)·…', cx, cy, maxW);
  cy += lineH + 4;

  row(ctx, 'LHS e(A,B):', `${lhsPairing}`, cx, cy, maxW, isDark);
  cy += lineH + 4;
  row(ctx, 'RHS e(α,β)·…:', `${rhsPairing}`, cx, cy, maxW, isDark);
  cy += lineH + 10;

  const statusColor = valid ? '#22c55e' : '#ef4444';
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = statusColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(valid ? '✓ VALID' : '✗ INVALID', cx, cy);
  cy += lineH + 4;

  ctx.font = '9px monospace';
  ctx.fillStyle = hexToRgba(statusColor, 0.75);
  ctx.fillText(valid ? 'pairing check passes' : 'pairing mismatch!', cx, cy, maxW);
}
