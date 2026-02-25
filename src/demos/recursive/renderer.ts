import type { ProofNode, VerificationState, IvcChain } from '@/types/recursive';
import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawLine, drawRoundedRect, hexToRgba, drawArrow } from '@/lib/canvas';
import { getConstantProofSize } from './logic';

const COLORS = {
  dark: {
    background: '#0a0a0a',
    grid: '#1a1a1a',
    text: '#e5e5e5',
    textSecondary: '#a3a3a3',
    pending: '#525252',
    verifying: '#eab308',
    verified: '#22c55e',
    failed: '#ef4444',
    pallas: '#d4d4d8',
    vesta: '#71717a',
  },
  light: {
    background: '#ffffff',
    grid: '#f5f5f5',
    text: '#171717',
    textSecondary: '#525252',
    pending: '#a3a3a3',
    verifying: '#eab308',
    verified: '#22c55e',
    failed: '#ef4444',
    pallas: '#3f3f46',
    vesta: '#71717a',
  },
};

/**
 * Renders the proof tree in tree mode
 */
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
  const colors = COLORS[theme];
  const { time, width, height } = frame;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#111111');
  } else {
    gradient.addColorStop(0, '#fafafa');
    gradient.addColorStop(1, '#f4f4f5');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGrid(ctx, width, height, 40, theme === 'dark' ? 'rgba(240, 231, 222, 0.05)' : 'rgba(63, 63, 70, 0.08)');

  // Vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(63,63,70,0.08)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (!root) return { hovered: null };

  // Suppress unused lint for verification (used in render logic)
  void verification;

  // Helper to get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return colors.pending;
      case 'verifying':
        return colors.verifying;
      case 'verified':
        return colors.verified;
      case 'failed':
        return colors.failed;
      default:
        return colors.pending;
    }
  };

  // Draw edges first
  function drawEdges(node: ProofNode): void {
    const pos = positions.get(node.id);
    if (!pos) return;

    for (const child of node.children) {
      const childPos = positions.get(child.id);
      if (!childPos) continue;

      const edgeColor = getStatusColor(child.status);
      ctx.strokeStyle = hexToRgba(edgeColor, 0.4);
      ctx.lineWidth = 2;
      drawLine(ctx, pos.x, pos.y + 20, childPos.x, childPos.y - 20, hexToRgba(edgeColor, 0.4), 2);

      drawEdges(child);
    }
  }

  drawEdges(root);

  let hovered: { type: 'node'; id: string; label: string; status: string; curve: string } | null = null;

  // Draw nodes
  function drawNodes(node: ProofNode): void {
    const pos = positions.get(node.id);
    if (!pos) return;

    const nodeWidth = 80;
    const nodeHeight = 40;
    const x = pos.x - nodeWidth / 2;
    const y = pos.y - nodeHeight / 2;

    // Determine node color
    let nodeColor = colors.verified;
    if (showPastaCurves) {
      nodeColor = node.curve === 'pallas' ? colors.pallas : colors.vesta;
    }

    const statusColor = getStatusColor(node.status);

    // Draw node background
    ctx.fillStyle = hexToRgba(nodeColor, 0.15);
    ctx.strokeStyle = hexToRgba(statusColor, 0.6);
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, nodeWidth, nodeHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Verification wave effect for verifying nodes
    if (node.status === 'verifying') {
      const pulse = Math.sin(time * 5) * 0.5 + 0.5;
      const ringRadius = 25 + pulse * 10;

      ctx.strokeStyle = hexToRgba(colors.verifying, 0.4 - pulse * 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Second ring
      ctx.strokeStyle = hexToRgba(colors.verifying, 0.2 - pulse * 0.15);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Status icon
    let icon = '⏳';
    if (node.status === 'verifying') {
      icon = '⚡';
    } else if (node.status === 'verified') {
      icon = '✓';
    } else if (node.status === 'failed') {
      icon = '✗';
    }

    ctx.fillStyle = statusColor;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, pos.x, pos.y - 5);

    // Label
    ctx.fillStyle = colors.text;
    ctx.font = '11px monospace';
    ctx.fillText(node.label, pos.x, pos.y + 12);

    // Proof size indicator
    if (showProofSize) {
      getConstantProofSize();
      const barWidth = 40;
      const barHeight = 6;
      const barX = pos.x + nodeWidth / 2 + 8;
      const barY = pos.y - barHeight / 2;

      ctx.fillStyle = hexToRgba(colors.verified, 0.3);
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = colors.textSecondary;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('288B', barX + barWidth + 4, pos.y);
    }

    // Recursively draw children
    for (const child of node.children) {
      drawNodes(child);
    }

    // Hover detection
    if (
      mouseX >= x &&
      mouseX <= x + nodeWidth &&
      mouseY >= y &&
      mouseY <= y + nodeHeight
    ) {
      hovered = {
        type: 'node',
        id: node.id,
        label: node.label,
        status: node.status,
        curve: node.curve,
      };
    }
  }

  drawNodes(root);

  return { hovered };
}

