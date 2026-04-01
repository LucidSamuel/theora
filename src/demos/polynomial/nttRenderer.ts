import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { ButterflyLayer } from './ntt';

/* ── Types ───────────────────────────────────────────────────────────── */

export interface NTTRenderState {
  coefficients: bigint[];
  evaluations: bigint[];
  layers: ButterflyLayer[];
  omega: bigint;
  fieldSize: bigint;
  n: number;
  direction: 'forward' | 'inverse';
  activeLayer: number; // -1 = show all
}

/* ── Layout constants ────────────────────────────────────────────────── */

const PANEL_W = 140;
const BOX_H = 36;
const BOX_GAP = 10;
const BOX_RADIUS = 6;
const NODE_RADIUS = 6;
const PANEL_TITLE_H = 36;

// Layer colors for butterfly diagram (neutral zinc tones)
const LAYER_COLORS = ['#6b7280', '#9ca3af', '#d4d4d8'];

/* ── Helpers ──────────────────────────────────────────────────────────── */

function bigintStr(v: bigint): string {
  return v.toString();
}

function panelBoxY(index: number, startY: number): number {
  return startY + PANEL_TITLE_H + index * (BOX_H + BOX_GAP);
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
  // Box background
  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.5 : 0.6);
  drawRoundedRect(ctx, x, y, w, BOX_H, BOX_RADIUS);
  ctx.fill();

  // Box border
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, w, BOX_H, BOX_RADIUS);
  ctx.stroke();

  // Label (left)
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 10, y + BOX_H / 2);

  // Value (right)
  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w - 10, y + BOX_H / 2);
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderNTT(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: NTTRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';
  const n = state.n;
  const logn = Math.log2(n);

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

  // ── Layout computation ────────────────────────────────────────────
  const totalContentH = n * (BOX_H + BOX_GAP) - BOX_GAP + PANEL_TITLE_H;
  const startY = Math.max(60, (height - totalContentH) / 2);

  // Horizontal layout: left panel | butterfly | right panel
  const butterflyW = Math.max(200, width - 2 * PANEL_W - 160);
  const leftPanelX = 40;
  const butterflyX = leftPanelX + PANEL_W + 40;
  const rightPanelX = butterflyX + butterflyW + 40;

  // ── Left panel: Coefficients ──────────────────────────────────────
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(
    state.direction === 'forward' ? 'COEFFICIENTS' : 'EVALUATIONS',
    leftPanelX,
    startY + 12,
  );

  const inputValues = state.direction === 'forward' ? state.coefficients : state.evaluations;
  for (let i = 0; i < n; i++) {
    const y = panelBoxY(i, startY);
    const label = state.direction === 'forward' ? `a${subscriptDigit(i)}` : `f(\u03c9${superscriptDigit(i)})`;
    const val = i < inputValues.length ? bigintStr(inputValues[i]!) : '0';
    drawValueBox(ctx, leftPanelX, y, PANEL_W, label, val, isDark);
  }

  // ── Right panel: Evaluations / Coefficients ───────────────────────
  const rightLabel = state.direction === 'forward' ? 'EVALUATIONS' : 'COEFFICIENTS';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(rightLabel, rightPanelX, startY + 12);

  const outputValues = state.direction === 'forward' ? state.evaluations : state.coefficients;
  for (let i = 0; i < n; i++) {
    const y = panelBoxY(i, startY);
    const label = state.direction === 'forward' ? `f(\u03c9${superscriptDigit(i)})` : `a${subscriptDigit(i)}`;
    const val = i < outputValues.length ? bigintStr(outputValues[i]!) : '?';
    drawValueBox(ctx, rightPanelX, y, PANEL_W, label, val, isDark);
  }

  // ── Butterfly diagram ─────────────────────────────────────────────
  // Node positions: (logn + 1) columns of n nodes each
  const cols = logn + 1;
  const colSpacing = butterflyW / (cols + 1);

  // Compute node positions
  const nodePositions: { x: number; y: number }[][] = [];
  for (let col = 0; col <= logn; col++) {
    const positions: { x: number; y: number }[] = [];
    for (let row = 0; row < n; row++) {
      const x = butterflyX + (col + 1) * colSpacing;
      const boxY = panelBoxY(row, startY);
      const y = boxY + BOX_H / 2;
      positions.push({ x, y });
    }
    nodePositions.push(positions);
  }

  // Draw connections for each layer
  for (let layerIdx = 0; layerIdx < state.layers.length; layerIdx++) {
    const layer = state.layers[layerIdx]!;
    const isActive = state.activeLayer === -1 || state.activeLayer === layerIdx;
    const layerColor = LAYER_COLORS[layerIdx % LAYER_COLORS.length]!;
    const alpha = isActive ? 0.8 : 0.15;

    for (const op of layer.operations) {
      const [i1, i2] = op.inputIndices;
      const fromCol = nodePositions[layerIdx]!;
      const toCol = nodePositions[layerIdx + 1]!;

      // Each butterfly: input i1,i2 from column layerIdx -> output i1,i2 in column layerIdx+1
      const from1 = fromCol[i1]!;
      const from2 = fromCol[i2]!;
      const to1 = toCol[i1]!;
      const to2 = toCol[i2]!;

      // Draw lines
      ctx.strokeStyle = hexToRgba(layerColor, alpha);
      ctx.lineWidth = 1.5;

      // Top input -> Top output (straight)
      ctx.beginPath();
      ctx.moveTo(from1.x + NODE_RADIUS, from1.y);
      ctx.lineTo(to1.x - NODE_RADIUS, to1.y);
      ctx.stroke();

      // Bottom input -> Top output (cross)
      ctx.beginPath();
      ctx.moveTo(from2.x + NODE_RADIUS, from2.y);
      ctx.lineTo(to1.x - NODE_RADIUS, to1.y);
      ctx.stroke();

      // Top input -> Bottom output (cross)
      ctx.beginPath();
      ctx.moveTo(from1.x + NODE_RADIUS, from1.y);
      ctx.lineTo(to2.x - NODE_RADIUS, to2.y);
      ctx.stroke();

      // Bottom input -> Bottom output (straight)
      ctx.beginPath();
      ctx.moveTo(from2.x + NODE_RADIUS, from2.y);
      ctx.lineTo(to2.x - NODE_RADIUS, to2.y);
      ctx.stroke();

      // Twiddle factor label on the cross connection (midpoint)
      if (isActive && op.twiddleFactor !== 1n) {
        const midX = (from2.x + to1.x) / 2;
        const midY = (from2.y + to1.y) / 2;
        ctx.fillStyle = hexToRgba(layerColor, 0.7);
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`\u03c9${superscriptDigit(Number(op.twiddleFactor % 100n))}`, midX, midY - 8);
      }
    }
  }

  // Draw nodes
  for (let col = 0; col <= logn; col++) {
    const colNodes = nodePositions[col]!;
    for (let row = 0; row < n; row++) {
      const pos = colNodes[row]!;
      const isInputCol = col === 0;
      const isOutputCol = col === logn;

      // Determine if this node is in an active layer
      let nodeActive = state.activeLayer === -1;
      if (!nodeActive) {
        if (col === state.activeLayer || col === state.activeLayer + 1) {
          nodeActive = true;
        }
      }

      const nodeAlpha = nodeActive ? 1.0 : 0.3;

      // Node circle
      ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', nodeAlpha);
      ctx.strokeStyle = hexToRgba(isDark ? '#52525b' : '#a1a1aa', nodeAlpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw connector lines from left panel to first column
      if (isInputCol) {
        const boxY = panelBoxY(row, startY);
        const boxRight = leftPanelX + PANEL_W;
        ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.3);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(boxRight, boxY + BOX_H / 2);
        ctx.lineTo(pos.x - NODE_RADIUS, pos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw connector lines from last column to right panel
      if (isOutputCol) {
        const boxY = panelBoxY(row, startY);
        const boxLeft = rightPanelX;
        ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.3);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pos.x + NODE_RADIUS, pos.y);
        ctx.lineTo(boxLeft, boxY + BOX_H / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ── Layer labels (below butterfly) ────────────────────────────────
  for (let col = 0; col < logn; col++) {
    const colNodes = nodePositions[col]!;
    const nextColNodes = nodePositions[col + 1]!;
    const midX = (colNodes[0]!.x + nextColNodes[0]!.x) / 2;
    const labelY = panelBoxY(n - 1, startY) + BOX_H + 24;

    const isActive = state.activeLayer === -1 || state.activeLayer === col;
    const layerColor = LAYER_COLORS[col % LAYER_COLORS.length]!;
    ctx.fillStyle = hexToRgba(layerColor, isActive ? 0.9 : 0.3);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Layer ${col}`, midX, labelY);
  }

  // ── Screen-space elements (fixed position) ────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Field info badge at top center
  const badgeText = `GF(${bigintStr(state.fieldSize)}), \u03c9 = ${bigintStr(state.omega)}, n = ${state.n}`;
  const badgeW = ctx.measureText(badgeText).width + 40;
  const badgeX = width / 2 - badgeW / 2;
  const badgeY = 20;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.8);
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 32, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 32, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, badgeY + 16);

  // Direction indicator
  const dirText = state.direction === 'forward' ? 'Forward NTT' : 'Inverse NTT';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(dirText, width / 2, badgeY + 48);

  ctx.restore();
}

/* ── Unicode helpers ─────────────────────────────────────────────────── */

const SUPERSCRIPT_DIGITS = ['\u2070', '\u00b9', '\u00b2', '\u00b3', '\u2074', '\u2075', '\u2076', '\u2077', '\u2078', '\u2079'];
const SUBSCRIPT_DIGITS = ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084', '\u2085', '\u2086', '\u2087', '\u2088', '\u2089'];

function superscriptDigit(n: number): string {
  if (n < 0) return '\u207b' + superscriptDigit(-n);
  if (n < 10) return SUPERSCRIPT_DIGITS[n]!;
  return n.toString().split('').map(d => SUPERSCRIPT_DIGITS[parseInt(d)]!).join('');
}

function subscriptDigit(n: number): string {
  if (n < 0) return '\u208b' + subscriptDigit(-n);
  if (n < 10) return SUBSCRIPT_DIGITS[n]!;
  return n.toString().split('').map(d => SUBSCRIPT_DIGITS[parseInt(d)]!).join('');
}
