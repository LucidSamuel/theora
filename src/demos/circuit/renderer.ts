import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawLine, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { ConstraintCheck, Witness } from './logic';

export function renderCircuit(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  witness: Witness,
  constraints: ConstraintCheck[],
  broken: boolean,
  theme: 'dark' | 'light'
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ────────────────────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  // Subtle vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Circuit nodes ─────────────────────────────────────────────────────────
  // Colors follow Theora's zinc-based palette:
  //   Inputs x, y → zinc-200 / zinc-400 (data tones)
  //   Gate        → zinc-600 (neutral computation)
  //   Output      → green (pass) / red (fail) — semantic only
  const nodes = [
    { x: 80,  y: 120, w: 92,  h: 48, label: `x = ${witness.x}`, color: isDark ? '#e4e4e7' : '#3f3f46' },
    { x: 80,  y: 240, w: 92,  h: 48, label: `y = ${witness.y}`, color: isDark ? '#a1a1aa' : '#71717a' },
    { x: 240, y: 120, w: 118, h: 56, label: 'square',           color: isDark ? '#71717a' : '#a1a1aa' },
    { x: 420, y: 160, w: 118, h: 56,
      label: broken ? 'out ← t + y' : 'z = t + y',
      color: broken ? '#ef4444' : '#22c55e' },
  ];

  // Wires
  const wireColor = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.8);
  drawLine(ctx, 172, 144, 240, 148, wireColor, 1.5);
  drawLine(ctx, 358, 148, 420, 188, wireColor, 1.5);
  drawLine(ctx, 172, 264, 420, 196, wireColor, 1.5);

  for (const node of nodes) {
    ctx.fillStyle = hexToRgba(node.color, isDark ? 0.10 : 0.12);
    ctx.strokeStyle = hexToRgba(node.color, isDark ? 0.65 : 0.75);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, node.x, node.y, node.w, node.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.x + node.w / 2, node.y + node.h / 2);
  }

  ctx.textBaseline = 'alphabetic';

  // ── Constraint panel ──────────────────────────────────────────────────────
  const panelX = width - 280;
  const panelY = 32;
  ctx.fillStyle = hexToRgba(isDark ? '#111113' : '#ffffff', 0.96);
  ctx.fillRect(panelX, panelY, 240, height - 64);
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, 240, height - 64);

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Constraint Checks', panelX + 12, panelY + 22);

  constraints.forEach((constraint, index) => {
    const y = panelY + 48 + index * 52;
    const ok = constraint.satisfied;
    ctx.fillStyle = hexToRgba(ok ? '#22c55e' : '#ef4444', isDark ? 0.09 : 0.07);
    ctx.fillRect(panelX + 12, y - 16, 216, 38);
    ctx.strokeStyle = hexToRgba(ok ? '#22c55e' : '#ef4444', isDark ? 0.55 : 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 12, y - 16, 216, 38);
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = '11px monospace';
    ctx.fillText(constraint.label, panelX + 20, y);
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.fillText(`${constraint.left} ?= ${constraint.right}`, panelX + 20, y + 14);
  });
}
