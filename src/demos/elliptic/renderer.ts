import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawLine, drawGlowCircle, hexToRgba } from '@/lib/canvas';
import type { CurvePoint, ScalarStep } from './logic';

interface RenderEllipticArgs {
  ctx: CanvasRenderingContext2D;
  points: CurvePoint[];
  pointA: CurvePoint | null;
  pointB: CurvePoint | null;
  result: CurvePoint | null;
  scalar: number;
  scalarSteps: ScalarStep[];
  theme: 'dark' | 'light';
  frame: FrameInfo;
}

export function renderElliptic({
  ctx,
  points,
  pointA,
  pointB,
  result,
  scalar,
  scalarSteps,
  theme,
  frame,
}: RenderEllipticArgs): void {
  const { width, height } = frame;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#050816');
    gradient.addColorStop(1, '#0f172a');
  } else {
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#eef2ff');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);
  drawGrid(ctx, width, height, 36, theme === 'dark' ? 'rgba(228,228,231,0.05)' : 'rgba(82,82,91,0.08)');

  const margin = 48;
  const plotSize = Math.max(220, Math.min(width - 320, height - 96));
  const originX = margin;
  const originY = height - margin;
  const scale = plotSize / 96;

  drawLine(ctx, originX, originY, originX + plotSize, originY, hexToRgba(theme === 'dark' ? '#a1a1aa' : '#52525b', 0.8), 1);
  drawLine(ctx, originX, originY, originX, originY - plotSize, hexToRgba(theme === 'dark' ? '#a1a1aa' : '#52525b', 0.8), 1);

  const mapPoint = (point: CurvePoint) => ({
    x: originX + point.x * scale,
    y: originY - point.y * scale,
  });

  for (const point of points) {
    const mapped = mapPoint(point);
    const isA = pointA?.x === point.x && pointA?.y === point.y;
    const isB = pointB?.x === point.x && pointB?.y === point.y;
    const isR = result?.x === point.x && result?.y === point.y;
    const color = isR ? '#22c55e' : isA ? '#38bdf8' : isB ? '#f59e0b' : theme === 'dark' ? '#d4d4d8' : '#52525b';
    drawGlowCircle(ctx, mapped.x, mapped.y, isA || isB || isR ? 5 : 3, color, isA || isB || isR ? 0.65 : 0.3);
  }

  if (pointA && pointB) {
    const a = mapPoint(pointA);
    const b = mapPoint(pointB);
    drawLine(ctx, a.x, a.y, b.x, b.y, hexToRgba('#94a3b8', 0.45), 1.5);
  }

  const panelX = width - 240;
  const panelY = 24;
  const panelW = 216;
  const panelH = height - 48;
  ctx.fillStyle = hexToRgba(theme === 'dark' ? '#18181b' : '#fafafa', 0.94);
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = hexToRgba(theme === 'dark' ? '#3f3f46' : '#d4d4d8', 0.75);
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = theme === 'dark' ? '#fafafa' : '#111827';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Elliptic Arithmetic', panelX + 12, panelY + 16);
  ctx.font = '10px monospace';
  ctx.fillStyle = theme === 'dark' ? '#a1a1aa' : '#52525b';
  ctx.fillText(`Scalar k = ${scalar}`, panelX + 12, panelY + 34);
  ctx.fillText(`A = ${pointText(pointA)}`, panelX + 12, panelY + 54);
  ctx.fillText(`B = ${pointText(pointB)}`, panelX + 12, panelY + 72);
  ctx.fillText(`A + B = ${pointText(result)}`, panelX + 12, panelY + 90);

  ctx.fillStyle = theme === 'dark' ? '#e5e7eb' : '#111827';
  ctx.fillText('Double-and-add trace', panelX + 12, panelY + 116);
  scalarSteps.slice(0, 8).forEach((step, index) => {
    const y = panelY + 136 + index * 16;
    ctx.fillStyle = step.type === 'add' ? '#38bdf8' : '#f59e0b';
    ctx.fillText(`${index + 1}. ${step.type}`, panelX + 12, y);
    ctx.fillStyle = theme === 'dark' ? '#a1a1aa' : '#52525b';
    ctx.fillText(pointText(step.accumulator), panelX + 76, y);
  });
}

function pointText(point: CurvePoint | null): string {
  return point ? `(${point.x},${point.y})` : '∞';
}
