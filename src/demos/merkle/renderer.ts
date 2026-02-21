import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import type { MerkleTree, MerkleNode } from '@/types/merkle';
import { drawGrid, drawLine, drawGlowCircle, hexToRgba } from '@/lib/canvas';
import { spring2DStep, spring2DSetTarget, lerp } from '@/lib/animation';

const MERKLE_PURPLE = '#d4d4d8';

export function renderMerkleTree(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  tree: MerkleTree | null,
  positions: Map<string, { x: number; y: number }>,
  proofPath: Set<string>,
  highlightedEdges: Set<string>,
  _proofStep: number,
  mouseX: number,
  mouseY: number,
  theme: 'dark' | 'light'
): { hoveredNode: MerkleNode | null } {
  const { width, height, delta } = frame;

  // Background
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

  // Subtle grid
  const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.06)';
  drawGrid(ctx, width, height, 40, gridColor);

  // Vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (!tree) return { hoveredNode: null };

  // Calculate node radius based on leaf count
  const leafCount = tree.leaves.length;
  const nodeRadius = Math.max(12, Math.min(30, width / (leafCount * 3)));

  // Update spring positions
  const allNodes: MerkleNode[] = [];
  function collectNodes(node: MerkleNode) {
    allNodes.push(node);
    if (node.left) collectNodes(node.left);
    if (node.right && node.right !== node.left) collectNodes(node.right);
  }
  collectNodes(tree.root);

  // Set spring targets and step physics
  for (const node of allNodes) {
    const pos = positions.get(node.id);
    if (pos) {
      node.spring = spring2DSetTarget(node.spring, pos.x, pos.y);
      node.spring = spring2DStep(node.spring, delta);
    }

    // Update highlight intensity
    const isHighlighted = proofPath.has(node.id);
    const targetIntensity = isHighlighted ? 1 : 0;
    node.highlightIntensity = lerp(node.highlightIntensity, targetIntensity, 0.1);
  }

  // Draw edges first
  function edgeKey(parentId: string, childId: string) {
    return `${parentId}->${childId}`;
  }

  function drawEdges(node: MerkleNode) {
    const isNodeInProof = proofPath.has(node.id);

    if (node.left) {
      const isLeftInProof = proofPath.has(node.left.id);
      const isEdgeInProof = isNodeInProof && isLeftInProof;
      const isEdgeHighlighted = highlightedEdges.has(edgeKey(node.id, node.left.id));

      const x1 = node.spring.x.value;
      const y1 = node.spring.y.value;
      const x2 = node.left.spring.x.value;
      const y2 = node.left.spring.y.value;

      if (isEdgeHighlighted) {
        ctx.save();
        ctx.shadowColor = MERKLE_PURPLE;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = hexToRgba(MERKLE_PURPLE, 0.9);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      } else if (isEdgeInProof) {
        // Purple glow with dashed line
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.shadowColor = MERKLE_PURPLE;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = hexToRgba(MERKLE_PURPLE, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Normal gray edge
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        drawLine(ctx, x1, y1, x2, y2, ctx.strokeStyle);
      }

      drawEdges(node.left);
    }

    if (node.right && node.right !== node.left) {
      const isRightInProof = proofPath.has(node.right.id);
      const isEdgeInProof = isNodeInProof && isRightInProof;
      const isEdgeHighlighted = highlightedEdges.has(edgeKey(node.id, node.right.id));

      const x1 = node.spring.x.value;
      const y1 = node.spring.y.value;
      const x2 = node.right.spring.x.value;
      const y2 = node.right.spring.y.value;

      if (isEdgeHighlighted) {
        ctx.save();
        ctx.shadowColor = MERKLE_PURPLE;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = hexToRgba(MERKLE_PURPLE, 0.9);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      } else if (isEdgeInProof) {
        // Purple glow with dashed line
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.shadowColor = MERKLE_PURPLE;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = hexToRgba(MERKLE_PURPLE, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Normal gray edge
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        drawLine(ctx, x1, y1, x2, y2, ctx.strokeStyle);
      }

      drawEdges(node.right);
    }
  }
  drawEdges(tree.root);

  // Draw nodes
  let hoveredNode: MerkleNode | null = null;
  for (const node of allNodes) {
    const x = node.spring.x.value;
    const y = node.spring.y.value;

    // Check hover
    const dx = mouseX - x;
    const dy = mouseY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nodeRadius + 5) {
      hoveredNode = node;
    }

    // Draw node circle
    const isHighlighted = node.highlightIntensity > 0.01;
    const baseColor = theme === 'dark' ? '#1a1a1a' : '#f5f5f5';
    const borderColor = theme === 'dark' ? '#333333' : '#cccccc';

    if (isHighlighted) {
      // Draw glow effect
      const glowIntensity = node.highlightIntensity;
      drawGlowCircle(ctx, x, y, nodeRadius, MERKLE_PURPLE, glowIntensity * 0.6);
    }

    // Draw circle
    ctx.fillStyle = baseColor;
    ctx.strokeStyle = isHighlighted ? hexToRgba(MERKLE_PURPLE, node.highlightIntensity) : borderColor;
    ctx.lineWidth = isHighlighted ? 2 : 1;
    ctx.beginPath();
    ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw hash text (truncated)
    const hashText = node.hash.slice(0, 6) + '...';
    const textColor = theme === 'dark' ? '#ffffff' : '#000000';
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hashText, x, y);
    ctx.restore();

    // Draw leaf data if available
    if (node.data) {
      ctx.save();
      ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.data.slice(0, 8), x, y + nodeRadius + 12);
      ctx.restore();
    }
  }

  // Draw hover tooltip
  if (hoveredNode) {
    const x = hoveredNode.spring.x.value;
    const y = hoveredNode.spring.y.value;
    const fullHash = hoveredNode.hash;

    // Tooltip background
    const tooltipPadding = 8;
    const tooltipText = `Hash: ${fullHash}`;
    ctx.save();
    ctx.font = '11px monospace';
    const metrics = ctx.measureText(tooltipText);
    const tooltipWidth = metrics.width + tooltipPadding * 2;
    const tooltipHeight = 20;

    let tooltipX = x + nodeRadius + 10;
    let tooltipY = y - tooltipHeight / 2;

    // Keep tooltip in bounds
    if (tooltipX + tooltipWidth > width - 10) {
      tooltipX = x - nodeRadius - tooltipWidth - 10;
    }
    if (tooltipY < 10) tooltipY = 10;
    if (tooltipY + tooltipHeight > height - 10) tooltipY = height - tooltipHeight - 10;

    // Draw tooltip box
    ctx.fillStyle = theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Draw tooltip text
    ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, tooltipX + tooltipPadding, tooltipY + tooltipHeight / 2);
    ctx.restore();

    // Draw data tooltip if leaf
    if (hoveredNode.data) {
      const dataText = `Data: ${hoveredNode.data}`;
      ctx.save();
      ctx.font = '11px sans-serif';
      const dataMetrics = ctx.measureText(dataText);
      const dataTooltipWidth = dataMetrics.width + tooltipPadding * 2;
      const dataTooltipY = tooltipY + tooltipHeight + 5;

      ctx.fillStyle = theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tooltipX, dataTooltipY, dataTooltipWidth, tooltipHeight, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(dataText, tooltipX + tooltipPadding, dataTooltipY + tooltipHeight / 2);
      ctx.restore();
    }
  }

  return { hoveredNode };
}
