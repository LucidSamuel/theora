import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { SyncRoundDetails, SyncScenario } from './logic';

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
  hoverRegions.push({
    x: walletX,
    y: panelY,
    w: panelW,
    h: panelH,
    title: 'Wallet',
    body: details.walletAction,
  });
  hoverRegions.push({
    x: serviceX,
    y: panelY,
    w: panelW,
    h: panelH,
    title: 'Remote Service',
    body: details.serviceAction,
  });

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
    hoverRegions.push({
      x: cardX,
      y: cardY,
      w: laneW - 48,
      h: 34,
      title: `Round ${round + 1} message`,
      body: message,
    });
  });

  const learnY = panelY + panelH + 28;
  const learnH = 132;
  drawPanel(ctx, 40, learnY, width / 2 - 52, learnH, 'Wallet learns', '#38bdf8', theme);
  drawPanel(ctx, width / 2 + 12, learnY, width / 2 - 52, learnH, 'Service learns', '#a78bfa', theme);
  hoverRegions.push({
    x: 40,
    y: learnY,
    w: width / 2 - 52,
    h: learnH,
    title: 'Wallet learns',
    body: details.walletLearns[0] ?? 'Local verification result',
  });
  hoverRegions.push({
    x: width / 2 + 12,
    y: learnY,
    w: width / 2 - 52,
    h: learnH,
    title: 'Service learns',
    body: details.serviceLearns[0] ?? 'Only blinded metadata',
  });

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

  if (typeof mouseX === 'number' && typeof mouseY === 'number') {
    const hovered = hoverRegions.find((region) =>
      mouseX >= region.x && mouseX <= region.x + region.w && mouseY >= region.y && mouseY <= region.y + region.h
    );
    if (hovered) {
      drawTooltip(ctx, width, height, hovered, theme);
    }
  }
}
