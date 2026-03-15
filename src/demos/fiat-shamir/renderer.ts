import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, hexToRgba } from '@/lib/canvas';
import type { FiatShamirMode, TranscriptProof } from './logic';

export function renderFiatShamir(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  proof: TranscriptProof,
  forged: TranscriptProof | null,
  mode: FiatShamirMode,
  theme: 'dark' | 'light'
): void {
  const { width, height } = frame;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#0c0a09');
    gradient.addColorStop(1, '#1c1917');
  } else {
    gradient.addColorStop(0, '#fff7ed');
    gradient.addColorStop(1, '#fffbeb');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);
  drawGrid(ctx, width, height, 40, theme === 'dark' ? 'rgba(251,191,36,0.06)' : 'rgba(234,88,12,0.08)');

  const steps = [
    { label: '1. Commit', value: `t = ${proof.commitment}` },
    { label: '2. Challenge', value: `c = ${proof.challenge}` },
    { label: '3. Respond', value: `z = ${proof.response}` },
    { label: '4. Verify', value: proof.valid ? 'passes' : 'fails' },
  ];

  steps.forEach((step, index) => {
    const x = 56 + index * 170;
    const y = 120;
    ctx.fillStyle = hexToRgba(theme === 'dark' ? '#1f2937' : '#ffffff', 0.95);
    ctx.fillRect(x, y, 146, 88);
    ctx.strokeStyle = hexToRgba(index === 1 ? '#f97316' : '#cbd5e1', 0.65);
    ctx.strokeRect(x, y, 146, 88);
    ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#111827';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(step.label, x + 12, y + 24);
    ctx.font = '11px monospace';
    ctx.fillStyle = theme === 'dark' ? '#cbd5e1' : '#475569';
    ctx.fillText(step.value, x + 12, y + 50);
  });

  ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#111827';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(mode === 'interactive' ? 'Interactive verifier challenge' : mode === 'fs-correct' ? 'Fiat-Shamir with full transcript hash' : 'Broken Fiat-Shamir transcript', 56, 56);

  ctx.font = '11px monospace';
  ctx.fillStyle = theme === 'dark' ? '#cbd5e1' : '#475569';
  ctx.fillText(`Public key y = ${proof.publicKey}, statement = ${proof.statement}`, 56, 78);

  if (forged) {
    ctx.fillStyle = hexToRgba('#7c2d12', theme === 'dark' ? 0.75 : 0.12);
    ctx.fillRect(56, height - 132, width - 112, 88);
    ctx.strokeStyle = hexToRgba('#f97316', 0.6);
    ctx.strokeRect(56, height - 132, width - 112, 88);
    ctx.fillStyle = theme === 'dark' ? '#fed7aa' : '#9a3412';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Forgery succeeds because the challenge is predictable before commitment.', 72, height - 102);
    ctx.font = '11px monospace';
    ctx.fillText(`forged t=${forged.commitment}, c=${forged.challenge}, z=${forged.response}, valid=${String(forged.valid)}`, 72, height - 76);
  }
}
