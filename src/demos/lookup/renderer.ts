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
  const isDark = theme === 'dark';

  // ── Background ────────────────────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Columns ───────────────────────────────────────────────────────────────
  // Table (lookup definition)  → zinc-200 (primary, "the source of truth")
  // Wires (queried values)     → zinc-500 (secondary, "the queries")
  // Row connectors             → green (all pass) / red (violations)
  const colY = 96;
  const colW = 180;
  const rowH = 34;
  const leftX = 72;
  const rightX = width / 2 + 24;

  const tableColor = isDark ? '#e4e4e7' : '#3f3f46';  // zinc-200 / zinc-700
  const wiresColor = isDark ? '#71717a' : '#a1a1aa';  // zinc-500 / zinc-400

  drawColumn(ctx, leftX,  colY, colW, rowH, 'Table', analysis.sortedTable, isDark, tableColor);
  drawColumn(ctx, rightX, colY, colW, rowH, 'Wires', analysis.sortedWires, isDark, wiresColor);

  // Row connector lines
  const rows = Math.min(analysis.sortedTable.length, analysis.sortedWires.length);
  for (let i = 0; i < rows; i++) {
    drawLine(
      ctx,
      leftX + colW,
      colY + 40 + i * rowH,
      rightX,
      colY + 40 + i * rowH,
      hexToRgba(analysis.passes ? '#22c55e' : '#ef4444', isDark ? 0.3 : 0.25),
      1.5
    );
  }

  // ── Heading ────────────────────────────────────────────────────────────────
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Lookup multiset check', 72, 52);

  ctx.font = '11px monospace';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText(
    analysis.passes
      ? 'All queried wires fit inside the lookup table.'
      : `Missing: [${analysis.missing.join(', ')}], multiplicity issues: [${analysis.multiplicityMismatches.join(', ')}]`,
    72,
    72
  );

  // ── Pass / fail badge ─────────────────────────────────────────────────────
  const badgeX = rightX + colW + 24;
  const badgeY = colY;
  const badgeColor = analysis.passes ? '#22c55e' : '#ef4444';
  ctx.fillStyle = hexToRgba(badgeColor, isDark ? 0.1 : 0.07);
  ctx.fillRect(badgeX, badgeY, 120, 40);
  ctx.strokeStyle = hexToRgba(badgeColor, isDark ? 0.6 : 0.5);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(badgeX, badgeY, 120, 40);
  ctx.fillStyle = badgeColor;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(analysis.passes ? '✓ PASS' : '✗ FAIL', badgeX + 60, badgeY + 24);
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  title: string,
  values: number[],
  isDark: boolean,
  accent: string
): void {
  const bgColor = hexToRgba(isDark ? '#111113' : '#ffffff', 0.96);
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, width, Math.max(120, values.length * rowHeight + 16));
  ctx.strokeStyle = hexToRgba(accent, isDark ? 0.55 : 0.4);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, Math.max(120, values.length * rowHeight + 16));

  // Column header accent bar
  ctx.fillStyle = hexToRgba(accent, isDark ? 0.12 : 0.1);
  ctx.fillRect(x, y, width, 28);

  ctx.fillStyle = accent;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 12, y + 18);

  ctx.fillStyle = isDark ? '#e4e4e7' : '#09090b';
  ctx.font = '11px monospace';
  values.forEach((value, index) => {
    ctx.fillText(String(value), x + 14, y + 44 + index * rowHeight);
  });
}