/**
 * Renders the IVC chain in IVC mode
 */
export function renderIvcChain(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  chain: IvcChain | null,
  showPastaCurves: boolean,
  mouseX: number,
  mouseY: number,
  theme: 'dark' | 'light'
): { hovered: { type: 'step'; id: string; label: string; curve: string } | null } {
  const colors = COLORS[theme];
  const { width, height } = frame;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#111111');
  } else {
    gradient.addColorStop(0, '#fafafa');
    gradient.addColorStop(1, '#f4f4f5');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGrid(ctx, width, height, 40, theme === 'dark' ? 'rgba(240, 231, 222, 0.05)' : 'rgba(63, 63, 70, 0.08)');

  // Vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(63,63,70,0.08)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (!chain || chain.steps.length === 0) return { hovered: null };

  const stepWidth = 140;
  const stepHeight = 100;
  const spacing = 60;
  const startX = 100;
  const startY = height / 2;

  let accumulatorX = startX - 80;

  // Draw accumulator
  ctx.fillStyle = hexToRgba(colors.verified, 0.2);
  ctx.strokeStyle = hexToRgba(colors.verified, 0.6);
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, accumulatorX - 60, startY - 40, 80, 80, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Acc', accumulatorX - 20, startY - 15);

  // Draw current accumulator hash
  const currentStep = chain.steps[chain.currentFoldIndex];
  if (currentStep) {
    ctx.fillStyle = colors.textSecondary;
    ctx.font = '9px monospace';
    const hashDisplay = currentStep.accumulatorHash.slice(0, 8) + '...';
    ctx.fillText(hashDisplay, accumulatorX - 20, startY + 5);
  }

  // Draw each step
  let hovered: { type: 'step'; id: string; label: string; curve: string } | null = null;

  chain.steps.forEach((step, index) => {
    let x = startX + index * (stepWidth + spacing);
    const y = startY - stepHeight / 2;

    // Compress folded steps towards the accumulator
    if (step.folded) {
      x -= (stepWidth + spacing) * 0.7 * (index + 1);
    }

    // Step color
    let stepColor = colors.verified;
    if (showPastaCurves) {
      stepColor = step.curve === 'pallas' ? colors.pallas : colors.vesta;
    }

    // Draw step box
    const alpha = step.folded ? 0.3 : 0.15;
    ctx.fillStyle = hexToRgba(stepColor, alpha);
    ctx.strokeStyle = hexToRgba(step.folded ? colors.verified : stepColor, 0.6);
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, stepWidth, stepHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Step label
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Step ${index}`, x + stepWidth / 2, y + 10);

    // Curve type
    if (showPastaCurves) {
      ctx.fillStyle = colors.textSecondary;
      ctx.font = '10px monospace';
      ctx.fillText(step.curve, x + stepWidth / 2, y + 28);
    }

    // Input value
    ctx.fillStyle = colors.text;
    ctx.font = '11px monospace';
    ctx.fillText(`Input: ${step.inputValue}`, x + stepWidth / 2, y + 48);

    // Hash
    ctx.fillStyle = colors.textSecondary;
    ctx.font = '9px monospace';
    const hashDisplay = step.accumulatorHash.slice(0, 10) + '...';
    ctx.fillText(hashDisplay, x + stepWidth / 2, y + 68);

    // Folded indicator
    if (step.folded) {
      ctx.fillStyle = colors.verified;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('✓', x + stepWidth - 15, y + 10);
    }

    // Arrow to next step
    if (index < chain.steps.length - 1) {
      const arrowStartX = x + stepWidth + 5;
      const arrowEndX = x + stepWidth + spacing - 5;
      const arrowY = startY;

      drawArrow(ctx, arrowStartX, arrowY, arrowEndX, arrowY, hexToRgba(colors.textSecondary, 0.4), 6);
    }

    if (
      mouseX >= x &&
      mouseX <= x + stepWidth &&
      mouseY >= y &&
      mouseY <= y + stepHeight
    ) {
      hovered = {
        type: 'step',
        id: step.id,
        label: `Step ${index}`,
        curve: step.curve,
      };
    }
  });

  return { hovered };
}
