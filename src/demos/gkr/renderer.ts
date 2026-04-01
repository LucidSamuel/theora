import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type {
  LayeredCircuit,
  GKRProof,
  GKRVerification,
} from './logic';

/* ── Public render state ─────────────────────────────────────────────── */

export interface GKRRenderState {
  circuit: LayeredCircuit;
  proof: GKRProof | null;
  verification: GKRVerification | null;
  currentStep: number; // -1 = overview, 0..n = active step
  phase: 'setup' | 'proving' | 'verifying' | 'complete';
}

/* ── Layout constants ────────────────────────────────────────────────── */

const GATE_W = 110;
const GATE_H = 44;
const GATE_RADIUS = 8;
const LAYER_VGAP = 80;    // vertical gap between layers
const GATE_HGAP = 32;     // horizontal gap between gates in a row

const CLAIM_CARD_W = 200;
const CLAIM_CARD_H = 80;
const CLAIM_CARD_RADIUS = 8;
const CLAIM_CARD_GAP = 20;

const BADGE_H = 30;
const BADGE_RADIUS = 8;

const VERDICT_H = 34;
const VERDICT_RADIUS = 8;

const ROW_H = 22;
const ROW_PAD_X = 10;

/* ── Zinc palette ────────────────────────────────────────────────────── */

const ZINC_900 = '#09090b';
const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_500 = '#52525b';
const ZINC_400 = '#71717a';
const ZINC_300 = '#a1a1aa';
const ZINC_100 = '#e4e4e7';

const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';
const COLOR_ACTIVE_BORDER = '#ec4899'; // pink accent for GKR
const COLOR_ADD = '#38bdf8';   // sky blue for add gates
const COLOR_MUL = '#f59e0b';   // amber for mul gates

/* ── Helpers ─────────────────────────────────────────────────────────── */

function bstr(v: bigint): string {
  return v.toString();
}

/** Compute gate positions for a single layer row, centered horizontally. */
function layerGatePositions(
  numGates: number,
  centerX: number,
  y: number,
): { x: number; y: number }[] {
  const totalW = numGates * GATE_W + (numGates - 1) * GATE_HGAP;
  const startX = centerX - totalW / 2;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < numGates; i++) {
    positions.push({
      x: startX + i * (GATE_W + GATE_HGAP),
      y,
    });
  }
  return positions;
}

/* ── Drawing primitives ──────────────────────────────────────────────── */

function drawGateBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  isHighlighted: boolean,
  isDark: boolean,
  accentColor: string,
  t: number,
): void {
  const borderAlpha = isHighlighted ? 0.7 + 0.3 * Math.sin(t * 2.8) : 0.3;

  // Background
  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.7 : 0.9);
  drawRoundedRect(ctx, x, y, GATE_W, GATE_H, GATE_RADIUS);
  ctx.fill();

  // Border
  ctx.strokeStyle = isHighlighted
    ? hexToRgba(accentColor, borderAlpha)
    : hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = isHighlighted ? 2 : 1;
  drawRoundedRect(ctx, x, y, GATE_W, GATE_H, GATE_RADIUS);
  ctx.stroke();

  // Gate type label (top-left)
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 10, y + 15);

  // Value (bottom-center)
  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x + GATE_W / 2, y + 32);
}

function drawInputBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  index: number,
  value: bigint,
  isHighlighted: boolean,
  isDark: boolean,
  t: number,
): void {
  const borderAlpha = isHighlighted ? 0.7 + 0.3 * Math.sin(t * 2.8) : 0.3;

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.7 : 0.9);
  drawRoundedRect(ctx, x, y, GATE_W, GATE_H, GATE_RADIUS);
  ctx.fill();

  ctx.strokeStyle = isHighlighted
    ? hexToRgba(COLOR_ACTIVE_BORDER, borderAlpha)
    : hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = isHighlighted ? 2 : 1;
  drawRoundedRect(ctx, x, y, GATE_W, GATE_H, GATE_RADIUS);
  ctx.stroke();

  // "input[i]" label
  ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`x[${index}]`, x + 10, y + 15);

  // Value
  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bstr(value), x + GATE_W / 2, y + 32);
}

