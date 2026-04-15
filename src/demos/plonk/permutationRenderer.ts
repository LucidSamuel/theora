import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { PlonkGate } from './logic';
import { encodeWirePosition } from './permutation';
import type { PermutationResult } from './permutation';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PermutationRenderState {
  result: PermutationResult;
  gates: PlonkGate[];
  selectedStep: number; // -1 = none
  fieldSize: bigint;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const MARGIN_X = 60;
const MARGIN_Y = 72;

// Wire table (left column)
const TABLE_X = MARGIN_X;
const TABLE_ROW_H = 32;
const TABLE_HEADER_H = 28;
const TABLE_COL_WIDTHS = [52, 36, 36, 36, 52, 52]; // gate, a, b, c, id_w, σ(w)

// Grand product bar chart (center column)
const BAR_SECTION_X = TABLE_X + TABLE_COL_WIDTHS.reduce((a, b) => a + b, 0) + 48;
const BAR_MAX_W = 160;
const BAR_H = 22;
const BAR_GAP = 10;
const BAR_LABEL_W = 52;

// ── Helpers ───────────────────────────────────────────────────────────────────

function tableWidth(): number {
  return TABLE_COL_WIDTHS.reduce((a, b) => a + b, 0);
}

function colX(colIdx: number): number {
  let x = TABLE_X;
  for (let i = 0; i < colIdx; i++) x += TABLE_COL_WIDTHS[i]!;
  return x;
}

function rowY(rowIdx: number, startY: number): number {
  return startY + TABLE_HEADER_H + rowIdx * TABLE_ROW_H;
}

function bigStr(v: bigint): string {
  return v.toString();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  options: {
    bold?: boolean;
    color?: string;
    bgColor?: string;
    align?: CanvasTextAlign;
    fontSize?: number;
  } = {},
): void {
  const { bold = false, color = '#a1a1aa', bgColor, align = 'center', fontSize = 10 } = options;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
  }

  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (align === 'center' ? w / 2 : align === 'right' ? w - 6 : 6), y + h / 2, w - 8);
}

