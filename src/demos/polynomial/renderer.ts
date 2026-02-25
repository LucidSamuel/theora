import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import type { PolynomialState } from '@/types/polynomial';
import {
  drawGrid,
  drawLine,
  drawGlowCircle,
  drawText,
  drawRoundedRect,
  hexToRgba,
} from '@/lib/canvas';
import { generatePlotPoints } from './logic';

/**
 * Coordinate transformation utilities
 */
function mathToCanvas(
  mx: number,
  my: number,
  viewRange: { xMin: number; xMax: number; yMin: number; yMax: number },
  canvasW: number,
  canvasH: number
): { cx: number; cy: number } {
  const { xMin, xMax, yMin, yMax } = viewRange;

  // Add padding
  const padding = 40;
  const usableWidth = canvasW - 2 * padding;
  const usableHeight = canvasH - 2 * padding;

  const cx = padding + ((mx - xMin) / (xMax - xMin)) * usableWidth;
  const cy = padding + ((yMax - my) / (yMax - yMin)) * usableHeight;

  return { cx, cy };
}

function canvasToMath(
  cx: number,
  cy: number,
  viewRange: { xMin: number; xMax: number; yMin: number; yMax: number },
  canvasW: number,
  canvasH: number
): { mx: number; my: number } {
  const { xMin, xMax, yMin, yMax } = viewRange;

  // Add padding
  const padding = 40;
  const usableWidth = canvasW - 2 * padding;
  const usableHeight = canvasH - 2 * padding;

  const mx = xMin + ((cx - padding) / usableWidth) * (xMax - xMin);
  const my = yMax - ((cy - padding) / usableHeight) * (yMax - yMin);

  return { mx, my };
}

/**
 * Main rendering function for polynomial visualization
 */
