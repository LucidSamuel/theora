import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawLine, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { Bootle16Breakdown, ConstraintCheck, PlonkGate, Witness } from './logic';

export function renderCircuit(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  witness: Witness,
  constraints: ConstraintCheck[],
  bootle16: Bootle16Breakdown,
  plonkGates: PlonkGate[],
  viewMode: 'r1cs' | 'bootle16' | 'plonk',
  broken: boolean,
  theme: 'dark' | 'light',
  mouseX: number = 0,
  mouseY: number = 0
): void {
  const { width, height } = frame;
  const isDark = theme === 'dark';

  // ── Background ────────────────────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  // Subtle vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Circuit nodes ─────────────────────────────────────────────────────────
  // Colors follow theora's zinc-based palette:
  //   Inputs x, y → zinc-200 / zinc-400 (data tones)
  //   Gate        → zinc-600 (neutral computation)
  //   Output      → green (pass) / red (fail) — semantic only
  const nodes = [
    { x: 80,  y: 120, w: 92,  h: 48, label: `x = ${witness.x}`, color: isDark ? '#e4e4e7' : '#3f3f46' },
    { x: 80,  y: 240, w: 92,  h: 48, label: `y = ${witness.y}`, color: isDark ? '#a1a1aa' : '#71717a' },
    { x: 240, y: 120, w: 118, h: 56, label: 'square',           color: isDark ? '#71717a' : '#a1a1aa' },
    { x: 420, y: 160, w: 118, h: 56,
      label: broken ? 'out ← t + y' : 'z = t + y',
      color: broken ? '#ef4444' : '#22c55e' },
  ];

  // Wires
  const wireColor = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.8);
  drawLine(ctx, 172, 144, 240, 148, wireColor, 1.5);
  drawLine(ctx, 358, 148, 420, 188, wireColor, 1.5);
  drawLine(ctx, 172, 264, 420, 196, wireColor, 1.5);

  for (const node of nodes) {
    ctx.fillStyle = hexToRgba(node.color, isDark ? 0.10 : 0.12);
    ctx.strokeStyle = hexToRgba(node.color, isDark ? 0.65 : 0.75);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, node.x, node.y, node.w, node.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.x + node.w / 2, node.y + node.h / 2);
  }

  ctx.textBaseline = 'alphabetic';

  // ── Node hover detection ────────────────────────────────────────────
  const panelX = width - 280;
  let hoveredNode: typeof nodes[0] | null = null;
  for (const node of nodes) {
    if (mouseX >= node.x && mouseX <= node.x + node.w &&
        mouseY >= node.y && mouseY <= node.y + node.h) {
      hoveredNode = node;
      break;
    }
  }

  if (hoveredNode) {
    const descriptions: Record<string, string> = {
      [`x = ${witness.x}`]: `Input wire x: prover-supplied value ${witness.x}`,
      [`y = ${witness.y}`]: `Input wire y: prover-supplied value ${witness.y}`,
      'square': `Multiplication gate: t = x·x = ${witness.x}·${witness.x} = ${witness.t}`,
    };
    const outLabel = broken ? 'out ← t + y' : 'z = t + y';
    descriptions[outLabel] = broken
      ? `Output unconstrained: t + y = ${witness.t + witness.y}, but z = ${witness.z}`
      : `Addition gate: z = t + y = ${witness.t} + ${witness.y} = ${witness.z}`;

    const tipText = descriptions[hoveredNode.label] ?? hoveredNode.label;

    ctx.save();
    ctx.font = '11px monospace';
    const tm = ctx.measureText(tipText);
    const tw = Math.min(tm.width + 16, panelX - 20);
    const th = 24;
    let tx = hoveredNode.x + hoveredNode.w + 8;
    let ty = hoveredNode.y + hoveredNode.h / 2 - th / 2;

    if (tx + tw > panelX - 10) tx = hoveredNode.x - tw - 8;
    if (tx < 10) tx = 10;
    if (ty < 10) ty = 10;

    ctx.fillStyle = isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tipText, tx + 8, ty + th / 2);
    ctx.restore();
  }

  // ── Constraint / representation panel ────────────────────────────────────
  const panelY = 32;
  ctx.fillStyle = hexToRgba(isDark ? '#111113' : '#ffffff', 0.96);
  ctx.fillRect(panelX, panelY, 240, height - 64);
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, 240, height - 64);

  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    viewMode === 'bootle16' ? 'Bootle16 View' : viewMode === 'plonk' ? 'Plonk Gates' : 'Constraint Checks',
    panelX + 12,
    panelY + 22
  );

  if (viewMode === 'r1cs') {
    constraints.forEach((constraint, index) => {
      const y = panelY + 48 + index * 52;
      const ok = constraint.satisfied;
      ctx.fillStyle = hexToRgba(ok ? '#22c55e' : '#ef4444', isDark ? 0.09 : 0.07);
      ctx.fillRect(panelX + 12, y - 16, 216, 38);
      ctx.strokeStyle = hexToRgba(ok ? '#22c55e' : '#ef4444', isDark ? 0.55 : 0.45);
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX + 12, y - 16, 216, 38);
      ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
      ctx.font = '11px monospace';
      ctx.fillText(constraint.label, panelX + 20, y);
      ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
      ctx.fillText(`${constraint.left} ?= ${constraint.right}`, panelX + 20, y + 14);
    });
    return;
  }

  if (viewMode === 'plonk') {
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.font = '10px monospace';
    ctx.fillText('qM\u00B7a\u00B7b + qL\u00B7a + qR\u00B7b + qO\u00B7c + qC = 0', panelX + 12, panelY + 40);

    plonkGates.forEach((gate, index) => {
      const y = panelY + 64 + index * 72;
      ctx.fillStyle = hexToRgba(gate.satisfied ? '#22c55e' : '#ef4444', isDark ? 0.09 : 0.07);
      ctx.fillRect(panelX + 12, y - 16, 216, 56);
      ctx.strokeStyle = hexToRgba(gate.satisfied ? '#22c55e' : '#ef4444', isDark ? 0.55 : 0.45);
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX + 12, y - 16, 216, 56);
      ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
      ctx.font = '11px monospace';
      ctx.fillText(`a=${gate.a.wire}, b=${gate.b.wire}, c=${gate.c.wire}`, panelX + 20, y);
      ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
      ctx.fillText(`selectors: [${gate.qM}, ${gate.qL}, ${gate.qR}, ${gate.qO}, ${gate.qC}]`, panelX + 20, y + 16);
      ctx.fillText(`eval: ${gate.evaluation} ${gate.satisfied ? '= 0 \u2713' : '\u2260 0 \u2717'}`, panelX + 20, y + 32);
    });
    return;
  }

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '10px monospace';
  ctx.fillText('Multiplication constraints', panelX + 12, panelY + 46);

  bootle16.multiplication.forEach((constraint, index) => {
    const y = panelY + 70 + index * 52;
    ctx.fillStyle = hexToRgba(constraint.satisfied ? '#22c55e' : '#ef4444', isDark ? 0.09 : 0.07);
    ctx.fillRect(panelX + 12, y - 16, 216, 38);
    ctx.strokeStyle = hexToRgba(constraint.satisfied ? '#22c55e' : '#ef4444', isDark ? 0.55 : 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 12, y - 16, 216, 38);
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.fillText(`${constraint.leftWire} · ${constraint.rightWire} -> ${constraint.outputWire}`, panelX + 20, y);
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.fillText(`${constraint.left} · ${constraint.right} = ${constraint.output}`, panelX + 20, y + 14);
  });

  const matrixY = panelY + 150;
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '10px monospace';
  ctx.fillText('Linear constraint matrix', panelX + 12, matrixY);

  const headerY = matrixY + 22;
  bootle16.columns.forEach((column, index) => {
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.fillText(column, panelX + 20 + index * 34, headerY);
  });

  if (bootle16.linear.length === 0) {
    ctx.fillStyle = hexToRgba('#ef4444', 0.9);
    ctx.font = '11px monospace';
    ctx.fillText('no output linear row (broken mode)', panelX + 20, headerY + 28);
    return;
  }

  bootle16.linear.forEach((row, rowIndex) => {
    const y = headerY + 28 + rowIndex * 44;
    row.coefficients.forEach((value, colIndex) => {
      ctx.fillStyle = hexToRgba(row.satisfied ? '#22c55e' : '#ef4444', isDark ? 0.14 : 0.10);
      ctx.fillRect(panelX + 14 + colIndex * 34, y - 12, 28, 24);
      ctx.strokeStyle = hexToRgba(row.satisfied ? '#22c55e' : '#ef4444', 0.4);
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX + 14 + colIndex * 34, y - 12, 28, 24);
      ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
      ctx.fillText(String(value), panelX + 22 + colIndex * 34, y + 4);
    });
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.fillText(row.equation, panelX + 18, y + 28);
  });
}
