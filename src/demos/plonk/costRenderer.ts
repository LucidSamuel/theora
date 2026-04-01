import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { CostComparison, ProofSystemCost } from './customGates';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CostRenderState {
  comparison: CostComparison;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const MARGIN_X = 60;
const MARGIN_Y = 72;

const COL_W = 150;
const COL_GAP = 20;
const BAR_MAX_H = 140;
const SYSTEM_HEADER_H = 32;

// System brand colors
function systemColor(system: ProofSystemCost['system']): string {
  switch (system) {
    case 'plonk': return '#818cf8'; // indigo
    case 'groth16': return '#34d399'; // emerald
    case 'halo2': return '#f59e0b'; // amber
    case 'nova': return '#f472b6'; // pink
    default: return '#a1a1aa';
  }
}

function systemLabel(system: ProofSystemCost['system']): string {
  switch (system) {
    case 'plonk': return 'PLONK';
    case 'groth16': return 'Groth16';
    case 'halo2': return 'Halo2';
    case 'nova': return 'Nova';
    default: return system;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawSystemColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sys: ProofSystemCost,
  maxConstraints: number,
  isWinner: boolean,
  isDark: boolean,
): void {
  const color = systemColor(sys.system);
  const colH = SYSTEM_HEADER_H + 20 + BAR_MAX_H + 140; // header + gap + bar + info rows

  // Column background
  ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#fafafa', isDark ? 0.6 : 0.5);
  drawRoundedRect(ctx, x, y, COL_W, colH, 10);
  ctx.fill();

  // Winner highlight border
  if (isWinner) {
    ctx.strokeStyle = hexToRgba('#22c55e', isDark ? 0.6 : 0.5);
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, COL_W, colH, 10);
    ctx.stroke();
  } else {
    ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.5);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, COL_W, colH, 10);
    ctx.stroke();
  }

  // Header bar
  ctx.fillStyle = hexToRgba(color, isDark ? 0.15 : 0.1);
  drawRoundedRect(ctx, x, y, COL_W, SYSTEM_HEADER_H, 10);
  ctx.fill();
  ctx.fillRect(x, y + 14, COL_W, SYSTEM_HEADER_H - 14);

  // System name
  ctx.fillStyle = color;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(systemLabel(sys.system), x + COL_W / 2, y + SYSTEM_HEADER_H / 2);

  // Winner badge
  if (isWinner) {
    const wBadge = '\u2605 LOWEST';
    ctx.font = 'bold 8px monospace';
    const wbW = ctx.measureText(wBadge).width + 10;
    const wbX = x + COL_W - wbW - 6;
    const wbY = y + 4;
    ctx.fillStyle = hexToRgba('#22c55e', isDark ? 0.2 : 0.15);
    drawRoundedRect(ctx, wbX, wbY, wbW, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wBadge, wbX + wbW / 2, wbY + 7);
  }

  // Constraint bar
  const barAreaY = y + SYSTEM_HEADER_H + 20;
  const fraction = maxConstraints > 0 ? sys.constraintCount / maxConstraints : 0;
  const barH = Math.max(4, fraction * BAR_MAX_H);
  const barW = 60;
  const barX = x + (COL_W - barW) / 2;
  const barBottomY = barAreaY + BAR_MAX_H;

  // Bar background track
  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.3);
  drawRoundedRect(ctx, barX, barAreaY, barW, BAR_MAX_H, 4);
  ctx.fill();

  // Bar fill (grows from bottom)
  ctx.fillStyle = hexToRgba(color, isDark ? 0.55 : 0.45);
  drawRoundedRect(ctx, barX, barBottomY - barH, barW, barH, 4);
  ctx.fill();

  // Bar border
  ctx.strokeStyle = hexToRgba(color, 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, barX, barAreaY, barW, BAR_MAX_H, 4);
  ctx.stroke();

  // Constraint count on top of bar
  ctx.fillStyle = color;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(sys.constraintCount), x + COL_W / 2, barBottomY - barH - 6);

  // Label below bar
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('constraints', x + COL_W / 2, barBottomY + 4);

  // Info rows below bar
  const infoStartY = barBottomY + 24;
  const lineH = 22;
  const lx = x + 10;
  const rw = COL_W - 20;

  const drawInfoRow = (label: string, value: string, rowY: number, accent?: boolean) => {
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, rowY + lineH / 2);

    ctx.fillStyle = accent ? color : (isDark ? '#e4e4e7' : '#27272a');
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(value, lx + rw, rowY + lineH / 2, rw - 60);
  };

  drawInfoRow('Gates', String(sys.gateCount), infoStartY, true);
  drawInfoRow('Copy \u03c3', String(sys.copyConstraints), infoStartY + lineH);
  drawInfoRow('Proof', sys.proofSize, infoStartY + lineH * 2);
  drawInfoRow('Verifier', sys.verifierCost, infoStartY + lineH * 3);

  // Separator before notes
  const sepY = infoStartY + lineH * 4 + 2;
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.4);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(lx, sepY);
  ctx.lineTo(lx + rw, sepY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textBaseline = 'alphabetic';
}

