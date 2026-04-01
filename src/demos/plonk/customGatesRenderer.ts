import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { CustomCircuit } from './customGates';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomGatesRenderState {
  circuit: CustomCircuit;
  standardPlonkCount: number;
  degreeSummary: Record<number, number>;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const MARGIN_X = 60;
const MARGIN_Y = 72;

const GATE_CARD_W = 340;
const GATE_CARD_H = 100;
const GATE_CARD_GAP = 28;

// Degree color mapping
function degreeColor(degree: number): string {
  if (degree <= 1) return '#3b82f6'; // blue
  if (degree === 2) return '#eab308'; // yellow
  if (degree <= 4) return '#f97316'; // orange
  return '#ef4444'; // red (degree 5+)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawGateCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gate: CustomCircuit['gates'][number],
  idx: number,
  isDark: boolean,
): void {
  const ok = gate.satisfied;
  const dColor = degreeColor(gate.definition.degree);
  const statusColor = ok ? '#22c55e' : '#ef4444';

  // Card background
  ctx.fillStyle = hexToRgba(isDark ? '#18181b' : '#fafafa', isDark ? 0.7 : 0.6);
  drawRoundedRect(ctx, x, y, GATE_CARD_W, GATE_CARD_H, 10);
  ctx.fill();

  // Card border
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.6);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, GATE_CARD_W, GATE_CARD_H, 10);
  ctx.stroke();

  // Header bar
  ctx.fillStyle = hexToRgba(dColor, isDark ? 0.12 : 0.08);
  drawRoundedRect(ctx, x, y, GATE_CARD_W, 28, 10);
  ctx.fill();
  ctx.fillRect(x, y + 14, GATE_CARD_W, 14);

  // Degree badge (left of header)
  const degText = `deg ${gate.definition.degree}`;
  ctx.font = 'bold 9px monospace';
  const degW = ctx.measureText(degText).width + 12;
  const degBadgeX = x + 8;
  const degBadgeY = y + 5;

  ctx.fillStyle = hexToRgba(dColor, isDark ? 0.25 : 0.2);
  drawRoundedRect(ctx, degBadgeX, degBadgeY, degW, 18, 4);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(dColor, 0.6);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, degBadgeX, degBadgeY, degW, 18, 4);
  ctx.stroke();

  ctx.fillStyle = dColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(degText, degBadgeX + degW / 2, degBadgeY + 9);

  // Gate label (center of header)
  ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`#${idx} ${gate.definition.label}`, degBadgeX + degW + 10, y + 14);

  // Status badge (right of header)
  const satText = ok ? '\u2713 SAT' : '\u2717 UNSAT';
  ctx.fillStyle = statusColor;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(satText, x + GATE_CARD_W - 12, y + 14);

  // Wire values row
  const wireY = y + 44;
  const wireColor = isDark ? '#e4e4e7' : '#3f3f46';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = wireColor;
  ctx.fillText(`a = ${gate.a}`, x + 14, wireY);
  ctx.fillText(`b = ${gate.b}`, x + 14 + 100, wireY);
  ctx.fillText(`c = ${gate.c}`, x + 14 + 200, wireY);

  // Gate type badge
  const typeBadge = gate.definition.type.toUpperCase();
  ctx.font = '9px monospace';
  const typeW = ctx.measureText(typeBadge).width + 12;
  const typeX = x + GATE_CARD_W - typeW - 10;
  const typeY = wireY - 7;

  ctx.fillStyle = hexToRgba(dColor, isDark ? 0.1 : 0.07);
  drawRoundedRect(ctx, typeX, typeY, typeW, 16, 3);
  ctx.fill();
  ctx.fillStyle = hexToRgba(dColor, 0.8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(typeBadge, typeX + typeW / 2, typeY + 8);

  // Equation row
  const eqY = y + 66;
  ctx.font = '10px monospace';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Build equation based on type
  let equation: string;
  switch (gate.definition.type) {
    case 'add':
      equation = `${gate.definition.selectors.qL}\u00b7${gate.a} + ${gate.definition.selectors.qR}\u00b7${gate.b} + ${gate.definition.selectors.qO}\u00b7${gate.c} = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
      break;
    case 'mul':
      equation = `${gate.definition.selectors.qM}\u00b7${gate.a}\u00b7${gate.b} + ${gate.definition.selectors.qO}\u00b7${gate.c} = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
      break;
    case 'bool':
      equation = `${gate.a}\u00b7(1-${gate.a}) = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
      break;
    case 'range4':
      equation = `${gate.a}\u00b7(${gate.a}-1)\u00b7(${gate.a}-2)\u00b7(${gate.a}-3) = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
      break;
    case 'poseidon':
      equation = `${gate.a}\u2075 - ${gate.c} = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
      break;
    case 'ec_add':
      equation = `${gate.a}\u00b7${gate.b} - ${gate.b} = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
      break;
    default:
      equation = `evaluate(${gate.a}, ${gate.b}, ${gate.c}) = ${gate.definition.evaluate(gate.a, gate.b, gate.c)}`;
  }
  ctx.fillText(equation, x + 14, eqY, GATE_CARD_W - 28);

  // Satisfaction indicator line at bottom
  ctx.fillStyle = hexToRgba(statusColor, isDark ? 0.4 : 0.3);
  drawRoundedRect(ctx, x, y + GATE_CARD_H - 4, GATE_CARD_W, 4, 2);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
}

