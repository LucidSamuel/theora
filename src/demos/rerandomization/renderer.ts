import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { MatchCard, ProofArtifact } from './logic';

interface HoverRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
}

function formatByte(value: number): string {
  return value.toString(16).padStart(2, '0');
}

/** Amber highlight color for changed bytes. */
const CHANGED_BG = '#f59e0b';
const CHANGED_BORDER = '#d97706';

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const measured = ctx.measureText(text).width;
  if (measured <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '\u2026').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '\u2026';
}

function drawProofBytes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  title: string,
  proof: ProofArtifact,
  comparison: ProofArtifact | null,
  accent: string,
  theme: 'dark' | 'light',
  hoverRegions: HoverRegion[]
) {
  ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.88)';
  drawRoundedRect(ctx, x, y, width, 212, 14);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(accent, 0.45);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, width, 212, 14);
  ctx.stroke();

  ctx.fillStyle = theme === 'dark' ? '#fafafa' : '#09090b';
  ctx.font = '700 13px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  const titleMaxWidth = width - 32;
  ctx.fillText(truncateText(ctx, title, titleMaxWidth), x + 16, y + 24);

  proof.components.forEach((component, componentIndex) => {
    const rowY = y + 52 + componentIndex * 52;
    ctx.fillStyle = theme === 'dark' ? '#a1a1aa' : '#52525b';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText(component.label, x + 16, rowY);

    component.bytes.forEach((byte, byteIndex) => {
      const byteX = x + 16 + byteIndex * 28;
      const byteY = rowY + 10;
      const compareByte = comparison?.components[componentIndex]?.bytes[byteIndex];
      const changed = compareByte !== undefined && compareByte !== byte;
      ctx.fillStyle = changed
        ? hexToRgba(CHANGED_BG, 0.3)
        : theme === 'dark'
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(15,23,42,0.06)';
      drawRoundedRect(ctx, byteX, byteY, 22, 22, 6);
      ctx.fill();
      ctx.strokeStyle = changed
        ? hexToRgba(CHANGED_BORDER, 0.9)
        : hexToRgba('#94a3b8', 0.25);
      ctx.lineWidth = changed ? 1.5 : 1;
      drawRoundedRect(ctx, byteX, byteY, 22, 22, 6);
      ctx.stroke();
      ctx.fillStyle = changed
        ? (theme === 'dark' ? '#fbbf24' : '#92400e')
        : (theme === 'dark' ? '#e4e4e7' : '#18181b');
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(formatByte(byte), byteX + 3, byteY + 14);
      hoverRegions.push({
        x: byteX,
        y: byteY,
        w: 22,
        h: 22,
        title: `${title} • ${component.label}`,
        body: changed && compareByte !== undefined
          ? `byte ${byteIndex}: 0x${formatByte(byte)} ≠ 0x${formatByte(compareByte)}`
          : `byte ${byteIndex}: 0x${formatByte(byte)} unchanged`,
      });
    });
  });
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  region: HoverRegion,
  theme: 'dark' | 'light'
) {
  const isDark = theme === 'dark';
  const padding = 10;
  const lineHeight = 14;

  ctx.save();
  ctx.font = '700 11px "Space Grotesk", sans-serif';
  const titleWidth = ctx.measureText(region.title).width;
  ctx.font = '11px "JetBrains Mono", monospace';
  const bodyWidth = ctx.measureText(region.body).width;
  const tooltipW = Math.max(titleWidth, bodyWidth) + padding * 2;
  const tooltipH = padding * 2 + lineHeight * 2 + 4;

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
  ctx.font = '700 11px "Space Grotesk", sans-serif';
  ctx.fillText(region.title, tooltipX + padding, tooltipY + padding + 10);
  ctx.fillStyle = isDark ? '#d4d4d8' : '#52525b';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(region.body, tooltipX + padding, tooltipY + padding + 10 + lineHeight + 4);
  ctx.restore();
}

export function renderRerandomization(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  original: ProofArtifact,
  rerandomized: ProofArtifact,
  changedBytes: number,
  cards: MatchCard[],
  guessLabels: string[],
  theme: 'dark' | 'light',
  mouseX?: number,
  mouseY?: number
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

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = '700 20px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Proof Rerandomization', 40, 44);
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '12px "Space Grotesk", sans-serif';
  const subtitle = `${changedBytes} bytes changed, but the statement hash stayed fixed`;
  ctx.fillText(truncateText(ctx, subtitle, width - 80), 40, 66);

  const panelWidth = (width - 120) / 2;
  drawProofBytes(ctx, 40, 92, panelWidth, 'Original proof', original, rerandomized, '#38bdf8', theme, hoverRegions);
  drawProofBytes(ctx, 80 + panelWidth, 92, panelWidth, 'Rerandomized proof', rerandomized, original, '#a78bfa', theme, hoverRegions);

  ctx.fillStyle = hexToRgba('#22c55e', 0.2);
  drawRoundedRect(ctx, 40, 322, width - 80, 40, 999);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.fillText(truncateText(ctx, 'verified: same statement, different proof transcript', width - 120), 56, 346);

  ctx.fillStyle = isDark ? '#e4e4e7' : '#18181b';
  ctx.font = '600 13px "Space Grotesk", sans-serif';
  ctx.fillText('Matching game', 40, 402);
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.fillText(truncateText(ctx, 'Can you match each rerandomized proof back to its original source?', width - 80), 40, 424);

  cards.forEach((card, index) => {
    const y = 450 + index * 70;
    ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.88)';
    drawRoundedRect(ctx, 40, y, width - 80, 52, 12);
    ctx.fill();
    ctx.strokeStyle = hexToRgba('#94a3b8', 0.26);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 40, y, width - 80, 52, 12);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(`${card.proof.proofHash.slice(0, 18)}…`, 56, y + 22);

    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText(guessLabels[index] ?? 'No guess yet', 56, y + 40);
    hoverRegions.push({
      x: 40,
      y,
      w: width - 80,
      h: 52,
      title: card.proof.statementLabel,
      body: guessLabels[index] ?? 'No guess yet',
    });
  });

  if (typeof mouseX === 'number' && typeof mouseY === 'number') {
    const hovered = hoverRegions.find((region) =>
      mouseX >= region.x && mouseX <= region.x + region.w && mouseY >= region.y && mouseY <= region.y + region.h
    );
    if (hovered) {
      drawTooltip(ctx, width, height, hovered, theme);
    }
  }
}
