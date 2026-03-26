import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { ConstraintProfile } from './logic';

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
  theme: 'dark' | 'light'
) {
  ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  drawRoundedRect(ctx, x, y, width, height, 8);
  ctx.fill();

  ctx.fillStyle = hexToRgba(color, 0.78);
  drawRoundedRect(ctx, x, y, Math.max(8, width * fillRatio), height, 8);
  ctx.fill();

  ctx.fillStyle = theme === 'dark' ? '#fafafa' : '#09090b';
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 18);

  ctx.fillStyle = theme === 'dark' ? '#d4d4d8' : '#52525b';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(value, x + 12, y + height - 10);
}

export function renderConstraintCounter(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  profiles: ConstraintProfile[],
  perHashValues: Array<{ profile: ConstraintProfile; r1cs: string; bootle16: string }>,
  pathValues: Array<{ profile: ConstraintProfile; r1cs: string; bootle16: string; pathWeight: number }>,
  fullTreeValues: Array<{ profile: ConstraintProfile; r1cs: string; bootle16: string; treeWeight: number }>,
  depth: number,
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
  ctx.fillText('Pedersen vs Poseidon', 40, 48);

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.fillText(`Depth-${depth} Merkle path and full-tree cost amplification`, 40, 70);

  const colors = ['#f97316', '#38bdf8'];
  const maxPathWeight = Math.max(...pathValues.map((value) => value.pathWeight), 1);
  const maxTreeWeight = Math.max(...fullTreeValues.map((value) => value.treeWeight), 1);

  const sectionY = [110, 270, 470];
  const sectionTitles = [
    'Single hash cost',
    `Merkle authentication path (${depth} hashes)`,
    `Full tree build (${depth} levels)`,
  ];

  sectionTitles.forEach((title, index) => {
    ctx.fillStyle = isDark ? '#e4e4e7' : '#18181b';
    ctx.font = '600 13px "Space Grotesk", sans-serif';
    ctx.fillText(title, 40, sectionY[index]! - 18);
  });

  perHashValues.forEach((value, index) => {
    const y = sectionY[0]! + index * 68;
    drawBar(ctx, 40, y, width - 80, 52, 1, colors[index]!, value.profile.name, `R1CS ${value.r1cs}  |  Bootle16 ${value.bootle16}`, theme);
  });

  pathValues.forEach((value, index) => {
    const y = sectionY[1]! + index * 82;
    drawBar(ctx, 40, y, width - 80, 64, value.pathWeight / maxPathWeight, colors[index]!, value.profile.name, `R1CS ${value.r1cs}  |  Bootle16 ${value.bootle16}`, theme);
  });

  fullTreeValues.forEach((value, index) => {
    const y = sectionY[2]! + index * 82;
    drawBar(ctx, 40, y, width - 80, 64, value.treeWeight / maxTreeWeight, colors[index]!, value.profile.name, `R1CS ${value.r1cs}  |  Bootle16 ${value.bootle16}`, theme);
  });

  const summaryY = height - 56;
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  drawRoundedRect(ctx, 40, summaryY, width - 80, 36, 10);
  ctx.fill();
  ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.fillText(
    `${profiles[0]?.name} stays expensive because every hash burns fixed-base constraints. ${profiles[1]?.name} keeps the same Merkle logic with a much smaller arithmetic footprint.`,
    52,
    summaryY + 22
  );
}