function drawTableBorders(
  ctx: CanvasRenderingContext2D,
  startY: number,
  numRows: number,
  isDark: boolean,
): void {
  const borderColor = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.8);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;

  const totalH = TABLE_HEADER_H + numRows * TABLE_ROW_H;
  const totalW = tableWidth();

  // Outer border
  ctx.strokeRect(TABLE_X, startY, totalW, totalH);

  // Horizontal separator after header
  ctx.beginPath();
  ctx.moveTo(TABLE_X, startY + TABLE_HEADER_H);
  ctx.lineTo(TABLE_X + totalW, startY + TABLE_HEADER_H);
  ctx.stroke();

  // Horizontal row lines
  for (let r = 1; r < numRows; r++) {
    const y = startY + TABLE_HEADER_H + r * TABLE_ROW_H;
    ctx.beginPath();
    ctx.moveTo(TABLE_X, y);
    ctx.lineTo(TABLE_X + totalW, y);
    ctx.stroke();
  }

  // Vertical column lines
  let cx = TABLE_X;
  for (let c = 0; c < TABLE_COL_WIDTHS.length - 1; c++) {
    cx += TABLE_COL_WIDTHS[c]!;
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.lineTo(cx, startY + totalH);
    ctx.stroke();
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderPermutation(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: PermutationRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';
  const { result, gates, selectedStep } = state;
  const n = gates.length;

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

  // ── Heading (screen-space badge) ─────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const badgeText = `Permutation Argument — \u03b2=${bigStr(result.beta)}, \u03b3=${bigStr(result.gamma)}, GF(${bigStr(state.fieldSize)})`;
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

  const startY = MARGIN_Y;

  // ── Wire table (left) ────────────────────────────────────────────────────────
  const headerTextColor = isDark ? '#71717a' : '#a1a1aa';
  const headerBg = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.5 : 0.4);
  const rowBg = hexToRgba(isDark ? '#18181b' : '#fafafa', isDark ? 0.6 : 0.5);
  const selectedRowBg = hexToRgba('#6366f1', isDark ? 0.12 : 0.08);
  const cellTextColor = isDark ? '#e4e4e7' : '#27272a';
  const mutedColor = isDark ? '#52525b' : '#a1a1aa';

  // Header row
  const headers = ['gate', 'a', 'b', 'c', 'id_w', '\u03c3(w)'];
  headers.forEach((h, ci) => {
    drawCell(ctx, colX(ci), startY, TABLE_COL_WIDTHS[ci]!, TABLE_HEADER_H, h, {
      bold: true,
      color: headerTextColor,
      bgColor: headerBg,
    });
  });

  // Gate rows (3 rows per gate: one for each wire a, b, c)
  const wireNames = ['a', 'b', 'c'] as const;
  let rowIdx = 0;
  for (let gi = 0; gi < n; gi++) {
    const gate = gates[gi]!;
    const isSelected = selectedStep === gi;

    for (const w of wireNames) {
      const ry = rowY(rowIdx, startY);
      const bg = isSelected ? selectedRowBg : rowIdx % 2 === 0 ? rowBg : 'transparent';

      // Row background
      if (bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(TABLE_X, ry, tableWidth(), TABLE_ROW_H);
      }

      // Gate label (only on first wire of the gate)
      if (w === 'a') {
        drawCell(ctx, colX(0), ry, TABLE_COL_WIDTHS[0]!, TABLE_ROW_H * 3, `g${gi}`, {
          bold: true,
          color: isSelected
            ? isDark ? '#a5b4fc' : '#4f46e5'
            : cellTextColor,
          align: 'center',
          fontSize: 10,
        });
      }

      // Wire value
      const wireVal = gate[w];
      drawCell(ctx, colX(wireNames.indexOf(w) + 1), ry, TABLE_COL_WIDTHS[wireNames.indexOf(w) + 1]!, TABLE_ROW_H, String(wireVal), {
        color: isSelected ? (isDark ? '#c4b5fd' : '#7c3aed') : cellTextColor,
        fontSize: 10,
      });

      // Identity position id_w
      const posId = encodeWirePosition(gi, w);
      drawCell(ctx, colX(4), ry, TABLE_COL_WIDTHS[4]!, TABLE_ROW_H, bigStr(posId), {
        color: mutedColor,
        fontSize: 9,
      });

      // Sigma target σ(w)
      const sigmaKey = result.mapping.sigma.get(`${gi}:${w}`)!;
      const [sGateStr, sWire] = sigmaKey.split(':');
      const sigmaId = encodeWirePosition(Number(sGateStr), sWire as 'a' | 'b' | 'c');
      const sigmaText = sigmaKey === `${gi}:${w}` ? `${bigStr(sigmaId)} (id)` : `${bigStr(sigmaId)}`;
      const sigmaIsSelf = sigmaKey === `${gi}:${w}`;
      drawCell(ctx, colX(5), ry, TABLE_COL_WIDTHS[5]!, TABLE_ROW_H, sigmaText, {
        color: sigmaIsSelf ? mutedColor : (isDark ? '#86efac' : '#16a34a'),
        fontSize: 9,
      });

      rowIdx++;
    }
  }

  drawTableBorders(ctx, startY, n * 3, isDark);

  // Wire label annotations (left of gate column)
  rowIdx = 0;
  for (let gi = 0; gi < n; gi++) {
    for (const w of wireNames) {
      const ry = rowY(rowIdx, startY);
      ctx.fillStyle = mutedColor;
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(w, TABLE_X - 6, ry + TABLE_ROW_H / 2);
      rowIdx++;
    }
  }

  // ── Grand product bar chart (center) ─────────────────────────────────────────
  const barSectionX = BAR_SECTION_X;
  const barChartTitle = 'Grand Product Z';
  ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(barChartTitle, barSectionX, startY + 12);

  // Z(0) = 1 label
  const zEntries: { label: string; value: bigint; stepIdx: number }[] = [
    { label: 'Z(0)', value: 1n, stepIdx: -1 },
    ...result.steps.map((step, i) => ({
      label: `Z(${i + 1})`,
      value: step.productAfter,
      stepIdx: i,
    })),
  ];

  const maxVal = state.fieldSize;
  // Normalize bar width relative to field size (logarithmic feels better for big fields)
  const normalize = (v: bigint): number => {
    if (maxVal <= 1n) return 0;
    return Math.max(0.02, Math.log(1 + Number(v)) / Math.log(1 + Number(maxVal)));
  };

  // Find the first gate where the product diverges (num/den ratio != 1)
  // This is the gate whose contribution broke the running product.
  let divergenceStep = -1;
  if (!result.satisfied) {
    for (let si = 0; si < result.steps.length; si++) {
      const step = result.steps[si]!;
      // Check if this step's per-gate contribution is not identity
      const isIdentity =
        step.numerators.a === step.denominators.a &&
        step.numerators.b === step.denominators.b &&
        step.numerators.c === step.denominators.c;
      if (!isIdentity && step.productAfter !== step.productBefore) {
        // First step where product actually changes away from expected value
        divergenceStep = si;
        break;
      }
    }
  }

  zEntries.forEach((entry, ei) => {
    const barY = startY + TABLE_HEADER_H + ei * (BAR_H + BAR_GAP);
    const isSelected = entry.stepIdx === selectedStep;
    const isFinal = ei === zEntries.length - 1;
    const isDivergence = entry.stepIdx === divergenceStep;

    // Determine color: divergence → amber, final=1 → green, final≠1 → red, selected → accent, else neutral
    let barColor: string;
    if (isDivergence) {
      barColor = '#f59e0b'; // amber — highlight the exact gate that broke it
    } else if (isFinal) {
      barColor = result.satisfied ? '#22c55e' : '#ef4444';
    } else if (isSelected) {
      barColor = '#818cf8';
    } else {
      barColor = isDark ? '#52525b' : '#a1a1aa';
    }

    const barW = Math.max(2, normalize(entry.value) * BAR_MAX_W);

    // Background track
    ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', 0.4);
    drawRoundedRect(ctx, barSectionX + BAR_LABEL_W, barY, BAR_MAX_W, BAR_H, 3);
    ctx.fill();

    // Bar fill
    ctx.fillStyle = hexToRgba(barColor, isFinal || isSelected ? 0.75 : 0.55);
    drawRoundedRect(ctx, barSectionX + BAR_LABEL_W, barY, barW, BAR_H, 3);
    ctx.fill();

    // Stroke
    ctx.strokeStyle = hexToRgba(barColor, isFinal ? 0.95 : 0.5);
    ctx.lineWidth = isFinal ? 1.5 : 1;
    drawRoundedRect(ctx, barSectionX + BAR_LABEL_W, barY, BAR_MAX_W, BAR_H, 3);
    ctx.stroke();

    // Label (Z(i))
    ctx.fillStyle = isSelected
      ? (isDark ? '#a5b4fc' : '#4f46e5')
      : (isDark ? '#71717a' : '#a1a1aa');
    ctx.font = `${isFinal || isSelected ? 'bold ' : ''}10px monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.label, barSectionX + BAR_LABEL_W - 6, barY + BAR_H / 2);

    // Value text inside/after bar
    const valText = bigStr(entry.value);
    ctx.fillStyle = hexToRgba(barColor, isFinal ? 1.0 : 0.85);
    ctx.font = `${isFinal ? 'bold ' : ''}9px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(valText, barSectionX + BAR_LABEL_W + barW + 5, barY + BAR_H / 2);

    // Divergence marker
    if (isDivergence) {
      const markerX = barSectionX + BAR_LABEL_W + BAR_MAX_W + 8;
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u25C0 diverges here', markerX, barY + BAR_H / 2);
    }
  });

  // ── Verdict badge (Z(n) == 1 check) ─────────────────────────────────────────
  const verdictY = startY + TABLE_HEADER_H + zEntries.length * (BAR_H + BAR_GAP) + 16;
  const verdictColor = result.satisfied ? '#22c55e' : '#ef4444';
  const verdictText = result.satisfied
    ? `Z(${n}) = 1 — permutation satisfied`
    : `Z(${n}) = ${bigStr(result.finalProduct)} — permutation VIOLATED`;
  const verdictW = 260;

  ctx.fillStyle = hexToRgba(verdictColor, isDark ? 0.1 : 0.07);
  drawRoundedRect(ctx, barSectionX, verdictY, verdictW, 36, 6);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(verdictColor, isDark ? 0.65 : 0.5);
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, barSectionX, verdictY, verdictW, 36, 6);
  ctx.stroke();

  ctx.fillStyle = verdictColor;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(verdictText, barSectionX + verdictW / 2, verdictY + 18, verdictW - 16);

  // ── Per-step detail card (right) ─────────────────────────────────────────────
  if (selectedStep >= 0 && selectedStep < result.steps.length) {
    const step = result.steps[selectedStep]!;
    const detailStartX = Math.max(barSectionX + BAR_MAX_W + BAR_LABEL_W + 32, 360);
    const cardW = 220;
    const detailCardY = startY;

    // Card background
    ctx.fillStyle = hexToRgba(isDark ? '#27272a' : '#e4e4e7', isDark ? 0.45 : 0.35);
    drawRoundedRect(ctx, detailStartX, detailCardY, cardW, 220, 10);
    ctx.fill();
    ctx.strokeStyle = hexToRgba('#818cf8', isDark ? 0.4 : 0.3);
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, detailStartX, detailCardY, cardW, 220, 10);
    ctx.stroke();

    // Card header
    ctx.fillStyle = hexToRgba('#818cf8', isDark ? 0.15 : 0.1);
    drawRoundedRect(ctx, detailStartX, detailCardY, cardW, 26, 10);
    ctx.fill();
    ctx.fillRect(detailStartX, detailCardY + 10, cardW, 16);

    ctx.fillStyle = isDark ? '#a5b4fc' : '#4f46e5';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Gate ${step.gateIndex} Step Detail`, detailStartX + cardW / 2, detailCardY + 13);

    // Z before / after
    const lineH = 24;
    let ly = detailCardY + 34;
    const lx = detailStartX + 12;

    const drawDetailLine = (label: string, value: string, accent?: boolean) => {
      ctx.fillStyle = isDark ? '#52525b' : '#a1a1aa';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly + lineH / 2);
      ctx.fillStyle = accent
        ? isDark ? '#86efac' : '#16a34a'
        : isDark ? '#e4e4e7' : '#27272a';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value, detailStartX + cardW - 12, ly + lineH / 2);
      ly += lineH;
    };

    drawDetailLine('Z before', bigStr(step.productBefore));
    drawDetailLine('Z after', bigStr(step.productAfter));

    // Separator
    ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.6);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(detailStartX + 10, ly);
    ctx.lineTo(detailStartX + cardW - 10, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ly += 8;

    // Numerator/Denominator for each wire
    for (const w of wireNames) {
      ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`wire ${w}:`, lx, ly + lineH / 2);
      ly += lineH;

      drawDetailLine('  num', bigStr(step.numerators[w]));
      drawDetailLine('  den', bigStr(step.denominators[w]));

      // num/den ratio display
      const num = step.numerators[w];
      const den = step.denominators[w];
      const sameVal = num === den;
      drawDetailLine('  num/den', sameVal ? '1 (identity)' : `${bigStr(num)}/${bigStr(den)}`, sameVal);

      // Small separator between wires
      if (w !== 'c') {
        ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly + 2);
        ctx.lineTo(detailStartX + cardW - 12, ly + 2);
        ctx.stroke();
        ly += 4;
      }
    }
  } else {
    // Hint for selecting a step
    const hintX = Math.max(barSectionX + BAR_MAX_W + BAR_LABEL_W + 32, 360);
    ctx.fillStyle = isDark ? '#3f3f46' : '#d4d4d8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Select a gate step to see', hintX, startY + 16);
    ctx.fillText('numerator/denominator detail.', hintX, startY + 32);
  }

  ctx.textBaseline = 'alphabetic';
}
