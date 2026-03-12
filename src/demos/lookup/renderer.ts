import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawLine, hexToRgba } from '@/lib/canvas';
import type { LookupAnalysis } from './logic';

export function renderLookup(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  analysis: LookupAnalysis,
  theme: 'dark' | 'light'
): void {
  const { width, height } = frame;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#082f49');
    gradient.addColorStop(1, '#0f172a');
  } else {
    gradient.addColorStop(0, '#f0f9ff');
    gradient.addColorStop(1, '#e0f2fe');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, 40, theme === 'dark' ? 'rgba(56,189,248,0.08)' : 'rgba(14,116,144,0.08)');

  const colY = 96;
  const colW = 180;
  const rowH = 34;
  const leftX = 72;
  const rightX = width / 2 + 24;

  drawColumn(ctx, leftX, colY, colW, rowH, 'Table', analysis.sortedTable, theme, '#38bdf8');
  drawColumn(ctx, rightX, colY, colW, rowH, 'Wires', analysis.sortedWires, theme, '#f59e0b');

  const rows = Math.min(analysis.sortedTable.length, analysis.sortedWires.length);
  for (let i = 0; i < rows; i++) {
    drawLine(
      ctx,
      leftX + colW,
      colY + 40 + i * rowH,
      rightX,
      colY + 40 + i * rowH,
      hexToRgba(analysis.passes ? '#22c55e' : '#ef4444', 0.35),
      1.5
    );
  }

  ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#111827';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('Lookup multiset check', 72, 52);
  ctx.font = '11px monospace';
  ctx.fillStyle = theme === 'dark' ? '#cbd5e1' : '#475569';
  ctx.fillText(
    analysis.passes
      ? 'All queried wires fit inside the lookup table.'
      : `Missing: [${analysis.missing.join(', ')}], multiplicity issues: [${analysis.multiplicityMismatches.join(', ')}]`,
    72,
    72
  );
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  title: string,
  values: number[],
  theme: 'dark' | 'light',
  accent: string
): void {
  ctx.fillStyle = hexToRgba(theme === 'dark' ? '#111827' : '#ffffff', 0.94);
  ctx.fillRect(x, y, width, Math.max(120, values.length * rowHeight + 16));
  ctx.strokeStyle = hexToRgba(accent, 0.65);
  ctx.strokeRect(x, y, width, Math.max(120, values.length * rowHeight + 16));
  ctx.fillStyle = accent;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(title, x + 12, y + 20);
  ctx.fillStyle = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  ctx.font = '11px monospace';

  values.forEach((value, index) => {
    ctx.fillText(String(value), x + 14, y + 44 + index * rowHeight);
  });
}
