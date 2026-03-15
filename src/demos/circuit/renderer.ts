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
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#0a0f12');
    gradient.addColorStop(1, '#111827');
  } else {
    gradient.addColorStop(0, '#f7fee7');
    gradient.addColorStop(1, '#ecfccb');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);
  drawGrid(ctx, width, height, 40, theme === 'dark' ? 'rgba(132,204,22,0.06)' : 'rgba(77,124,15,0.08)');

  const nodes = [
    { x: 80, y: 120, w: 92, h: 48, label: `x = ${witness.x}`, color: '#38bdf8' },
    { x: 80, y: 240, w: 92, h: 48, label: `y = ${witness.y}`, color: '#f59e0b' },
    { x: 240, y: 120, w: 118, h: 56, label: 'square', color: '#84cc16' },
    { x: 420, y: 160, w: 118, h: 56, label: broken ? 'out <-- t + y' : 'z = t + y', color: broken ? '#ef4444' : '#22c55e' },
  ];

  drawLine(ctx, 172, 144, 240, 148, hexToRgba('#94a3b8', 0.6), 2);
  drawLine(ctx, 358, 148, 420, 188, hexToRgba('#94a3b8', 0.6), 2);
  drawLine(ctx, 172, 264, 420, 196, hexToRgba('#94a3b8', 0.6), 2);

  for (const node of nodes) {
    ctx.fillStyle = hexToRgba(node.color, 0.18);
    ctx.strokeStyle = hexToRgba(node.color, 0.8);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, node.x, node.y, node.w, node.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#111827';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x + node.w / 2, node.y + node.h / 2 + 4);
  }

  const panelX = width - 280;
  const panelY = 32;
  ctx.fillStyle = hexToRgba(theme === 'dark' ? '#18181b' : '#ffffff', 0.94);
  ctx.fillRect(panelX, panelY, 240, height - 64);
  ctx.strokeStyle = hexToRgba(theme === 'dark' ? '#52525b' : '#d4d4d8', 0.8);
  ctx.strokeRect(panelX, panelY, 240, height - 64);

  ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#111827';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Constraint Checks', panelX + 12, panelY + 20);

  constraints.forEach((constraint, index) => {
    const y = panelY + 48 + index * 52;
    ctx.fillStyle = hexToRgba(constraint.satisfied ? '#22c55e' : '#ef4444', 0.12);
    ctx.fillRect(panelX + 12, y - 16, 216, 38);
    ctx.strokeStyle = hexToRgba(constraint.satisfied ? '#22c55e' : '#ef4444', 0.65);
    ctx.strokeRect(panelX + 12, y - 16, 216, 38);
    ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#111827';
    ctx.font = '11px monospace';
    ctx.fillText(constraint.label, panelX + 20, y);
    ctx.fillStyle = theme === 'dark' ? '#cbd5e1' : '#475569';
    ctx.fillText(`${constraint.left} ?= ${constraint.right}`, panelX + 20, y + 14);
  });
}