export function renderPolynomial(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: PolynomialState,
  mouseX: number,
  mouseY: number,
  theme: 'dark' | 'light'
): {
  hovered:
    | { type: 'eval'; label: string; x: number; y: number }
    | { type: 'lagrange'; x: number; y: number }
    | { type: 'challenge'; z: number }
    | null;
} {
  const { width, height } = frame;
  const { coefficients, compareEnabled, compareCoefficients, evalPoints, lagrangePoints, kzg, viewRange } = state;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Theme colors
  const isDark = theme === 'dark';
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  if (isDark) {
    bgGradient.addColorStop(0, '#0a0a0a');
    bgGradient.addColorStop(1, '#111111');
  } else {
    bgGradient.addColorStop(0, '#fafafa');
    bgGradient.addColorStop(1, '#f4f4f5');
  }
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? 'rgba(240, 231, 222, 0.06)' : 'rgba(161, 161, 170, 0.1)';
  const axisColor = isDark ? '#52525b' : '#a1a1aa';

  // Background
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  const padding = 40;
  drawGrid(ctx, width, height, 40, gridColor);

  // Draw axes
  const originCanvas = mathToCanvas(0, 0, viewRange, width, height);
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 2;

  // X-axis
  if (originCanvas.cy >= padding && originCanvas.cy <= height - padding) {
    drawLine(ctx, padding, originCanvas.cy, width - padding, originCanvas.cy, axisColor, 2);
  }

  // Y-axis
  if (originCanvas.cx >= padding && originCanvas.cx <= width - padding) {
    drawLine(ctx, originCanvas.cx, padding, originCanvas.cx, height - padding, axisColor, 2);
  }

  // Draw tick marks and labels
  ctx.fillStyle = textColor;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';

  // X-axis ticks
  const xStep = Math.max(1, Math.floor((viewRange.xMax - viewRange.xMin) / 10));
  for (let x = Math.ceil(viewRange.xMin); x <= viewRange.xMax; x += xStep) {
    const pos = mathToCanvas(x, 0, viewRange, width, height);
    if (pos.cx >= padding && pos.cx <= width - padding) {
      ctx.fillRect(pos.cx - 1, pos.cy - 5, 2, 10);
      drawText(ctx, x.toString(), pos.cx, pos.cy + 20, { color: textColor, size: 12 });
    }
  }

  // Y-axis ticks
  ctx.textAlign = 'right';
  const yStep = Math.max(1, Math.floor((viewRange.yMax - viewRange.yMin) / 10));
  for (let y = Math.ceil(viewRange.yMin); y <= viewRange.yMax; y += yStep) {
    const pos = mathToCanvas(0, y, viewRange, width, height);
    if (pos.cy >= padding && pos.cy <= height - padding) {
      ctx.fillRect(pos.cx - 5, pos.cy - 1, 10, 2);
      drawText(ctx, y.toString(), pos.cx - 15, pos.cy + 4, { color: textColor, size: 12, align: 'right' });
    }
  }

  // Draw quotient polynomial if available (dimmer, in background)
  if (kzg.quotientPoly && kzg.quotientPoly.length > 0 && kzg.challengeZ !== null) {
    const quotientPoints = generatePlotPoints(
      kzg.quotientPoly,
      viewRange.xMin,
      viewRange.xMax,
      400
    );

    if (quotientPoints.length > 0) {
      ctx.beginPath();
      const firstPoint = quotientPoints[0];
      if (firstPoint) {
        const start = mathToCanvas(firstPoint.x, firstPoint.y, viewRange, width, height);
        ctx.moveTo(start.cx, start.cy);

        for (let i = 1; i < quotientPoints.length; i++) {
          const point = quotientPoints[i];
          if (point) {
            const pos = mathToCanvas(point.x, point.y, viewRange, width, height);
            ctx.lineTo(pos.cx, pos.cy);
          }
        }
      }

      ctx.strokeStyle = isDark ? '#52525b' : '#a1a1aa';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      drawText(ctx, 'q(x) - quotient polynomial', width - padding - 10, padding + 50, { color: isDark ? '#71717a' : '#a1a1aa', size: 14, align: 'right' });
    }
  }

  // Draw main polynomial curve
  if (coefficients.length > 0) {
    const plotPoints = generatePlotPoints(
      coefficients,
      viewRange.xMin,
      viewRange.xMax,
      400
    );

    if (plotPoints.length > 0) {
      ctx.beginPath();
      const firstPoint = plotPoints[0];
      if (firstPoint) {
        const start = mathToCanvas(firstPoint.x, firstPoint.y, viewRange, width, height);
        ctx.moveTo(start.cx, start.cy);

        for (let i = 1; i < plotPoints.length; i++) {
          const point = plotPoints[i];
          if (point) {
            const pos = mathToCanvas(point.x, point.y, viewRange, width, height);
            ctx.lineTo(pos.cx, pos.cy);
          }
        }
      }

      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Draw comparison curve + intersections
  let intersectionPoints: { x: number; y: number }[] = [];
  if (compareEnabled && compareCoefficients && compareCoefficients.length > 0 && coefficients.length > 0) {
    const comparePoints = generatePlotPoints(
      compareCoefficients,
      viewRange.xMin,
      viewRange.xMax,
      400
    );

    if (comparePoints.length > 0) {
      ctx.beginPath();
      const firstPoint = comparePoints[0];
      if (firstPoint) {
        const start = mathToCanvas(firstPoint.x, firstPoint.y, viewRange, width, height);
        ctx.moveTo(start.cx, start.cy);

        for (let i = 1; i < comparePoints.length; i++) {
          const point = comparePoints[i];
          if (point) {
            const pos = mathToCanvas(point.x, point.y, viewRange, width, height);
            ctx.lineTo(pos.cx, pos.cy);
          }
        }
      }

      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const mainPoints = generatePlotPoints(
      coefficients,
      viewRange.xMin,
      viewRange.xMax,
      400
    );

    for (let i = 1; i < mainPoints.length; i++) {
      const prev = mainPoints[i - 1];
      const curr = mainPoints[i];
      const prevB = comparePoints[i - 1];
      const currB = comparePoints[i];
      if (!prev || !curr || !prevB || !currB) continue;
      const d0 = prev.y - prevB.y;
      const d1 = curr.y - currB.y;
      if (d0 === 0) {
        intersectionPoints.push({ x: prev.x, y: prev.y });
      } else if (d0 * d1 < 0) {
        const t = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1));
        const ix = prev.x + (curr.x - prev.x) * t;
        const iy = prev.y + (curr.y - prev.y) * t;
        intersectionPoints.push({ x: ix, y: iy });
      }
    }

    intersectionPoints.forEach((p) => {
      const pos = mathToCanvas(p.x, p.y, viewRange, width, height);
      drawGlowCircle(ctx, pos.cx, pos.cy, 5, '#d4d4d8', 0.4);
    });

    if (intersectionPoints.length > 0) {
      drawText(
        ctx,
        `Intersections: ${intersectionPoints.length}`,
        width - padding - 12,
        padding + 24,
        { color: '#d4d4d8', size: 12, align: 'right' }
      );
    }
  }

  // Draw KZG challenge line (vertical dashed line)
  if (kzg.challengeZ !== null) {
    const challengePos = mathToCanvas(kzg.challengeZ, 0, viewRange, width, height);

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(challengePos.cx, padding);
    ctx.lineTo(challengePos.cx, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    drawText(ctx, `z = ${kzg.challengeZ.toFixed(2)}`, challengePos.cx, padding + 20, { color: '#a1a1aa', size: 14 });
  }

  // Draw revealed point (highlighted)
  if (kzg.challengeZ !== null && kzg.revealedValue !== null) {
    const revealedPos = mathToCanvas(
      kzg.challengeZ,
      kzg.revealedValue,
      viewRange,
      width,
      height
    );

    drawGlowCircle(ctx, revealedPos.cx, revealedPos.cy, 8, '#d4d4d8', 0.5);

    // Label
    drawText(ctx, `p(z) = ${kzg.revealedValue.toFixed(2)}`, revealedPos.cx + 15, revealedPos.cy - 15, { color: '#d4d4d8', size: 14 });
  }

  // Draw evaluation points
  for (const evalPoint of evalPoints) {
    const pos = mathToCanvas(evalPoint.x, evalPoint.y, viewRange, width, height);

    drawGlowCircle(ctx, pos.cx, pos.cy, 6, '#a1a1aa', 0.4);

    // Label
    const label = evalPoint.label ?? `(${evalPoint.x.toFixed(1)}, ${evalPoint.y.toFixed(1)})`;
    drawText(ctx, label, pos.cx + 12, pos.cy - 12, { color: '#a1a1aa', size: 12 });
  }

  // Draw Lagrange points as diamonds
  for (const point of lagrangePoints) {
    const pos = mathToCanvas(point.x, point.y, viewRange, width, height);

    ctx.save();
    ctx.translate(pos.cx, pos.cy);
    ctx.rotate(Math.PI / 4);

    ctx.fillStyle = '#71717a';
    ctx.fillRect(-6, -6, 12, 12);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-6, -6, 12, 12);

    ctx.restore();

    // Label
    drawText(ctx, `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`, pos.cx + 12, pos.cy - 12, { color: '#71717a', size: 12 });
  }

  // Draw commitment badge at top
  if (kzg.commitment) {
    const badgeX = width / 2;
    const badgeY = padding + 30;

    drawRoundedRect(ctx, badgeX - 150, badgeY - 20, 300, 40, 8);
    ctx.fillStyle = hexToRgba('#71717a', 0.2);
    ctx.fill();
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawText(ctx, `Commitment: ${kzg.commitment.slice(0, 16)}...`, badgeX, badgeY, { color: '#71717a', size: 14 });
  }

  // Draw verification status
  if (kzg.verified !== null) {
    const statusX = width - padding - 100;
    const statusY = padding + 30;

    const statusColor = kzg.verified ? '#10b981' : '#ef4444';
    const statusText = kzg.verified ? '✓ Verified' : '✗ Failed';

    drawRoundedRect(ctx, statusX - 60, statusY - 20, 120, 40, 8);
    ctx.fillStyle = hexToRgba(statusColor, 0.2);
    ctx.fill();
    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawText(ctx, statusText, statusX, statusY, { color: statusColor, size: 16 });
  }

  // Hover detection (evaluation points > lagrange points > challenge line)
  let hovered:
    | { type: 'eval'; label: string; x: number; y: number }
    | { type: 'lagrange'; x: number; y: number }
    | { type: 'challenge'; z: number }
    | null = null;

  const evalThreshold = 10;
  for (const evalPoint of evalPoints) {
    const pos = mathToCanvas(evalPoint.x, evalPoint.y, viewRange, width, height);
    const dx = mouseX - pos.cx;
    const dy = mouseY - pos.cy;
    if (Math.sqrt(dx * dx + dy * dy) <= evalThreshold) {
      hovered = {
        type: 'eval',
        label: evalPoint.label ?? `(${evalPoint.x.toFixed(1)}, ${evalPoint.y.toFixed(1)})`,
        x: evalPoint.x,
        y: evalPoint.y,
      };
      break;
    }
  }

  if (!hovered) {
    const lagrangeThreshold = 12;
    for (const point of lagrangePoints) {
      const pos = mathToCanvas(point.x, point.y, viewRange, width, height);
      const dx = mouseX - pos.cx;
      const dy = mouseY - pos.cy;
      if (Math.sqrt(dx * dx + dy * dy) <= lagrangeThreshold) {
        hovered = { type: 'lagrange', x: point.x, y: point.y };
        break;
      }
    }
  }

  if (!hovered && kzg.challengeZ !== null) {
    const challengePos = mathToCanvas(kzg.challengeZ, 0, viewRange, width, height);
    if (Math.abs(mouseX - challengePos.cx) <= 6 && mouseY >= padding && mouseY <= height - padding) {
      hovered = { type: 'challenge', z: kzg.challengeZ };
    }
  }

  return { hovered };
}

export { mathToCanvas, canvasToMath };
