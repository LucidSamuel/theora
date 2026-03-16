import type { ProofNode, VerificationState, IvcChain } from '@/types/recursive';
import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawRoundedRect, hexToRgba } from '@/lib/canvas';
import { getConstantProofSize } from './logic';

// ─── Palette ──────────────────────────────────────────────────────────────────

const PAL = {
  dark: {
    bg0: '#09090b',   // zinc-950 — matches --bg-primary
    bg1: '#111113',   // zinc-900 — matches --bg-secondary
    text: '#fafafa',  // zinc-50
    textMuted: '#52525b',  // zinc-600
    pending:  { border: '#3f3f46', fill: 'rgba(63,63,70,0.12)',  glow: '#3f3f46' },   // zinc-700
    verifying:{ border: '#f59e0b', fill: 'rgba(245,158,11,0.10)', glow: '#f59e0b' },  // amber
    verified: { border: '#22c55e', fill: 'rgba(34,197,94,0.08)',  glow: '#22c55e' },  // green
    failed:   { border: '#ef4444', fill: 'rgba(239,68,68,0.10)',  glow: '#ef4444' },  // red
    pallas:   '#e4e4e7',  // zinc-200 — Pallas is the "base" curve, bright
    vesta:    '#71717a',  // zinc-500 — Vesta is the "secondary" curve, muted
    edge:     '#27272a',  // zinc-800
  },
  light: {
    bg0: '#ffffff',
    bg1: '#fafafa',
    text: '#09090b',
    textMuted: '#a1a1aa',  // zinc-400
    pending:  { border: '#d4d4d8', fill: 'rgba(212,212,216,0.12)', glow: '#d4d4d8' },  // zinc-300
    verifying:{ border: '#d97706', fill: 'rgba(217,119,6,0.08)',   glow: '#d97706' },
    verified: { border: '#16a34a', fill: 'rgba(22,163,74,0.07)',   glow: '#16a34a' },
    failed:   { border: '#dc2626', fill: 'rgba(220,38,38,0.08)',   glow: '#dc2626' },
    pallas:   '#3f3f46',  // zinc-700 — dark, visible on white
    vesta:    '#a1a1aa',  // zinc-400 — lighter secondary
    edge:     '#e4e4e7',  // zinc-200
  },
};

// ─── Node dimensions ──────────────────────────────────────────────────────────

const NW = 118;
const NH = 58;
const NR = 13; // corner radius

// ─── Bezier helpers ──────────────────────────────────────────────────────────