/** Draw a connection line from a gate in layer below to a gate above. */
function drawWire(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  isDark: boolean,
  highlighted: boolean,
): void {
  const color = highlighted
    ? hexToRgba(COLOR_ACTIVE_BORDER, 0.5)
    : hexToRgba(isDark ? ZINC_500 : ZINC_400, 0.4);

  ctx.strokeStyle = color;
  ctx.lineWidth = highlighted ? 1.5 : 1;
  ctx.setLineDash([]);

  // Bezier curve for a nice arc
  const midY = (fromY + toY) / 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
  ctx.stroke();
}

/** Draw a layer label on the left side. */
function drawLayerLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  isDark: boolean,
  isHighlighted: boolean,
): void {
  ctx.fillStyle = isHighlighted
    ? COLOR_ACTIVE_BORDER
    : hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.8);
  ctx.font = isHighlighted ? 'bold 11px monospace' : '10px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + GATE_H / 2);
}

/* ── Claim reduction panel ───────────────────────────────────────────── */

function drawClaimCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  rows: { label: string; value: string; highlight?: 'pass' | 'fail' | null }[],
  isActive: boolean,
  isDark: boolean,
  t: number,
): void {
  const cardH = CLAIM_CARD_H + Math.max(0, (rows.length - 2) * ROW_H);
  const borderAlpha = isActive ? 0.7 + 0.3 * Math.sin(t * 2.8) : 0.25;

  // Background
  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#f4f4f5', isDark ? 0.6 : 0.85);
  drawRoundedRect(ctx, x, y, CLAIM_CARD_W, cardH, CLAIM_CARD_RADIUS);
  ctx.fill();

  // Border
  ctx.strokeStyle = isActive
    ? hexToRgba(COLOR_ACTIVE_BORDER, borderAlpha)
    : hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.35);
  ctx.lineWidth = isActive ? 1.5 : 1;
  drawRoundedRect(ctx, x, y, CLAIM_CARD_W, cardH, CLAIM_CARD_RADIUS);
  ctx.stroke();

  // Header
  const headerH = 26;
  ctx.fillStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.35);
  ctx.beginPath();
  ctx.moveTo(x + CLAIM_CARD_RADIUS, y);
  ctx.lineTo(x + CLAIM_CARD_W - CLAIM_CARD_RADIUS, y);
  ctx.quadraticCurveTo(x + CLAIM_CARD_W, y, x + CLAIM_CARD_W, y + CLAIM_CARD_RADIUS);
  ctx.lineTo(x + CLAIM_CARD_W, y + headerH);
  ctx.lineTo(x, y + headerH);
  ctx.lineTo(x, y + CLAIM_CARD_RADIUS);
  ctx.quadraticCurveTo(x, y, x + CLAIM_CARD_RADIUS, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + ROW_PAD_X, y + headerH / 2);

  // Rows
  let rowY = y + headerH + 4;
  for (const row of rows) {
    if (row.highlight) {
      const bg = row.highlight === 'pass'
        ? hexToRgba(COLOR_SUCCESS, 0.08)
        : hexToRgba(COLOR_ERROR, 0.08);
      ctx.fillStyle = bg;
      ctx.fillRect(x + 2, rowY, CLAIM_CARD_W - 4, ROW_H);
    }

    // Label
    ctx.fillStyle = isDark ? ZINC_400 : ZINC_500;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, x + ROW_PAD_X, rowY + ROW_H / 2);

    // Value
    if (row.highlight === 'pass') {
      ctx.fillStyle = COLOR_SUCCESS;
    } else if (row.highlight === 'fail') {
      ctx.fillStyle = COLOR_ERROR;
    } else {
      ctx.fillStyle = isDark ? ZINC_100 : ZINC_900;
    }
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(row.value, x + CLAIM_CARD_W - ROW_PAD_X, rowY + ROW_H / 2);

    rowY += ROW_H;
  }
}

