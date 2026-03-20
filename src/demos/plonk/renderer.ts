import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { PlonkAnalysis } from './logic';

// Layout constants
const GATE_W = 320;
const GATE_H = 112;
const GATE_GAP = 56;
const GATE_X = 80;
const FIRST_GATE_Y = 64;

function gateTop(idx: number): number {
  return FIRST_GATE_Y + idx * (GATE_H + GATE_GAP);
}

// Wire anchor positions relative to gate top-left
// a wire: left-center, b wire: left, offset down, c wire: right-center
function wireAnchor(
  gateIdx: number,
  wire: 'a' | 'b' | 'c',
  side: 'left' | 'right'
): { x: number; y: number } {
  const top = gateTop(gateIdx);
  const midY = top + GATE_H / 2;
  if (wire === 'a') {
    return side === 'left'
      ? { x: GATE_X, y: midY - 18 }
      : { x: GATE_X + GATE_W, y: midY - 18 };
  }
  if (wire === 'b') {
    return side === 'left'
      ? { x: GATE_X, y: midY + 18 }
      : { x: GATE_X + GATE_W, y: midY + 18 };
  }
  // wire === 'c'
  return side === 'left'
    ? { x: GATE_X, y: midY }
    : { x: GATE_X + GATE_W, y: midY };
}

