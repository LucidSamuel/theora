import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { ConstraintProfile } from './logic';

const HASH_COLORS: Record<string, string> = {
  'SHA-256': '#ef4444',
  Pedersen: '#f97316',
  Poseidon: '#38bdf8',
};

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillRatio: number,
  color: string,
  label: string,
  value: string,
  theme: 'dark' | 'light',
) {
  ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  drawRoundedRect(ctx, x, y, width, height, 8);
  ctx.fill();

  ctx.fillStyle = hexToRgba(color, 0.78);
  drawRoundedRect(ctx, x, y, Math.max(8, width * Math.max(0, Math.min(1, fillRatio))), height, 8);
  ctx.fill();

  ctx.fillStyle = theme === 'dark' ? '#fafafa' : '#09090b';
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 16);

  ctx.fillStyle = theme === 'dark' ? '#d4d4d8' : '#52525b';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(value, x + 12, y + height - 8);
}

function logScale(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.log10(value + 1) / Math.log10(maxValue + 1);
}

export interface BarEntry {
  profile: ConstraintProfile;
  r1cs: string;
  bootle16: string;
  weight: number;
}

interface HoverRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  region: HoverRegion,
  theme: 'dark' | 'light',
) {
  const isDark = theme === 'dark';
  const titleFont = '700 11px "Space Grotesk", sans-serif';
  const bodyFont = '11px "JetBrains Mono", monospace';
  const paddingX = 10;
  const paddingY = 8;
  const lineGap = 6;

  ctx.save();
  ctx.font = titleFont;
  const titleWidth = ctx.measureText(region.title).width;
  ctx.font = bodyFont;
  const bodyWidth = ctx.measureText(region.body).width;
  const tooltipW = Math.max(titleWidth, bodyWidth) + paddingX * 2;
  const tooltipH = paddingY * 2 + 14 + lineGap + 12;

  let tooltipX = region.x + region.w + 10;
  if (tooltipX + tooltipW > width - 10) tooltipX = region.x - tooltipW - 10;
  if (tooltipX < 10) tooltipX = 10;

  let tooltipY = region.y + region.h / 2 - tooltipH / 2;
  if (tooltipY + tooltipH > height - 10) tooltipY = height - tooltipH - 10;
  if (tooltipY < 10) tooltipY = 10;

  ctx.fillStyle = isDark ? 'rgba(24,24,27,0.96)' : 'rgba(255,255,255,0.96)';
  drawRoundedRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 8);
  ctx.fill();

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = titleFont;
  ctx.textAlign = 'left';
  ctx.fillText(region.title, tooltipX + paddingX, tooltipY + paddingY + 10);

  ctx.fillStyle = isDark ? '#d4d4d8' : '#52525b';
  ctx.font = bodyFont;
  ctx.fillText(region.body, tooltipX + paddingX, tooltipY + paddingY + 10 + lineGap + 12);
  ctx.restore();
}

export function renderConstraintCounter(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  profiles: ConstraintProfile[],
  perHashValues: BarEntry[],
  pathValues: BarEntry[],
  fullTreeValues: BarEntry[],
  depth: number,
  theme: 'dark' | 'light',
  mouseX?: number,
  mouseY?: number,
) {
  const { width, height } = frame;
  const isDark = theme === 'dark';
  const hoverRegions: HoverRegion[] = [];

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  bg.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = bg;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  // Title
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = '700 20px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Pedersen vs Poseidon vs SHA-256', 40, 48);

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.fillText(`Depth-${depth} Merkle constraint costs (log scale)`, 40, 70);

  const barWidth = width - 80;
  const barH = 44;
  const barGap = 6;
  const sectionGap = 36;
  const sectionTitleH = 22;
  const barsPerSection = profiles.length;
  const sectionH = sectionTitleH + barsPerSection * (barH + barGap);

  const startY = 100;
  const sections = [
    { title: 'Per-hash cost', entries: perHashValues },
    { title: `Authentication path (${depth} hashes)`, entries: pathValues },
    { title: `Full tree build (2\u00B2\u2070\u207B\u00B9 = ${depth} levels)`, entries: fullTreeValues },
  ];
  // fix: show actual depth in full tree title
  sections[2]!.title = `Full tree build (${depth} levels)`;

  sections.forEach((section, si) => {
    const sy = startY + si * (sectionH + sectionGap);
    ctx.fillStyle = isDark ? '#e4e4e7' : '#18181b';
    ctx.font = '600 13px "Space Grotesk", sans-serif';
    ctx.fillText(section.title, 40, sy);

    const maxWeight = Math.max(...section.entries.map((e) => e.weight), 1);
    section.entries.forEach((entry, bi) => {
      const by = sy + sectionTitleH + bi * (barH + barGap);
      const ratio = logScale(entry.weight, maxWeight);
      const color = HASH_COLORS[entry.profile.name] ?? '#a1a1aa';
      drawBar(ctx, 40, by, barWidth, barH, ratio, color, entry.profile.name, `R1CS ${entry.r1cs}  ·  Bootle16 ${entry.bootle16}`, theme);
      hoverRegions.push({
        x: 40,
        y: by,
        w: barWidth,
        h: barH,
        title: `${section.title} • ${entry.profile.name}`,
        body: `R1CS ${entry.r1cs} · Bootle16 ${entry.bootle16}`,
      });
    });
  });

  // Summary footer
  const summaryY = startY + sections.length * (sectionH + sectionGap) + 4;
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  drawRoundedRect(ctx, 40, summaryY, barWidth, 36, 10);
  ctx.fill();
  ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.fillText(
    'Poseidon uses native field ops (~63 R1CS). Pedersen needs ~256 scalar muls (~850). SHA-256 decomposes bitwise ops (~25k).',
    52,
    summaryY + 22,
  );

  if (typeof mouseX === 'number' && typeof mouseY === 'number') {
    const hovered = hoverRegions.find((region) =>
      mouseX >= region.x && mouseX <= region.x + region.w && mouseY >= region.y && mouseY <= region.y + region.h
    );
    if (hovered) {
      drawTooltip(ctx, width, height, hovered, theme);
    }
  }
}