/** Draw a vertical arrow for claim reduction. */
function drawVertArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y1: number,
  y2: number,
  color: string,
  label?: string,
  isDark?: boolean,
): void {
  if (y2 <= y1 + 4) return;

  const headSize = 6;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2 - headSize);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x, y2);
  ctx.lineTo(x - headSize * 0.55, y2 - headSize);
  ctx.lineTo(x + headSize * 0.55, y2 - headSize);
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.fillStyle = hexToRgba((isDark ?? true) ? ZINC_300 : ZINC_500, 0.8);
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 8, (y1 + y2) / 2);
  }
}

/* ── Main render function ────────────────────────────────────────────── */

export function renderGKR(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: GKRRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height, time } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const t = time;
  const isDark = theme === 'dark';
  const { circuit, proof, verification, currentStep, phase } = state;
  const numLayers = circuit.numLayers;

  // ── Background ────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  bg.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = bg;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.65,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)');

  // ── Compute layout ────────────────────────────────────────────────
  // Layers are drawn bottom-to-top: input (layer 0) at bottom, output at top.
  // We split canvas into left (circuit diagram) and right (claim reduction).
  const circuitAreaW = proof ? width * 0.55 : width;
  const circuitCenterX = circuitAreaW / 2;

  const topPad = 70;
  const bottomPad = 70;
  const availH = height - topPad - bottomPad;
  const layerSpacing = Math.min(LAYER_VGAP, availH / Math.max(numLayers - 1, 1));

  const totalCircuitH = (numLayers - 1) * layerSpacing;
  const circuitTopY = topPad + (availH - totalCircuitH) / 2;

  // Precompute gate positions for each layer (output at top, input at bottom)
  const layerPositions: { x: number; y: number }[][] = [];
  for (let li = 0; li < numLayers; li++) {
    const layer = circuit.layers[li]!;
    const numGates = layer.values.length;
    // Layer 0 (input) at bottom → y increases downward
    const layerY = circuitTopY + (numLayers - 1 - li) * layerSpacing;
    const positions = layerGatePositions(numGates, circuitCenterX, layerY);
    layerPositions.push(positions);
  }

  // ── Determine which layer is actively being verified ──────────────
  // currentStep maps to proof.layerProofs[currentStep], which verifies
  // circuit.layers[layerProofs[currentStep].layerIndex]
  let activeLayerIndex = -1;
  if (proof && currentStep >= 0 && currentStep < proof.layerProofs.length) {
    activeLayerIndex = proof.layerProofs[currentStep]!.layerIndex;
  }

  // ── Draw wires ────────────────────────────────────────────────────
  for (let li = 1; li < numLayers; li++) {
    const layer = circuit.layers[li]!;
    const currentPositions = layerPositions[li]!;
    const prevPositions = layerPositions[li - 1]!;
    const isLayerActive = li === activeLayerIndex;

    for (let gi = 0; gi < layer.gates.length; gi++) {
      const gate = layer.gates[gi]!;
      const gatePos = currentPositions[gi]!;
      const leftPos = prevPositions[gate.leftInput]!;
      const rightPos = prevPositions[gate.rightInput]!;

      // Wire from left input (top of lower box) to gate (bottom of upper box)
      drawWire(
        ctx,
        leftPos.x + GATE_W / 2,
        leftPos.y,          // top of lower gate
        gatePos.x + GATE_W * 0.35,
        gatePos.y + GATE_H,  // bottom of upper gate
        isDark,
        isLayerActive,
      );
      drawWire(
        ctx,
        rightPos.x + GATE_W / 2,
        rightPos.y,
        gatePos.x + GATE_W * 0.65,
        gatePos.y + GATE_H,
        isDark,
        isLayerActive,
      );
    }
  }

  // ── Draw gates ────────────────────────────────────────────────────
  for (let li = 0; li < numLayers; li++) {
    const layer = circuit.layers[li]!;
    const positions = layerPositions[li]!;
    const isLayerActive = li === activeLayerIndex;
    const isInputHighlighted = activeLayerIndex !== -1 && li === 0 && currentStep === (proof?.layerProofs.length ?? 0) - 1;

    // Layer label on the left
    const leftmostX = positions.length > 0 ? positions[0]!.x : circuitCenterX;
    const labelText = li === 0
      ? 'Input'
      : li === numLayers - 1
        ? 'Output'
        : `Layer ${li}`;
    drawLayerLabel(
      ctx,
      leftmostX - 16,
      positions[0]?.y ?? circuitTopY,
      labelText,
      isDark,
      isLayerActive || isInputHighlighted,
    );

    if (li === 0) {
      // Input layer: plain value boxes
      for (let gi = 0; gi < layer.values.length; gi++) {
        const pos = positions[gi]!;
        drawInputBox(
          ctx, pos.x, pos.y, gi, layer.values[gi]!,
          isInputHighlighted, isDark, t,
        );
      }
    } else {
      // Gate layer
      for (let gi = 0; gi < layer.gates.length; gi++) {
        const gate = layer.gates[gi]!;
        const pos = positions[gi]!;
        const gateLabel = gate.type === 'add' ? '+ ADD' : '\u00d7 MUL';
        const accentColor = gate.type === 'add' ? COLOR_ADD : COLOR_MUL;
        drawGateBox(
          ctx, pos.x, pos.y, gateLabel, bstr(layer.values[gi]!),
          isLayerActive, isDark, accentColor, t,
        );
      }
    }
  }

  // ── Claim reduction panel (right side) ────────────────────────────
  if (proof) {
    const claimX = circuitAreaW + 40;
    let claimY = topPad + 20;

    // Output claim card
    const outputRows: { label: string; value: string; highlight?: 'pass' | 'fail' | null }[] = [
      { label: 'V_out(r)', value: bstr(proof.outputClaim) },
      { label: 'point', value: `[${proof.outputPoint.map(bstr).join(',')}]` },
    ];
    drawClaimCard(ctx, claimX, claimY, 'Output Claim', outputRows, currentStep === 0, isDark, t);
    const outputCardBottom = claimY + CLAIM_CARD_H + (outputRows.length - 2) * ROW_H;
    claimY = outputCardBottom + CLAIM_CARD_GAP;

    // Layer proof cards
    for (let i = 0; i < proof.layerProofs.length; i++) {
      const lp = proof.layerProofs[i]!;
      const isActive = currentStep === i;

      // Draw arrow from previous card
      drawVertArrow(
        ctx,
        claimX + CLAIM_CARD_W / 2,
        claimY - CLAIM_CARD_GAP + 2,
        claimY - 2,
        hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.5),
        'sumcheck',
        isDark,
      );

      const rows: { label: string; value: string; highlight?: 'pass' | 'fail' | null }[] = [
        { label: 'claim', value: bstr(lp.claim) },
        { label: 'reduced', value: bstr(lp.reducedClaim) },
        { label: 'challenges', value: `[${lp.challenges.map(bstr).join(',')}]` },
      ];

      // If verification completed, show pass/fail for this layer
      if (verification) {
        const layerFailed = verification.failedLayer === lp.layerIndex;
        const layerPassed = !layerFailed && (verification.passed || (verification.failedLayer !== null && verification.failedLayer < lp.layerIndex));
        if (layerFailed) {
          rows.push({ label: 'status', value: 'FAILED', highlight: 'fail' });
        } else if (layerPassed || verification.passed) {
          rows.push({ label: 'status', value: 'PASS', highlight: 'pass' });
        }
      }

      const title = `Layer ${lp.layerIndex} Reduction`;
      drawClaimCard(ctx, claimX, claimY, title, rows, isActive, isDark, t);

      const cardH = CLAIM_CARD_H + Math.max(0, (rows.length - 2) * ROW_H);
      claimY += cardH + CLAIM_CARD_GAP;
    }

    // Input evaluation card
    drawVertArrow(
      ctx,
      claimX + CLAIM_CARD_W / 2,
      claimY - CLAIM_CARD_GAP + 2,
      claimY - 2,
      hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.5),
      'oracle',
      isDark,
    );

    const inputRows: { label: string; value: string; highlight?: 'pass' | 'fail' | null }[] = [
      { label: 'V_input(r)', value: bstr(proof.inputEval) },
    ];
    if (verification) {
      const inputFailed = verification.failedLayer === 0;
      if (inputFailed) {
        inputRows.push({ label: 'status', value: 'MISMATCH', highlight: 'fail' });
      } else if (verification.passed) {
        inputRows.push({ label: 'status', value: 'MATCH', highlight: 'pass' });
      }
    }
    const isInputActive = currentStep === proof.layerProofs.length - 1 || phase === 'complete';
    drawClaimCard(ctx, claimX, claimY, 'Input Check', inputRows, isInputActive, isDark, t);
  }

  // ── Screen-space overlays ─────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Header badge ──────────────────────────────────────────────────
  const d = numLayers;
  const n = circuit.layers[0]!.values.length;
  const p = circuit.fieldSize;
  const headerText = `GKR Protocol \u2014 ${d} layers, ${n} inputs, GF(${bstr(p)})`;
  ctx.font = '11px monospace';
  const headerW = ctx.measureText(headerText).width + 40;
  const headerX = width / 2 - headerW / 2;
  const headerY = 16;

  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#e4e4e7', isDark ? 0.85 : 0.9);
  drawRoundedRect(ctx, headerX, headerY, headerW, BADGE_H, BADGE_RADIUS);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, headerX, headerY, headerW, BADGE_H, BADGE_RADIUS);
  ctx.stroke();

  ctx.fillStyle = isDark ? ZINC_300 : ZINC_500;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headerText, width / 2, headerY + BADGE_H / 2);

  // ── Verdict badge ─────────────────────────────────────────────────
  if (verification !== null && phase === 'complete') {
    const passed = verification.passed;
    const verdictText = passed ? '\u2713 VERIFIED' : '\u2717 FAILED';
    const verdictColor = passed ? COLOR_SUCCESS : COLOR_ERROR;
    const reasonText = verification.reason;

    ctx.font = 'bold 13px monospace';
    const mainW = ctx.measureText(verdictText).width + 48;
    const verdictW = reasonText
      ? Math.max(mainW, ctx.measureText(reasonText).width + 48)
      : mainW;
    const totalVerdictH = reasonText ? VERDICT_H + 18 : VERDICT_H;
    const verdictX = width / 2 - verdictW / 2;
    const verdictY = height - totalVerdictH - 16;

    ctx.fillStyle = hexToRgba(verdictColor, isDark ? 0.12 : 0.08);
    drawRoundedRect(ctx, verdictX, verdictY, verdictW, totalVerdictH, VERDICT_RADIUS);
    ctx.fill();

    ctx.strokeStyle = hexToRgba(verdictColor, isDark ? 0.55 : 0.45);
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, verdictX, verdictY, verdictW, totalVerdictH, VERDICT_RADIUS);
    ctx.stroke();

    ctx.fillStyle = verdictColor;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(verdictText, width / 2, verdictY + VERDICT_H / 2);

    if (reasonText) {
      ctx.fillStyle = hexToRgba(verdictColor, 0.7);
      ctx.font = '9px monospace';
      ctx.fillText(reasonText, width / 2, verdictY + VERDICT_H + 6);
    }
  } else if (phase === 'proving' || phase === 'verifying') {
    const phaseText = phase === 'proving'
      ? 'Prover computing layer reductions\u2026'
      : 'Verifier checking\u2026';
    ctx.fillStyle = hexToRgba(isDark ? ZINC_400 : ZINC_500, 0.9);
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phaseText, width / 2, height - 24);
  }

  ctx.restore();
}
