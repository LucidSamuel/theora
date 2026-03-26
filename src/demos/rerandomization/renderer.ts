import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { MatchCard, ProofArtifact } from './logic';

function formatByte(value: number): string {
  return value.toString(16).padStart(2, '0');
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
  theme: 'dark' | 'light'
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
  ctx.fillText(title, x + 16, y + 24);

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
        ? hexToRgba(accent, 0.22)
        : theme === 'dark'
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(15,23,42,0.06)';
      drawRoundedRect(ctx, byteX, byteY, 22, 22, 6);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(changed ? accent : '#94a3b8', changed ? 0.8 : 0.25);
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, byteX, byteY, 22, 22, 6);
      ctx.stroke();
      ctx.fillStyle = theme === 'dark' ? '#e4e4e7' : '#18181b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(formatByte(byte), byteX + 3, byteY + 14);
    });
  });
}

export function renderRerandomization(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  original: ProofArtifact,
  rerandomized: ProofArtifact,
  changedBytes: number,
  cards: MatchCard[],
  guessLabels: string[],
  theme: 'dark' | 'light'
) {
  const { width, height } = frame;
  const isDark = theme === 'dark';
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
  ctx.fillText(`${changedBytes} bytes changed, but the statement hash stayed fixed`, 40, 66);

  const panelWidth = (width - 120) / 2;
  drawProofBytes(ctx, 40, 92, panelWidth, 'Original proof', original, rerandomized, '#38bdf8', theme);
  drawProofBytes(ctx, 80 + panelWidth, 92, panelWidth, 'Rerandomized proof', rerandomized, original, '#a78bfa', theme);

  ctx.fillStyle = hexToRgba('#22c55e', 0.2);
  drawRoundedRect(ctx, 40, 322, width - 80, 40, 999);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.fillText('verified: same statement, different proof transcript', 56, 346);

  ctx.fillStyle = isDark ? '#e4e4e7' : '#18181b';
  ctx.font = '600 13px "Space Grotesk", sans-serif';
  ctx.fillText('Matching game', 40, 402);
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.fillText('Can you match each rerandomized proof back to its original source?', 40, 424);

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
  });
}