function drawGateBox(
  ctx: CanvasRenderingContext2D,
  gate: PlonkAnalysis['gates'][number],
  idx: number,
  isDark: boolean
): void {
  const x = GATE_X;
  const y = gateTop(idx);
  const ok = gate.satisfied;

  const borderColor = ok ? '#22c55e' : '#ef4444';
  const bgAlpha = isDark ? 0.07 : 0.05;
  const borderAlpha = isDark ? 0.7 : 0.6;

  // Gate background
  ctx.fillStyle = hexToRgba(borderColor, bgAlpha);
  drawRoundedRect(ctx, x, y, GATE_W, GATE_H, 10);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(borderColor, borderAlpha);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, GATE_W, GATE_H, 10);
  ctx.stroke();

  // Header bar
  ctx.fillStyle = hexToRgba(borderColor, isDark ? 0.12 : 0.09);
  drawRoundedRect(ctx, x, y, GATE_W, 28, 10);
  ctx.fill();
  // Fill lower part of header to avoid double-rounded bottom
  ctx.fillRect(x, y + 14, GATE_W, 14);

  // Gate label
  ctx.fillStyle = borderColor;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Gate ${idx}: ${gate.label}`, x + 12, y + 14);

  // Status badge
  const badgeText = ok ? '✓ SAT' : '✗ UNSAT';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(badgeText, x + GATE_W - 12, y + 14);

  // Selectors row
  const selectorY = y + 46;
  const selectorColor = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = selectorColor;
  const selectors = [
    `qL=${gate.qL}`,
    `qR=${gate.qR}`,
    `qO=${gate.qO}`,
    `qM=${gate.qM}`,
    `qC=${gate.qC}`,
  ];
  selectors.forEach((s, i) => {
    ctx.fillText(s, x + 12 + i * 58, selectorY);
  });

  // Wire values row
  const wireY = y + 68;
  const wireColor = isDark ? '#e4e4e7' : '#3f3f46';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = wireColor;
  ctx.fillText(`a = ${gate.a}`, x + 12, wireY);
  ctx.fillText(`b = ${gate.b}`, x + 12 + 90, wireY);
  ctx.fillText(`c = ${gate.c}`, x + 12 + 180, wireY);

  // Equation
  const eqY = y + 90;
  ctx.font = '10px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.textAlign = 'left';
  // Truncate equation if too long
  const eq = gate.equation;
  const maxW = GATE_W - 24;
  ctx.fillText(eq, x + 12, eqY, maxW);

  ctx.textBaseline = 'alphabetic';
}

function drawCopyConstraintArrow(
  ctx: CanvasRenderingContext2D,
  fromGate: number,
  fromWire: 'a' | 'b' | 'c',
  toGate: number,
  toWire: 'a' | 'b' | 'c',
  satisfied: boolean,
  isDark: boolean,
  index: number
): void {
  const color = satisfied ? '#22c55e' : '#ef4444';
  const alpha = isDark ? 0.7 : 0.6;
  const arrowColor = hexToRgba(color, alpha);

  const from = wireAnchor(fromGate, fromWire, 'right');
  const to = wireAnchor(toGate, toWire, 'left');

  // Curved arrow using bezier — offset sideways so multiple arrows don't stack
  const offsetX = 30 + index * 22;
  const cp1x = from.x + offsetX;
  const cp1y = from.y;
  const cp2x = to.x - offsetX;
  const cp2y = to.y;

  ctx.beginPath();
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead at destination
  const angle = Math.atan2(to.y - cp2y, to.x - cp2x);
  const headSize = 7;
  ctx.fillStyle = arrowColor;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headSize * Math.cos(angle - Math.PI / 6),
    to.y - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - headSize * Math.cos(angle + Math.PI / 6),
    to.y - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // Wire labels at endpoints
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = hexToRgba(color, isDark ? 0.9 : 0.8);
  ctx.fillText(`g${fromGate}.${fromWire}`, from.x - 4, from.y);
  ctx.textAlign = 'left';
  ctx.fillText(`g${toGate}.${toWire}`, to.x + 4, to.y);
  ctx.textBaseline = 'alphabetic';
}

function drawValidityBadge(
  ctx: CanvasRenderingContext2D,
  analysis: PlonkAnalysis,
  x: number,
  y: number,
  isDark: boolean
): void {
  const valid = analysis.valid;
  const color = valid ? '#22c55e' : '#ef4444';
  const w = 180;
  const h = 48;

  ctx.fillStyle = hexToRgba(color, isDark ? 0.1 : 0.07);
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, isDark ? 0.65 : 0.55);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valid ? '✓ CIRCUIT VALID' : '✗ CIRCUIT INVALID', x + w / 2, y + h / 2 - 6);

  ctx.font = '10px monospace';
  ctx.fillStyle = hexToRgba(isDark ? '#fafafa' : '#09090b', 0.6);
  const sub = valid
    ? 'All gates & copies satisfied'
    : !analysis.allGatesSatisfied && !analysis.allCopiesSatisfied
    ? 'Gate(s) + copy constraint(s) violated'
    : !analysis.allGatesSatisfied
    ? 'Gate equation(s) violated'
    : 'Copy constraint(s) violated';
  ctx.fillText(sub, x + w / 2, y + h / 2 + 10);
  ctx.textBaseline = 'alphabetic';
}

export function renderPlonk(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  analysis: PlonkAnalysis,
  theme: 'dark' | 'light'
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ──────────────────────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.65
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Heading ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PLONK Arithmetization', GATE_X, 44);

  ctx.font = '11px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.fillText('qL·a + qR·b + qO·c + qM·a·b + qC = 0', GATE_X, 58);

  // ── Gate boxes ──────────────────────────────────────────────────────────────
  analysis.gates.forEach((gate, idx) => {
    drawGateBox(ctx, gate, idx, isDark);
  });

  // ── Copy constraint arrows ───────────────────────────────────────────────────
  analysis.copyConstraints.forEach((cc, idx) => {
    drawCopyConstraintArrow(
      ctx,
      cc.from.gate,
      cc.from.wire,
      cc.to.gate,
      cc.to.wire,
      cc.satisfied,
      isDark,
      idx
    );
  });

  // ── Legend for copy constraints ─────────────────────────────────────────────
  const legendX = GATE_X + GATE_W + 80;
  const legendY = gateTop(0) + 8;

  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
  ctx.fillText('Copy Constraints', legendX, legendY);

  analysis.copyConstraints.forEach((cc, idx) => {
    const y = legendY + 24 + idx * 28;
    const color = cc.satisfied ? '#22c55e' : '#ef4444';
    ctx.fillStyle = hexToRgba(color, isDark ? 0.85 : 0.75);
    ctx.font = '10px monospace';
    ctx.fillText(
      `g${cc.from.gate}.${cc.from.wire} → g${cc.to.gate}.${cc.to.wire}  ${cc.satisfied ? '✓' : '✗'}`,
      legendX,
      y
    );
  });

  // ── Validity badge ───────────────────────────────────────────────────────────
  const totalGateH = analysis.gates.length * (GATE_H + GATE_GAP) - GATE_GAP;
  const badgeY = FIRST_GATE_Y + totalGateH + 20;
  drawValidityBadge(ctx, analysis, GATE_X, badgeY, isDark);

  ctx.textBaseline = 'alphabetic';
}