function drawCircuitSummary(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  comparison: CostComparison,
  isDark: boolean,
): void {
  const BOX_W = 180;
  const BOX_H = 130;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.4 : 0.3);
  drawRoundedRect(ctx, x, y, BOX_W, BOX_H, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.4);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, BOX_W, BOX_H, 8);
  ctx.stroke();

  // Header
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Circuit Summary', x + BOX_W / 2, y + 14);

  // Description
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '10px monospace';
  ctx.fillText(comparison.circuitDescription, x + BOX_W / 2, y + 34, BOX_W - 20);

  // Breakdown
  const lineH = 20;
  const startY = y + 52;
  const lx = x + 12;

  const drawRow = (label: string, value: number, rowIdx: number) => {
    const ry = startY + rowIdx * lineH;
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ry + lineH / 2);
    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(value), x + BOX_W - 12, ry + lineH / 2);
  };

  drawRow('Multiplications', comparison.totalMultiplications, 0);
  drawRow('Additions', comparison.totalAdditions, 1);
  drawRow('Boolean checks', comparison.totalBooleanChecks, 2);
  drawRow('Custom gates', comparison.totalCustomGates, 3);

  ctx.textBaseline = 'alphabetic';
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderCost(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: CostRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';
  const { comparison } = state;
  const systems = comparison.systems;

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

  const badgeText = `Constraint Cost \u2014 ${comparison.circuitDescription} across ${systems.length} proof systems`;
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

  // ── Circuit summary (left) ──────────────────────────────────────────────────
  drawCircuitSummary(ctx, MARGIN_X, MARGIN_Y, comparison, isDark);

  // ── System columns (center) ─────────────────────────────────────────────────
  const maxConstraints = Math.max(...systems.map((s) => s.constraintCount), 1);
  const minConstraints = Math.min(...systems.map((s) => s.constraintCount));

  const columnsStartX = MARGIN_X + 200 + 40;
  const columnsY = MARGIN_Y;

  systems.forEach((sys, i) => {
    const colX = columnsStartX + i * (COL_W + COL_GAP);
    const isWinner = sys.constraintCount === minConstraints;
    drawSystemColumn(ctx, colX, columnsY, sys, maxConstraints, isWinner, isDark);
  });

  // ── Notes row at bottom ───────────────────────────────────────────────────────
  const colH = SYSTEM_HEADER_H + 20 + BAR_MAX_H + 140;
  const notesY = columnsY + colH + 20;

  systems.forEach((sys, i) => {
    const colX = columnsStartX + i * (COL_W + COL_GAP);
    const color = systemColor(sys.system);

    // Notes box
    const noteW = COL_W;
    const noteH = 48;
    ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#f4f4f5', isDark ? 0.5 : 0.4);
    drawRoundedRect(ctx, colX, notesY, noteW, noteH, 6);
    ctx.fill();

    ctx.fillStyle = hexToRgba(color, 0.7);
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Word wrap notes text
    const words = sys.notes.split(' ');
    let line = '';
    let lineY = notesY + 6;
    const maxLineW = noteW - 12;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxLineW && line) {
        ctx.fillText(line, colX + 6, lineY, maxLineW);
        line = word;
        lineY += 12;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, colX + 6, lineY, maxLineW);
    }
  });

  ctx.textBaseline = 'alphabetic';
}
