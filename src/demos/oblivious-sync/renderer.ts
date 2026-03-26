import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { SyncRoundDetails, SyncScenario } from './logic';

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  accent: string,
  theme: 'dark' | 'light'
) {
  ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.88)';
  drawRoundedRect(ctx, x, y, width, height, 14);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(accent, 0.45);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, width, height, 14);
  ctx.stroke();

  ctx.fillStyle = hexToRgba(accent, 0.92);
  ctx.font = '700 14px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 16, y + 24);
}

export function renderObliviousSync(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  scenario: SyncScenario,
  round: number,
  details: SyncRoundDetails,
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
  ctx.fillText('Oblivious Sync', 40, 46);

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.fillText(`Round ${round + 1} of 5: ${details.title}`, 40, 68);

  const walletX = 40;
  const panelY = 104;
  const panelW = Math.max(280, width * 0.34);
  const panelH = 310;
  const serviceX = width - panelW - 40;

  drawPanel(ctx, walletX, panelY, panelW, panelH, 'Wallet', '#38bdf8', theme);
  drawPanel(ctx, serviceX, panelY, panelW, panelH, 'Remote Service', '#a78bfa', theme);

  const walletLines = scenario.walletQueries.slice(0, 4).map((query, index) =>
    round === 0
      ? `n${index}: blind ${query.blind} -> ${query.blinded}`
      : `n${index}: ${query.blinded}`
  );
  const serviceLines = [
    `spent root ${scenario.serviceCommitment.slice(0, 10)}…`,
    ...scenario.serviceSpentSet.slice(0, 3).map((entry, index) => `spent[${index}] ${entry}`),
  ];

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  walletLines.forEach((line, index) => {
    ctx.fillStyle = isDark ? '#d4d4d8' : '#27272a';
    ctx.fillText(line, walletX + 16, panelY + 62 + index * 28);
  });
  serviceLines.forEach((line, index) => {
    ctx.fillStyle = isDark ? '#d4d4d8' : '#27272a';
    ctx.fillText(line, serviceX + 16, panelY + 62 + index * 28);
  });

  const laneX = walletX + panelW + 28;
  const laneW = serviceX - laneX - 28;
  const laneY = panelY + 24;
  const laneH = 230;
  ctx.strokeStyle = hexToRgba('#64748b', 0.26);
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(laneX + 20, laneY + laneH / 2);
  ctx.lineTo(laneX + laneW - 20, laneY + laneH / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const messageCards = details.visibleMessages.slice(0, 3);
  messageCards.forEach((message, index) => {
    const cardX = laneX + 24 + index * 18;
    const cardY = laneY + 28 + index * 48;
    ctx.fillStyle = isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.92)';
    drawRoundedRect(ctx, cardX, cardY, laneW - 48, 34, 10);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(index === messageCards.length - 1 ? '#38bdf8' : '#94a3b8', 0.42);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, cardX, cardY, laneW - 48, 34, 10);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#e4e4e7' : '#18181b';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText(message, cardX + 12, cardY + 21);
  });

  const learnY = panelY + panelH + 28;
  const learnH = 132;
  drawPanel(ctx, 40, learnY, width / 2 - 52, learnH, 'Wallet learns', '#38bdf8', theme);
  drawPanel(ctx, width / 2 + 12, learnY, width / 2 - 52, learnH, 'Service learns', '#a78bfa', theme);

  ctx.font = '11px "Space Grotesk", sans-serif';
  details.walletLearns.slice(0, 3).forEach((line, index) => {
    ctx.fillStyle = isDark ? '#d4d4d8' : '#27272a';
    ctx.fillText(`• ${line}`, 56, learnY + 52 + index * 24);
  });
  details.serviceLearns.slice(0, 3).forEach((line, index) => {
    ctx.fillStyle = isDark ? '#d4d4d8' : '#27272a';
    ctx.fillText(`• ${line}`, width / 2 + 28, learnY + 52 + index * 24);
  });

  const statusX = width - 240;
  const statusY = 38;
  ctx.fillStyle = hexToRgba(scenario.verified ? '#22c55e' : '#ef4444', 0.18);
  drawRoundedRect(ctx, statusX, statusY, 200, 34, 999);
  ctx.fill();
  ctx.fillStyle = scenario.verified ? '#22c55e' : '#ef4444';
  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(scenario.verified ? 'No spent notes revealed' : 'Spent note collision detected', statusX + 100, statusY + 22);
}
