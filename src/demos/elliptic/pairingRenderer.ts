import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, drawArrow, hexToRgba } from '@/lib/canvas';
import type { PairingConfig, BilinearityDemo, VerificationEquation } from './pairing';
import { pointLabel } from './logic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PairingRenderState {
  config: PairingConfig | null;
  bilinearityDemo: BilinearityDemo | null;
  pairingTableData: number[][] | null;
  verificationEq: VerificationEquation | null;
  view: 'bilinearity' | 'table' | 'groth16' | 'kzg';
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const BOX_RADIUS = 10;
const HEADER_H = 32;

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export function renderPairing(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: PairingRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ──────────────────────────────────────────────────────────
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

  drawGrid(ctx, width, height, 36, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  if (!state.config) {
    drawScreenText(ctx, width, height, isDark, 'No valid pairing config for this curve');
    return;
  }

  // ── Top badge (screen-space) ────────────────────────────────────────────
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const { config } = state;
  ctx.fillText(
    `Bilinear Pairing \u2014 order ${config.groupOrder}, G = ${pointLabel(config.generator)}, GF(${config.curve.p})`,
    24, 20,
  );
  ctx.font = '11px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#71717a';
  ctx.fillText(
    `y\u00b2 = x\u00b3 + ${config.curve.a}x + ${config.curve.b} (mod ${config.curve.p})`,
    24, 40,
  );

  ctx.restore();

  // ── Dispatch to view-specific renderer ──────────────────────────────────
  switch (state.view) {
    case 'bilinearity':
      drawBilinearity(ctx, frame, state.bilinearityDemo, isDark);
      break;
    case 'table':
      drawPairingTable(ctx, frame, state.pairingTableData, config, isDark);
      break;
    case 'groth16':
    case 'kzg':
      drawVerification(ctx, frame, state.verificationEq, isDark);
      break;
  }
}

// ---------------------------------------------------------------------------
// Bilinearity view
// ---------------------------------------------------------------------------

function drawBilinearity(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  demo: BilinearityDemo | null,
  isDark: boolean,
): void {
  if (!demo) return;
  const { width, height } = frame;
  const cx = width / 2;
  const cy = height / 2 + 10;

  // Layout: left box (inputs) -> arrow -> center "e(aP, bQ)" -> equals -> right "e(P,Q)^ab"
  const boxW = 160;
  const boxH = 110;
  const resultBoxW = 170;
  const resultBoxH = 80;
  const gap = 40;

  // ── Left: input points box ──────────────────────────────────────────────
  const leftX = cx - resultBoxW - gap - boxW;
  const leftY = cy - boxH / 2;

  drawBox(ctx, leftX, leftY, boxW, boxH, 'Input Points', isDark, isDark ? '#a1a1aa' : '#52525b');

  let ty = leftY + HEADER_H + 16;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText('P = G', leftX + 12, ty);
  ty += 16;
  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.fillText(`${pointLabel(demo.P)}`, leftX + 12, ty);
  ty += 20;

  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText('Q = G', leftX + 12, ty);
  ty += 16;
  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.fillText(`${pointLabel(demo.Q)}`, leftX + 12, ty);

  // ── Arrow from left to center-left result ───────────────────────────────
  const lhsBoxX = cx - resultBoxW - gap / 2;
  const lhsBoxY = cy - resultBoxH / 2;

  drawArrow(
    ctx,
    leftX + boxW + 4, cy,
    lhsBoxX - 4, cy,
    hexToRgba(isDark ? '#71717a' : '#a1a1aa', 0.6),
    7,
  );

  // ── Center-left: e(aP, bQ) result ──────────────────────────────────────
  drawBox(ctx, lhsBoxX, lhsBoxY, resultBoxW, resultBoxH, 'e(aP, bQ)', isDark, isDark ? '#e4e4e7' : '#3f3f46');

  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let lhsY = lhsBoxY + HEADER_H + 16;
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText(`a=${demo.a}, b=${demo.b}`, lhsBoxX + 12, lhsY);
  lhsY += 18;
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`= ${demo.eaPbQ}`, lhsBoxX + 12, lhsY);

  // ── Center: equals sign ─────────────────────────────────────────────────
  const eqX = cx;
  const eqY = cy;
  const holds = demo.bilinearityHolds;

  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = holds ? '#22c55e' : '#ef4444';
  ctx.fillText('=', eqX, eqY);

  // Status label below the equals
  ctx.font = '10px monospace';
  ctx.fillStyle = holds ? '#22c55e' : '#ef4444';
  ctx.fillText(holds ? 'bilinearity holds' : 'bilinearity broken!', eqX, eqY + 22);

  // ── Center-right: e(P,Q)^(ab) result ───────────────────────────────────
  const rhsBoxX = cx + gap / 2;
  const rhsBoxY = cy - resultBoxH / 2;

  drawBox(ctx, rhsBoxX, rhsBoxY, resultBoxW, resultBoxH, 'e(P,Q)^(ab)', isDark, isDark ? '#e4e4e7' : '#3f3f46');

  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let rhsY = rhsBoxY + HEADER_H + 16;
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText(`e(P,Q)=${demo.ePQ}, ab=${demo.a * demo.b}`, rhsBoxX + 12, rhsY);
  rhsY += 18;
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`= ${demo.ePQab}`, rhsBoxX + 12, rhsY);

  // ── Below: equation summary (screen-space) ─────────────────────────────
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const summaryY = height - 48;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText(
    `e(${demo.a}\u00b7P, ${demo.b}\u00b7Q) = e(P, Q)^(${demo.a}\u00b7${demo.b})  \u2192  ${demo.eaPbQ} ${holds ? '==' : '!='} ${demo.ePQab}`,
    width / 2, summaryY,
  );

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Pairing table view
// ---------------------------------------------------------------------------

