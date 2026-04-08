import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawLine, drawGlowCircle, hexToRgba } from '@/lib/canvas';
import type { CurveConfig, CurvePoint, ScalarStep } from './logic';
import { DEFAULT_CURVE } from './logic';

interface RenderEllipticArgs {
  ctx: CanvasRenderingContext2D;
  points: CurvePoint[];
  pointA: CurvePoint | null;
  pointB: CurvePoint | null;
  result: CurvePoint | null;
  scalar: number;
  scalarResultPoint: CurvePoint | null;
  scalarSteps: ScalarStep[];
  theme: 'dark' | 'light';
  frame: FrameInfo;
  curve?: CurveConfig;
  attackChallenge?: {
    generator: CurvePoint;
    publicPoint: CurvePoint | null;
    groupOrder: number;
    solved: boolean;
  };
}

export function renderElliptic({
  ctx,
  points,
  pointA,
  pointB,
  result,
  scalar,
  scalarResultPoint,
  scalarSteps,
  theme,
  frame,
  curve = DEFAULT_CURVE,
  attackChallenge,
}: RenderEllipticArgs): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 36, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  const margin = 48;
  const plotSize = Math.max(220, Math.min(width - 320, height - 96));
  const originX = margin;
  const originY = height - margin;
  const scale = plotSize / Math.max(curve.p - 1, 1);

  const axisColor = hexToRgba(isDark ? '#a1a1aa' : '#52525b', 0.6);
  drawLine(ctx, originX, originY, originX + plotSize, originY, axisColor, 1);
  drawLine(ctx, originX, originY, originX, originY - plotSize, axisColor, 1);

  // Axis tick marks and labels
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = hexToRgba(isDark ? '#71717a' : '#a1a1aa', 0.8);

  // X-axis ticks (show ~5 evenly spaced ticks)
  const tickCount = Math.min(5, curve.p - 1);
  const tickStep = Math.max(1, Math.floor((curve.p - 1) / tickCount));
  for (let v = 0; v <= curve.p - 1; v += tickStep) {
    const tx = originX + v * scale;
    drawLine(ctx, tx, originY, tx, originY + 4, axisColor, 1);
    ctx.fillText(`${v}`, tx, originY + 6);
  }
  // Always show the last value (p-1)
  if ((curve.p - 1) % tickStep !== 0) {
    const tx = originX + (curve.p - 1) * scale;
    drawLine(ctx, tx, originY, tx, originY + 4, axisColor, 1);
    ctx.fillText(`${curve.p - 1}`, tx, originY + 6);
  }

  // Y-axis ticks
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= curve.p - 1; v += tickStep) {
    const ty = originY - v * scale;
    drawLine(ctx, originX - 4, ty, originX, ty, axisColor, 1);
    ctx.fillText(`${v}`, originX - 6, ty);
  }
  if ((curve.p - 1) % tickStep !== 0) {
    const ty = originY - (curve.p - 1) * scale;
    drawLine(ctx, originX - 4, ty, originX, ty, axisColor, 1);
    ctx.fillText(`${curve.p - 1}`, originX - 6, ty);
  }

  // Axis labels
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText('x', originX + plotSize / 2, originY + 18);

  ctx.save();
  ctx.translate(originX - 24, originY - plotSize / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('y', 0, 0);
  ctx.restore();

  const mapPoint = (point: CurvePoint) => ({
    x: originX + point.x * scale,
    y: originY - point.y * scale,
  });

  for (const point of points) {
    const mapped = mapPoint(point);
    const isA = pointA?.x === point.x && pointA?.y === point.y;
    const isB = pointB?.x === point.x && pointB?.y === point.y;
    const isR = result?.x === point.x && result?.y === point.y;
    const isAttackTarget = attackChallenge?.publicPoint?.x === point.x && attackChallenge?.publicPoint?.y === point.y;
    // Semantic: R=green(result), A=zinc-200(primary operand), B=zinc-400(secondary), rest=dim
    const color = attackChallenge && isAttackTarget
      ? attackChallenge.solved
        ? '#22c55e'
        : '#f59e0b'
      : isR
        ? '#22c55e'
        : isA
          ? '#e4e4e7'
          : isB
            ? '#a1a1aa'
            : isDark
              ? '#3f3f46'
              : '#d4d4d8';
    drawGlowCircle(ctx, mapped.x, mapped.y, isA || isB || isR || isAttackTarget ? 5 : 3, color, isA || isB || isR || isAttackTarget ? 0.65 : 0.3);
    if (attackChallenge && isAttackTarget) {
      ctx.strokeStyle = hexToRgba(attackChallenge.solved ? '#22c55e' : '#f59e0b', 0.95);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (pointA && pointB) {
    const a = mapPoint(pointA);
    const b = mapPoint(pointB);
    drawLine(ctx, a.x, a.y, b.x, b.y, hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.6), 1.5);
  }

  const panelX = width - 240;
  const panelY = 24;
  const panelW = 216;
  const panelH = height - 48;
  ctx.fillStyle = hexToRgba(isDark ? '#111113' : '#fafafa', 0.96);
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Elliptic Arithmetic', panelX + 12, panelY + 16);
  ctx.font = '10px monospace';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText(`y² = x³ + ${curve.a}x + ${curve.b} (mod ${curve.p})`, panelX + 12, panelY + 34);
  ctx.fillText(`${points.length} points | k = ${scalar}`, panelX + 12, panelY + 50);
  if (attackChallenge) {
    ctx.fillText(`G = ${pointText(attackChallenge.generator)}`, panelX + 12, panelY + 68);
    ctx.fillText(`Q = ${pointText(attackChallenge.publicPoint)}`, panelX + 12, panelY + 86);
    ctx.fillText(`${scalar}·G = ${pointText(scalarResultPoint)}`, panelX + 12, panelY + 104);
    ctx.fillText(`ord(G) = ${attackChallenge.groupOrder}`, panelX + 12, panelY + 122);
    ctx.fillStyle = attackChallenge.solved ? '#22c55e' : '#f59e0b';
    ctx.fillText(attackChallenge.solved ? 'Target matched' : 'Brute-force until k·G = Q', panelX + 12, panelY + 140);
  } else {
    ctx.fillText(`A = ${pointText(pointA)}`, panelX + 12, panelY + 68);
    ctx.fillText(`B = ${pointText(pointB)}`, panelX + 12, panelY + 86);
    ctx.fillText(`A + B = ${pointText(result)}`, panelX + 12, panelY + 104);
    ctx.fillText(`${scalar}·A = ${pointText(scalarResultPoint)}`, panelX + 12, panelY + 122);
  }

  ctx.fillStyle = isDark ? '#e4e4e7' : '#09090b';
  ctx.fillText('Double-and-add trace', panelX + 12, panelY + (attackChallenge ? 168 : 146));
  scalarSteps.slice(0, 8).forEach((step, index) => {
    const y = panelY + (attackChallenge ? 188 : 166) + index * 16;
    // add = zinc-200 (bright), double = zinc-500 (muted) — clear without arbitrary hue
    ctx.fillStyle = step.type === 'add' ? (isDark ? '#e4e4e7' : '#3f3f46') : (isDark ? '#71717a' : '#a1a1aa');
    ctx.fillText(`${index + 1}. ${step.type}`, panelX + 12, y);
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.fillText(pointText(step.accumulator), panelX + 76, y);
  });
}

function pointText(point: CurvePoint | null): string {
  return point ? `(${point.x},${point.y})` : '∞';
}