function drawDegreeDistribution(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  degreeSummary: Record<number, number>,
  totalGates: number,
  isDark: boolean,
): void {
  const BAR_W = 200;
  const BAR_H = 18;
  const BAR_GAP = 6;

  // Section label
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Degree Distribution', x, y);

  const degrees = Object.keys(degreeSummary)
    .map(Number)
    .sort((a, b) => a - b);

  degrees.forEach((deg, i) => {
    const count = degreeSummary[deg]!;
    const barY = y + 12 + i * (BAR_H + BAR_GAP);
    const fraction = totalGates > 0 ? count / totalGates : 0;
    const barFillW = Math.max(4, fraction * BAR_W);
    const color = degreeColor(deg);

    // Background track
    ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.4);
    drawRoundedRect(ctx, x, barY, BAR_W, BAR_H, 3);
    ctx.fill();

    // Fill
    ctx.fillStyle = hexToRgba(color, isDark ? 0.55 : 0.45);
    drawRoundedRect(ctx, x, barY, barFillW, BAR_H, 3);
    ctx.fill();

    // Border
    ctx.strokeStyle = hexToRgba(color, 0.5);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, barY, BAR_W, BAR_H, 3);
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`deg ${deg}`, x - 8, barY + BAR_H / 2);

    // Count
    ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${count} gate${count !== 1 ? 's' : ''} (${Math.round(fraction * 100)}%)`, x + BAR_W + 8, barY + BAR_H / 2);
  });

  ctx.textBaseline = 'alphabetic';
}

function drawConversionBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  customCount: number,
  standardCount: number,
  isDark: boolean,
): void {
  const BOX_W = 200;
  const BOX_H = 72;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.4 : 0.3);
  drawRoundedRect(ctx, x, y, BOX_W, BOX_H, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.4);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, BOX_W, BOX_H, 8);
  ctx.stroke();

  // Header
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Standard PLONK Conversion', x + BOX_W / 2, y + 14);

  // Custom count
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '10px monospace';
  ctx.fillText(`${customCount} custom gates`, x + BOX_W / 2, y + 34);

  // Arrow
  ctx.fillStyle = hexToRgba(isDark ? '#818cf8' : '#6366f1', 0.7);
  ctx.font = 'bold 10px monospace';
  ctx.fillText('\u2193', x + BOX_W / 2, y + 46);

  // Standard count
  const expanded = standardCount > customCount;
  const countColor = expanded ? '#f97316' : '#22c55e';
  ctx.fillStyle = countColor;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${standardCount} standard gates`, x + BOX_W / 2, y + 60);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderCustomGates(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: CustomGatesRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';
  const { circuit, standardPlonkCount, degreeSummary: degSummary } = state;
  const n = circuit.gates.length;

  // Max degree
  const maxDeg = n > 0
    ? Math.max(...circuit.gates.map((g) => g.definition.degree))
    : 0;

  // ── Background ──────────────────────────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  gradient.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = gradient;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.65,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Screen-space badge ───────────────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const badgeText = `Custom Gates \u2014 ${n} gate${n !== 1 ? 's' : ''}, max degree ${maxDeg}`;
  ctx.font = '11px monospace';
  const bw = ctx.measureText(badgeText).width + 32;
  const bx = width / 2 - bw / 2;
  const by = 16;

  ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.85);
  drawRoundedRect(ctx, bx, by, bw, 30, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#a1a1aa', 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, bx, by, bw, 30, 8);
  ctx.stroke();

  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, by + 15);

  ctx.restore();

  // ── Gate cards (center) ───────────────────────────────────────────────────────
  const cardsX = MARGIN_X;
  const cardsStartY = MARGIN_Y;

  if (n === 0) {
    ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('No gates in circuit. Add a gate to get started.', cardsX, cardsStartY);
  } else {
    circuit.gates.forEach((gate, idx) => {
      const cardY = cardsStartY + idx * (GATE_CARD_H + GATE_CARD_GAP);
      drawGateCard(ctx, cardsX, cardY, gate, idx, isDark);
    });
  }

  // ── Right column: conversion box + degree distribution ─────────────────────
  const rightX = cardsX + GATE_CARD_W + 60;

  drawConversionBox(ctx, rightX, cardsStartY, n, standardPlonkCount, isDark);

  const degDistY = cardsStartY + 100;
  drawDegreeDistribution(ctx, rightX + 56, degDistY, degSummary, n, isDark);

  // ── Satisfaction summary badge ────────────────────────────────────────────────
  if (n > 0) {
    const allSat = circuit.gates.every((g) => g.satisfied);
    const satColor = allSat ? '#22c55e' : '#ef4444';
    const summaryY = cardsStartY + n * (GATE_CARD_H + GATE_CARD_GAP) + 8;
    const summaryW = 220;
    const summaryH = 40;

    ctx.fillStyle = hexToRgba(satColor, isDark ? 0.1 : 0.07);
    drawRoundedRect(ctx, cardsX, summaryY, summaryW, summaryH, 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(satColor, isDark ? 0.65 : 0.5);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cardsX, summaryY, summaryW, summaryH, 8);
    ctx.stroke();

    ctx.fillStyle = satColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const satCount = circuit.gates.filter((g) => g.satisfied).length;
    ctx.fillText(
      allSat
        ? `\u2713 All ${n} gates satisfied`
        : `\u2717 ${satCount}/${n} gates satisfied`,
      cardsX + summaryW / 2,
      summaryY + summaryH / 2,
    );
  }

  ctx.textBaseline = 'alphabetic';
}