function drawPairingTable(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  table: number[][] | null,
  config: PairingConfig,
  isDark: boolean,
): void {
  if (!table || table.length === 0) return;
  const { width, height } = frame;
  const n = config.groupOrder;

  // Cell sizing — cap to fit on screen
  const maxCellSize = 48;
  const minCellSize = 20;
  const availW = width - 120;
  const availH = height - 140;
  const cellSize = Math.max(minCellSize, Math.min(maxCellSize, Math.floor(Math.min(availW, availH) / (n + 1))));

  const tableW = (n + 1) * cellSize;
  const tableH = (n + 1) * cellSize;
  const startX = (width - tableW) / 2;
  const startY = (height - tableH) / 2 + 20;

  // Find max value for color intensity mapping
  let maxVal = 1;
  for (const row of table) {
    for (const v of row) {
      if (v > maxVal) maxVal = v;
    }
  }

  // Header row (j indices)
  ctx.font = `${Math.min(10, cellSize * 0.4)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let j = 0; j < n; j++) {
    const x = startX + (j + 1) * cellSize + cellSize / 2;
    const y = startY + cellSize / 2;
    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.fillText(`${j}G`, x, y);
  }

  // Header column (i indices) + data cells
  for (let i = 0; i < n; i++) {
    const y = startY + (i + 1) * cellSize + cellSize / 2;

    // Row header
    const hx = startX + cellSize / 2;
    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.font = `${Math.min(10, cellSize * 0.4)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i}G`, hx, y);

    // Data cells
    for (let j = 0; j < n; j++) {
      const x = startX + (j + 1) * cellSize;
      const val = table[i]![j]!;
      const intensity = val / maxVal;

      // Cell background — warmer zinc tones for higher values
      const bgAlpha = 0.05 + intensity * 0.25;
      ctx.fillStyle = hexToRgba(isDark ? '#a1a1aa' : '#3f3f46', bgAlpha);
      ctx.fillRect(x + 1, startY + (i + 1) * cellSize + 1, cellSize - 2, cellSize - 2);

      // Cell border
      ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.4);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 1, startY + (i + 1) * cellSize + 1, cellSize - 2, cellSize - 2);

      // Cell value
      ctx.fillStyle = intensity > 0.5
        ? (isDark ? '#fafafa' : '#09090b')
        : (isDark ? '#71717a' : '#a1a1aa');
      ctx.font = `${Math.min(10, cellSize * 0.38)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${val}`, x + cellSize / 2, y);
    }
  }

  // Corner label
  ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
  ctx.font = `${Math.min(9, cellSize * 0.35)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('e(i,j)', startX + cellSize / 2, startY + cellSize / 2);

  // Screen-space legend
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText(
    `Pairing table: e(iG, jG) for i,j \u2208 [0, ${n - 1}] \u2014 ${n}\u00d7${n} entries`,
    width / 2, height - 36,
  );

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Verification equation view (Groth16 / KZG)
// ---------------------------------------------------------------------------

function drawVerification(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  eq: VerificationEquation | null,
  isDark: boolean,
): void {
  if (!eq) return;
  const { width, height } = frame;
  const cx = width / 2;
  const cy = height / 2;

  // ── Title ───────────────────────────────────────────────────────────────
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.fillText(`${eq.name} Verification`, cx, cy - 120);

  ctx.font = '11px monospace';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText(eq.description, cx, cy - 96);

  // ── LHS box ─────────────────────────────────────────────────────────────
  const boxW = 200;
  const boxH = 120;
  const gap = 60;

  const lhsX = cx - boxW - gap / 2;
  const lhsY = cy - boxH / 2 + 10;

  drawBox(ctx, lhsX, lhsY, boxW, boxH, 'LHS', isDark, isDark ? '#e4e4e7' : '#3f3f46');

  let ty = lhsY + HEADER_H + 16;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (const p of eq.lhs.pairings) {
    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.fillText(`e(${p.P}, ${p.Q})`, lhsX + 12, ty);
    ty += 16;
  }
  ty += 8;
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`= ${eq.lhsValue}`, lhsX + 12, ty);

  // ── RHS box ─────────────────────────────────────────────────────────────
  const rhsX = cx + gap / 2;
  const rhsY = cy - boxH / 2 + 10;

  drawBox(ctx, rhsX, rhsY, boxW, boxH, 'RHS', isDark, isDark ? '#e4e4e7' : '#3f3f46');

  ty = rhsY + HEADER_H + 16;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';

  for (const p of eq.rhs.pairings) {
    ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
    ctx.fillText(`e(${p.P}, ${p.Q})`, rhsX + 12, ty);
    ty += 16;
  }
  ty += 8;
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`= ${eq.rhsValue}`, rhsX + 12, ty);

  // ── Center equals sign ──────────────────────────────────────────────────
  const holds = eq.holds;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = holds ? '#22c55e' : '#ef4444';
  ctx.fillText(holds ? '=' : '\u2260', cx, cy + 10);

  // ── Bottom verdict (screen-space) ───────────────────────────────────────
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = holds ? '#22c55e' : '#ef4444';
  ctx.fillText(
    holds ? `\u2713 ${eq.name} verification passes` : `\u2717 ${eq.name} verification fails`,
    width / 2, height - 36,
  );

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared drawing helpers
// ---------------------------------------------------------------------------

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  isDark: boolean,
  borderColor: string,
): void {
  // Background
  ctx.fillStyle = hexToRgba(isDark ? '#ffffff' : '#000000', 0.04);
  drawRoundedRect(ctx, x, y, w, h, BOX_RADIUS);
  ctx.fill();

  // Border
  ctx.strokeStyle = hexToRgba(borderColor, 0.5);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, h, BOX_RADIUS);
  ctx.stroke();

  // Header bar
  ctx.save();
  drawRoundedRect(ctx, x, y, w, HEADER_H, BOX_RADIUS);
  ctx.clip();
  ctx.fillStyle = hexToRgba(borderColor, 0.08);
  ctx.fillRect(x, y, w, HEADER_H);
  ctx.restore();

  // Header separator
  ctx.strokeStyle = hexToRgba(borderColor, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + HEADER_H);
  ctx.lineTo(x + w, y + HEADER_H);
  ctx.stroke();

  // Header text
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + w / 2, y + HEADER_H / 2);
}

function drawScreenText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean,
  text: string,
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText(text, width / 2, height / 2);
  ctx.restore();
}