function bezierPoint(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function drawBezierEdge(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  alpha: number,
  lineWidth = 1.5
): void {
  const dy = y2 - y1;
  const cy = dy * 0.45;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(x1, y1 + cy, x2, y2 - cy, x2, y2);
  ctx.strokeStyle = hexToRgba(color, alpha);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawFlowParticles(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  time: number,
  color: string,
  count = 2
): void {
  const dy = y2 - y1;
  const cy = dy * 0.45;

  for (let i = 0; i < count; i++) {
    const rawT = ((time * 0.55 + i / count) % 1);
    const t = rawT;
    const px = bezierPoint(t, x1, x1, x2, x2);
    const py = bezierPoint(t, y1, y1 + cy, y2 - cy, y2);

    const outer = 7;
    const inner = 2.5;
    const grad = ctx.createRadialGradient(px, py, inner, px, py, outer);
    grad.addColorStop(0, hexToRgba(color, 0.9));
    grad.addColorStop(0.4, hexToRgba(color, 0.35));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, outer, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Node drawing ─────────────────────────────────────────────────────────────

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: ProofNode,
  px: number, py: number,
  time: number,
  showPastaCurves: boolean,
  showProofSize: boolean,
  isRoot: boolean,
  isHovered: boolean,
  colors: typeof PAL.dark
): void {
  const x = px - NW / 2;
  const y = py - NH / 2;

  const statusPal = colors[node.status as keyof typeof colors] as { border: string; fill: string; glow: string };
  const curveColor = node.curve === 'pallas' ? colors.pallas : colors.vesta;
  // Status colors (verified/failed/verifying) take priority over Pasta curve colors
  const statusActive = node.status === 'verified' || node.status === 'failed' || node.status === 'verifying';
  const borderColor = showPastaCurves && !statusActive ? curveColor : statusPal.border;
  const glowColor = showPastaCurves && !statusActive ? curveColor : statusPal.glow;

  // ── Outer glow shadow ───
  const glowAlpha = node.status === 'pending' ? 0 : node.status === 'verifying' ? 0.5 + Math.sin(time * 6) * 0.25 : 0.35;
  if (glowAlpha > 0 || isHovered) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isHovered ? 22 : (node.status === 'verifying' ? 18 + Math.sin(time * 6) * 6 : 14);
    ctx.strokeStyle = hexToRgba(borderColor, 0);
    ctx.lineWidth = 0;
    drawRoundedRect(ctx, x, y, NW, NH, NR);
    ctx.stroke();
    ctx.restore();
  }

  // ── Root pulsing outer ring ───
  if (isRoot && node.status === 'verified') {
    const pulse = Math.sin(time * 2.5) * 0.5 + 0.5;
    ctx.strokeStyle = hexToRgba(glowColor, 0.15 + pulse * 0.12);
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x - 8, y - 8, NW + 16, NH + 16, NR + 8);
    ctx.stroke();
  }

  if (isRoot && node.status === 'verifying') {
    const pulse = Math.sin(time * 7) * 0.5 + 0.5;
    ctx.strokeStyle = hexToRgba(colors.verifying.border, 0.3 + pulse * 0.2);
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x - 8, y - 8, NW + 16, NH + 16, NR + 8);
    ctx.stroke();
  }

  // ── Node fill ───
  ctx.fillStyle = statusPal.fill;
  drawRoundedRect(ctx, x, y, NW, NH, NR);
  ctx.fill();

  // ── Node border ───
  const borderAlpha = node.status === 'pending' ? 0.35 : 0.75;
  ctx.strokeStyle = hexToRgba(borderColor, borderAlpha);
  ctx.lineWidth = node.status === 'verified' || node.status === 'failed' ? 1.5 : 1.5;
  drawRoundedRect(ctx, x, y, NW, NH, NR);
  ctx.stroke();

  // ── Status dot (top-right) ───
  const dotX = x + NW - 14;
  const dotY = y + 14;
  const dotR = 5;
  ctx.fillStyle = hexToRgba(statusPal.border, node.status === 'pending' ? 0.35 : 1);
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
  ctx.fill();

  if (node.status === 'verifying') {
    const pulse = Math.sin(time * 8) * 0.5 + 0.5;
    ctx.strokeStyle = hexToRgba(colors.verifying.border, 0.5 + pulse * 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR + 3 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Root crown badge (top-left) ───
  if (isRoot) {
    ctx.fillStyle = hexToRgba(borderColor, 0.7);
    ctx.font = `bold 8px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ROOT', x + 8, y + 6);
  }

  // ── Proof label ───
  const centerX = px - (isRoot ? 8 : 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Greek π symbol
  ctx.fillStyle = colors.text;
  ctx.font = `bold 18px Georgia, serif`;
  ctx.fillText('π', centerX - 8, py - 7);

  // subscript (depth, index)
  ctx.font = `500 10px system-ui, sans-serif`;
  ctx.fillStyle = colors.textMuted;
  ctx.fillText(`${node.depth},${node.index}`, centerX + 14, py - 2);

  // ── Curve label or leaf marker ───
  if (node.children.length === 0) {
    // Leaf badge
    ctx.fillStyle = hexToRgba(colors.textMuted, 0.7);
    ctx.font = `500 9px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('leaf', px, py + 12);
  } else if (showPastaCurves) {
    const curveName = node.curve === 'pallas' ? 'Pallas' : 'Vesta';
    ctx.fillStyle = hexToRgba(curveColor, 0.85);
    ctx.font = `600 9px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(curveName, px, py + 13);
  }

  // ── Proof size bar ───
  if (showProofSize && node.status === 'verified') {
    getConstantProofSize();
    const barW = 34;
    const barH = 4;
    const barX = x + NW + 6;
    const barY = py - barH / 2;
    ctx.fillStyle = hexToRgba(colors.verified.border, 0.25);
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hexToRgba(colors.verified.border, 0.7);
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('288B', barX + barW + 4, py);
  }
}

// ─── Background ───────────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, colors: typeof PAL.dark): void {
  // Background
  const bg = ctx.createLinearGradient(0, 0, width * 0.6, height);
  bg.addColorStop(0, colors.bg0);
  bg.addColorStop(1, colors.bg1);
  ctx.fillStyle = bg;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  // Subtle dot grid
  const dotSpacing = 32;
  const dotR = 0.8;
  const dotColor = colors === PAL.dark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.065)';
  ctx.fillStyle = dotColor;
  for (let gx = dotSpacing; gx < width; gx += dotSpacing) {
    for (let gy = dotSpacing; gy < height; gy += dotSpacing) {
      ctx.beginPath();
      ctx.arc(gx, gy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Radial vignette
  const vig = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, colors === PAL.dark ? 'rgba(0,0,0,0.45)' : 'rgba(80,80,120,0.07)');
  ctx.fillStyle = vig;
  ctx.fillRect(-50000, -50000, 100000, 100000);
}

// ─── renderProofTree ─────────────────────────────────────────────────────────

export function renderProofTree(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  root: ProofNode | null,
  positions: Map<string, { x: number; y: number }>,
  verification: VerificationState,
  showPastaCurves: boolean,
  showProofSize: boolean,
  mouseX: number,
  mouseY: number,
  theme: 'dark' | 'light'
): { hovered: { type: 'node'; id: string; label: string; status: string; curve: string } | null } {
  const colors = PAL[theme];
  const { time, width, height } = frame;

  void verification;

  drawBackground(ctx, width, height, colors);

  if (!root) return { hovered: null };

  const statusColor = (status: string): string => {
    const s = status as keyof typeof colors;
    const entry = colors[s] as { border: string } | undefined;
    return entry?.border ?? colors.pending.border;
  };

  // ── Collect all nodes and their positions ────
  const allNodes: ProofNode[] = [];
  function collect(node: ProofNode): void {
    allNodes.push(node);
    for (const child of node.children) collect(child);
  }
  collect(root);

  // ── Draw edges first ─────────────────────────
  function drawEdges(node: ProofNode): void {
    const pos = positions.get(node.id);
    if (!pos) return;

    for (const child of node.children) {
      const cpos = positions.get(child.id);
      if (!cpos) continue;

      const childStatusColor = statusColor(child.status);
      const isVerifying = child.status === 'verifying' || node.status === 'verifying';
      const edgeAlpha = child.status === 'pending' ? 0.2 : 0.5;

      // Main bezier edge
      drawBezierEdge(
        ctx,
        pos.x, pos.y + NH / 2,
        cpos.x, cpos.y - NH / 2,
        childStatusColor,
        edgeAlpha,
        1.5
      );

      // Flowing particles when active
      if (isVerifying) {
        drawFlowParticles(
          ctx,
          pos.x, pos.y + NH / 2,
          cpos.x, cpos.y - NH / 2,
          time,
          childStatusColor,
          2
        );
      }

      drawEdges(child);
    }
  }

  drawEdges(root);

  // ── Draw nodes ───────────────────────────────
  let hovered: { type: 'node'; id: string; label: string; status: string; curve: string } | null = null;

  for (const node of allNodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;

    const isRoot = node.id === root.id;
    const isHovered =
      mouseX >= pos.x - NW / 2 &&
      mouseX <= pos.x + NW / 2 &&
      mouseY >= pos.y - NH / 2 &&
      mouseY <= pos.y + NH / 2;

    if (isHovered) {
      hovered = { type: 'node', id: node.id, label: node.label, status: node.status, curve: node.curve };
    }

    drawNode(ctx, node, pos.x, pos.y, time, showPastaCurves, showProofSize, isRoot, isHovered, colors);
  }

  // ── Legend bar (screen-space) ────────────────
  const legendItems: { label: string; color: string }[] = [
    { label: 'Pending',   color: colors.pending.border },
    { label: 'Verifying', color: colors.verifying.border },
    { label: 'Verified',  color: colors.verified.border },
    { label: 'Failed',    color: colors.failed.border },
  ];
  if (showPastaCurves) {
    legendItems.push({ label: 'Pallas', color: colors.pallas });
    legendItems.push({ label: 'Vesta',  color: colors.vesta });
  }
  const legendTotalW = legendItems.length * 90;
  let lx = (width - legendTotalW) / 2;
  const legendY = height - 36;
  for (const item of legendItems) {
    ctx.fillStyle = hexToRgba(item.color, 0.85);
    ctx.beginPath();
    ctx.arc(lx + 7, legendY + 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.textMuted;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, lx + 17, legendY + 7);
    lx += 90;
  }

  return { hovered };
}

// ─── renderIvcChain ──────────────────────────────────────────────────────────

export function renderIvcChain(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  chain: IvcChain | null,
  showPastaCurves: boolean,
  mouseX: number,
  mouseY: number,
  theme: 'dark' | 'light'
): { hovered: { type: 'step'; id: string; label: string; curve: string } | null } {
  const colors = PAL[theme];
  const { time, width, height } = frame;

  drawBackground(ctx, width, height, colors);

  if (!chain || chain.steps.length === 0) return { hovered: null };

  const stepCount = chain.steps.length;
  const SW = Math.min(130, (width - 120) / stepCount - 16);
  const SH = 90;
  const gap = 14;
  const totalW = stepCount * SW + (stepCount - 1) * gap;
  const startX = (width - totalW) / 2;
  const cy = height / 2;

  // ── Accumulator on the left ───────────────────
  const accW = 68;
  const accH = SH;
  const accX = startX - accW - 32;
  const accY = cy - accH / 2;

  // Current acc hash
  const currentStep = chain.steps[chain.currentFoldIndex] ?? chain.steps[0];
  const accHash = currentStep?.accumulatorHash ?? '—';

  // Acc box
  ctx.save();
  ctx.shadowColor = colors.verified.glow;
  ctx.shadowBlur = chain.currentFoldIndex >= 0 ? 14 : 4;
  ctx.fillStyle = hexToRgba(colors.verified.border, chain.currentFoldIndex >= 0 ? 0.1 : 0.04);
  drawRoundedRect(ctx, accX, accY, accW, accH, 10);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hexToRgba(colors.verified.border, chain.currentFoldIndex >= 0 ? 0.7 : 0.3);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, accX, accY, accW, accH, 10);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = colors.text;
  ctx.font = `bold 11px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Acc', accX + accW / 2, cy - 14);

  ctx.fillStyle = colors.textMuted;
  ctx.font = `9px monospace`;
  ctx.fillText(accHash.slice(0, 8) + '…', accX + accW / 2, cy + 4);

  ctx.fillStyle = colors.textMuted;
  ctx.font = `8px system-ui`;
  const foldLabel = chain.currentFoldIndex >= 0 ? `${chain.currentFoldIndex + 1} folded` : 'empty';
  ctx.fillText(foldLabel, accX + accW / 2, cy + 22);

  // Arrow from acc to first step
  const ax1 = accX + accW + 4;
  const ax2 = startX - 6;
  ctx.strokeStyle = hexToRgba(colors.verified.border, 0.3);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(ax1, cy);
  ctx.lineTo(ax2, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Steps ─────────────────────────────────────
  let hovered: { type: 'step'; id: string; label: string; curve: string } | null = null;

  chain.steps.forEach((step, idx) => {
    const sx = startX + idx * (SW + gap);
    const sy = cy - SH / 2;

    const curveColor = step.curve === 'pallas' ? colors.pallas : colors.vesta;
    const borderColor = showPastaCurves ? curveColor : (step.folded ? colors.verified.border : colors.pending.border);
    const fillAlpha = step.folded ? 0.1 : 0.04;

    const isHov = mouseX >= sx && mouseX <= sx + SW && mouseY >= sy && mouseY <= sy + SH;
    if (isHov) {
      hovered = { type: 'step', id: step.id, label: `Step ${idx}`, curve: step.curve };
    }

    // Glow for folded steps
    if (step.folded) {
      ctx.save();
      ctx.shadowColor = colors.verified.glow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = hexToRgba(borderColor, fillAlpha);
      drawRoundedRect(ctx, sx, sy, SW, SH, 10);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = hexToRgba(borderColor, fillAlpha);
      drawRoundedRect(ctx, sx, sy, SW, SH, 10);
      ctx.fill();
    }

    ctx.strokeStyle = hexToRgba(borderColor, step.folded ? 0.7 : (isHov ? 0.5 : 0.3));
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, sx, sy, SW, SH, 10);
    ctx.stroke();

    // Step header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.text;
    ctx.font = `bold 11px system-ui, sans-serif`;
    ctx.fillText(`Step ${idx}`, sx + SW / 2, sy + 9);

    // Curve badge
    if (showPastaCurves) {
      ctx.fillStyle = hexToRgba(curveColor, 0.9);
      ctx.font = `600 9px system-ui`;
      ctx.fillText(step.curve === 'pallas' ? 'Pallas' : 'Vesta', sx + SW / 2, sy + 26);
    }

    // Input value
    ctx.fillStyle = colors.textMuted;
    ctx.font = `10px system-ui`;
    ctx.fillText(`in: ${step.inputValue}`, sx + SW / 2, sy + (showPastaCurves ? 42 : 30));

    // Hash
    ctx.fillStyle = hexToRgba(colors.textMuted, 0.7);
    ctx.font = `8px monospace`;
    ctx.fillText(step.accumulatorHash.slice(0, 10) + '…', sx + SW / 2, sy + (showPastaCurves ? 56 : 46));

    // Folded badge
    if (step.folded) {
      const badgeX = sx + SW - 10;
      const badgeY = sy + 10;
      ctx.fillStyle = hexToRgba(colors.verified.border, 1);
      ctx.font = `bold 10px system-ui`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('✓', badgeX, badgeY);
    }

    // Arrow to next step (→ dashed when pending, solid when folded)
    if (idx < chain.steps.length - 1) {
      const ax1 = sx + SW + 2;
      const ax2 = sx + SW + gap - 2;
      const arrowY = cy;
      ctx.strokeStyle = hexToRgba(borderColor, step.folded ? 0.5 : 0.2);
      ctx.lineWidth = 1;
      if (!step.folded) ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(ax1, arrowY);
      ctx.lineTo(ax2 - 5, arrowY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head
      ctx.fillStyle = hexToRgba(borderColor, step.folded ? 0.6 : 0.25);
      ctx.beginPath();
      ctx.moveTo(ax2, arrowY);
      ctx.lineTo(ax2 - 6, arrowY - 4);
      ctx.lineTo(ax2 - 6, arrowY + 4);
      ctx.closePath();
      ctx.fill();

      // Flowing particle on active fold boundary
      if (step.folded && idx === chain.currentFoldIndex) {
        const t = (time * 1.1) % 1;
        const px = ax1 + (ax2 - ax1) * t;
        const pGrad = ctx.createRadialGradient(px, arrowY, 1, px, arrowY, 6);
        pGrad.addColorStop(0, hexToRgba(colors.verified.border, 0.9));
        pGrad.addColorStop(1, hexToRgba(colors.verified.border, 0));
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(px, arrowY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // ── Legend bar ───────────────────────────────
  const legendY = height - 36;
  const items: { label: string; color: string }[] = [
    { label: 'Pending',   color: colors.pending.border },
    { label: 'Verifying', color: colors.verifying.border },
    { label: 'Verified',  color: colors.verified.border },
    { label: 'Failed',    color: colors.failed.border },
  ];
  if (showPastaCurves) {
    items.push({ label: 'Pallas', color: colors.pallas });
    items.push({ label: 'Vesta',  color: colors.vesta });
  }

  const legendTotalW = items.length * 90;
  let lx = (width - legendTotalW) / 2;
  for (const item of items) {
    ctx.fillStyle = hexToRgba(item.color, 0.85);
    ctx.beginPath();
    ctx.arc(lx + 7, legendY + 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.textMuted;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, lx + 17, legendY + 7);
    lx += 90;
  }

  return { hovered };
}
