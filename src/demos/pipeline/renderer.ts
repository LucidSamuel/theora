import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { hexToRgba } from '@/lib/canvas';
import { polynomialEvaluate } from '@/lib/math';
import {
  STAGES,
  STAGE_LABELS,
  type PipelineStage,
  type PipelineResults,
  type FaultType,
} from './logic';

// ── Layout constants ───────────────────────────────────────────────

const ACCENT = '#a78bfa';
const NODE_W = 110;
const NODE_H = 52;
const GAP_X = 46;
const ROW_GAP = 76;
const TOP_ROW_Y = 60;
const DETAIL_TOP = TOP_ROW_Y + NODE_H + ROW_GAP + NODE_H + 60;

const TOP_ROW: PipelineStage[] = ['witness', 'constraints', 'polynomial', 'commit'];
const BOT_ROW: PipelineStage[] = ['challenge', 'open', 'verify'];

interface StagePos {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getStagePositions(cx: number): Map<PipelineStage, StagePos> {
  const map = new Map<PipelineStage, StagePos>();
  const topTotal = TOP_ROW.length * NODE_W + (TOP_ROW.length - 1) * GAP_X;
  const topStartX = cx - topTotal / 2;

  for (let i = 0; i < TOP_ROW.length; i++) {
    map.set(TOP_ROW[i]!, {
      x: topStartX + i * (NODE_W + GAP_X),
      y: TOP_ROW_Y,
      w: NODE_W,
      h: NODE_H,
    });
  }

  const botTotal = BOT_ROW.length * NODE_W + (BOT_ROW.length - 1) * GAP_X;
  const botStartX = cx + topTotal / 2 - botTotal;

  for (let i = 0; i < BOT_ROW.length; i++) {
    map.set(BOT_ROW[i]!, {
      x: botStartX - i * (NODE_W + GAP_X) + (BOT_ROW.length - 1) * (NODE_W + GAP_X),
      y: TOP_ROW_Y + NODE_H + ROW_GAP,
      w: NODE_W,
      h: NODE_H,
    });
  }

  // Reverse bottom row x-positions so challenge is rightmost, verify is leftmost
  const botPositions = BOT_ROW.map((s) => map.get(s)!);
  const botXs = botPositions.map((p) => p.x).reverse();
  BOT_ROW.forEach((s, i) => {
    const pos = map.get(s)!;
    pos.x = botXs[i]!;
  });

  return map;
}

// ── Stage status ───────────────────────────────────────────────────

type StageStatus = 'pending' | 'active' | 'complete' | 'error';

function getStageStatus(
  stage: PipelineStage,
  activeStage: PipelineStage,
  results: PipelineResults
): StageStatus {
  const activeIdx = STAGES.indexOf(activeStage);
  const stageIdx = STAGES.indexOf(stage);

  if (stageIdx > activeIdx) return 'pending';
  if (stageIdx === activeIdx) return 'active';

  // Check for errors in completed stages
  if (stage === 'constraints' && results.constraints && !results.constraints.allSatisfied) return 'error';
  if (stage === 'verify' && results.verify && !results.verify.passed) return 'error';

  return 'complete';
}

function statusColor(status: StageStatus, time: number): string {
  switch (status) {
    case 'pending': return 'rgba(255,255,255,0.15)';
    case 'active': {
      const pulse = 0.7 + 0.3 * Math.sin(time * 3);
      return hexToRgba(ACCENT, pulse);
    }
    case 'complete': return hexToRgba('#22c55e', 0.85);
    case 'error': return hexToRgba('#ef4444', 0.85);
  }
}

function statusBg(status: StageStatus): string {
  switch (status) {
    case 'pending': return 'rgba(255,255,255,0.03)';
    case 'active': return hexToRgba(ACCENT, 0.1);
    case 'complete': return hexToRgba('#22c55e', 0.06);
    case 'error': return hexToRgba('#ef4444', 0.08);
  }
}

// ── Drawing ────────────────────────────────────────────────────────

export function renderPipeline(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  activeStage: PipelineStage,
  results: PipelineResults,
  fault: FaultType,
  isDark: boolean
) {
  const { width, height, time } = frame;
  const cx = width / 2;
  const positions = getStagePositions(cx);

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const textMuted = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';

  // ── Title ──
  ctx.font = '600 14px "Space Grotesk", sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'center';
  ctx.fillText('Proof Pipeline', cx, 36);

  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.fillText('f(x) = x² + x + 5   →   prove knowledge of x without revealing it', cx, 52);

  // ── Connection lines ──
  drawConnections(ctx, positions, activeStage, results, time);

  // ── Stage nodes ──
  for (const stage of STAGES) {
    const pos = positions.get(stage)!;
    const status = getStageStatus(stage, activeStage, results);
    drawStageNode(ctx, pos, stage, status, time, textPrimary, textMuted);
  }

  // ── Flow particles ──
  drawFlowParticles(ctx, positions, activeStage, time);

  // ── Detail panel ──
  drawDetailPanel(ctx, width, height, activeStage, results, fault, textPrimary, textSecondary, textMuted, isDark, time);
}

function drawStageNode(
  ctx: CanvasRenderingContext2D,
  pos: StagePos,
  stage: PipelineStage,
  status: StageStatus,
  time: number,
  textPrimary: string,
  textMuted: string
) {
  const { x, y, w, h } = pos;
  const r = 12;

  // Glow for active stage
  if (status === 'active') {
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 16;
  }

  // Background
  ctx.fillStyle = statusBg(status);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  // Border
  ctx.strokeStyle = statusColor(status, time);
  ctx.lineWidth = status === 'active' ? 2 : 1;
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Stage number
  const idx = STAGES.indexOf(stage);
  ctx.font = '600 9px "JetBrains Mono", monospace';
  ctx.fillStyle = statusColor(status, time);
  ctx.textAlign = 'center';
  ctx.fillText(`${idx + 1}`, x + w / 2, y + 18);

  // Label
  ctx.font = '600 11px "Space Grotesk", sans-serif';
  ctx.fillStyle = status === 'pending' ? textMuted : textPrimary;
  ctx.fillText(STAGE_LABELS[stage], x + w / 2, y + 34);

  // Status indicator
  if (status === 'complete') {
    ctx.font = '11px sans-serif';
    ctx.fillStyle = hexToRgba('#22c55e', 0.9);
    ctx.fillText('✓', x + w / 2, y + h - 4);
  } else if (status === 'error') {
    ctx.font = '11px sans-serif';
    ctx.fillStyle = hexToRgba('#ef4444', 0.9);
    ctx.fillText('✗', x + w / 2, y + h - 4);
  }
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  positions: Map<PipelineStage, StagePos>,
  activeStage: PipelineStage,
  _results: PipelineResults,
  time: number
) {
  const activeIdx = STAGES.indexOf(activeStage);

  // Top row connections: witness→constraints→polynomial→commit
  for (let i = 0; i < TOP_ROW.length - 1; i++) {
    const from = positions.get(TOP_ROW[i]!)!;
    const to = positions.get(TOP_ROW[i + 1]!)!;
    const connectionIdx = i; // stages 0-2
    const lit = connectionIdx < activeIdx;

    drawArrow(ctx, from.x + from.w, from.y + from.h / 2, to.x, to.y + to.h / 2, lit, time);
  }

  // Vertical: commit → challenge
  const commitPos = positions.get('commit')!;
  const challengePos = positions.get('challenge')!;
  const vertLit = STAGES.indexOf('commit') < activeIdx;
  drawArrow(
    ctx,
    commitPos.x + commitPos.w / 2,
    commitPos.y + commitPos.h,
    challengePos.x + challengePos.w / 2,
    challengePos.y,
    vertLit,
    time
  );

  // Bottom row connections: challenge→open→verify (right to left visually)
  for (let i = 0; i < BOT_ROW.length - 1; i++) {
    const from = positions.get(BOT_ROW[i]!)!;
    const to = positions.get(BOT_ROW[i + 1]!)!;
    const connectionIdx = STAGES.indexOf(BOT_ROW[i]!);
    const lit = connectionIdx < activeIdx;

    // Bottom row flows left
    drawArrow(ctx, from.x, from.y + from.h / 2, to.x + to.w, to.y + to.h / 2, lit, time);
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  lit: boolean,
  _time: number
) {
  ctx.strokeStyle = lit ? hexToRgba(ACCENT, 0.6) : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = lit ? 2 : 1;
  ctx.setLineDash(lit ? [] : [4, 4]);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  if (lit) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 7;
    ctx.fillStyle = hexToRgba(ACCENT, 0.6);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }
}

function drawFlowParticles(
  ctx: CanvasRenderingContext2D,
  positions: Map<PipelineStage, StagePos>,
  activeStage: PipelineStage,
  time: number
) {
  const activeIdx = STAGES.indexOf(activeStage);

  for (let i = 0; i < STAGES.length - 1; i++) {
    if (i >= activeIdx) continue;

    const from = positions.get(STAGES[i]!)!;
    const to = positions.get(STAGES[i + 1]!)!;

    let x1: number, y1: number, x2: number, y2: number;

    if (i < TOP_ROW.length - 1) {
      // Top row horizontal
      x1 = from.x + from.w;
      y1 = from.y + from.h / 2;
      x2 = to.x;
      y2 = to.y + to.h / 2;
    } else if (i === TOP_ROW.length - 1) {
      // Vertical drop
      x1 = from.x + from.w / 2;
      y1 = from.y + from.h;
      x2 = to.x + to.w / 2;
      y2 = to.y;
    } else {
      // Bottom row (flows left)
      x1 = from.x;
      y1 = from.y + from.h / 2;
      x2 = to.x + to.w;
      y2 = to.y + to.h / 2;
    }

    // Two particles per connection
    for (let p = 0; p < 2; p++) {
      const t = ((time * 0.6 + p * 0.5 + i * 0.3) % 1);
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const alpha = Math.sin(t * Math.PI) * 0.8;

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ACCENT, alpha);
      ctx.fill();
    }
  }
}

// ── Detail panel ───────────────────────────────────────────────────

function drawDetailPanel(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  activeStage: PipelineStage,
  results: PipelineResults,
  fault: FaultType,
  textPrimary: string,
  textSecondary: string,
  textMuted: string,
  isDark: boolean,
  time: number
) {
  const panelX = 40;
  const panelW = width - 80;
  const panelY = DETAIL_TOP;
  const panelH = 220;
  const r = 14;

  // Panel background
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, r);
  ctx.fill();
  ctx.stroke();

  // Stage title
  ctx.font = '600 13px "Space Grotesk", sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'left';
  const stageNum = STAGES.indexOf(activeStage) + 1;
  ctx.fillText(`Stage ${stageNum}: ${STAGE_LABELS[activeStage]}`, panelX + 20, panelY + 28);

  // Fault indicator
  if (fault !== 'none') {
    const faultAffectsStage = doesFaultAffect(fault, activeStage);
    if (faultAffectsStage) {
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = hexToRgba('#ef4444', 0.9);
      ctx.textAlign = 'right';
      ctx.fillText('⚠ FAULT INJECTED', panelX + panelW - 20, panelY + 28);
    }
  }

  // Content based on stage
  const contentY = panelY + 50;
  ctx.textAlign = 'left';

  switch (activeStage) {
    case 'witness':
      drawWitnessDetail(ctx, panelX + 20, contentY, results, textPrimary, textSecondary, textMuted);
      break;
    case 'constraints':
      drawConstraintDetail(ctx, panelX + 20, contentY, results, textPrimary, textSecondary, textMuted);
      break;
    case 'polynomial':
      drawPolynomialDetail(ctx, panelX + 20, contentY, panelW - 40, results, textPrimary, textSecondary, textMuted, isDark, time);
      break;
    case 'commit':
      drawCommitDetail(ctx, panelX + 20, contentY, results, textPrimary, textSecondary, textMuted);
      break;
    case 'challenge':
      drawChallengeDetail(ctx, panelX + 20, contentY, results, textPrimary, textSecondary, textMuted);
      break;
    case 'open':
      drawOpenDetail(ctx, panelX + 20, contentY, results, textPrimary, textSecondary, textMuted);
      break;
    case 'verify':
      drawVerifyDetail(ctx, panelX + 20, contentY, results, textPrimary, textSecondary, time);
      break;
  }
}

function doesFaultAffect(fault: FaultType, stage: PipelineStage): boolean {
  switch (fault) {
    case 'bad-witness': return stage === 'witness' || stage === 'constraints';
    case 'bad-polynomial': return stage === 'polynomial';
    case 'weak-fiat-shamir': return stage === 'challenge';
    case 'bad-opening': return stage === 'open';
    default: return false;
  }
}

function drawWitnessDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  textMuted: string
) {
  if (!results.witness) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textMuted;
    ctx.fillText('Step to this stage to compute the witness', x, y);
    return;
  }

  const w = results.witness;
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillStyle = textSecondary;
  ctx.fillText('Computation:  f(x) = x² + x + 5', x, y);

  ctx.fillStyle = textPrimary;
  ctx.fillText(`Secret input:   x  = ${w.x}`, x, y + 24);
  ctx.fillText(`Intermediate:   v₁ = x² = ${w.v1}`, x, y + 44);
  ctx.fillText(`Public output:  y  = ${w.y}`, x, y + 64);

  ctx.fillStyle = ACCENT;
  ctx.fillText(`Wire vector:    w = [${w.wires.join(', ')}]`, x, y + 96);

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textMuted;
  ctx.fillText('w = [1, x, y, v₁]  —  the full assignment to all circuit wires', x, y + 120);
}

function drawConstraintDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  textMuted: string
) {
  if (!results.constraints || !results.witness) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textMuted;
    ctx.fillText('Step to this stage to check constraints', x, y);
    return;
  }

  const c = results.constraints;
  ctx.font = '11px "JetBrains Mono", monospace';

  const labels = [
    'C₁:  x · x = v₁',
    'C₂:  (v₁ + x + 5) · 1 = y',
  ];

  for (let i = 0; i < c.rows.length; i++) {
    const row = c.rows[i]!;
    const ry = y + i * 52;

    ctx.fillStyle = textSecondary;
    ctx.fillText(labels[i]!, x, ry);

    ctx.fillStyle = textPrimary;
    ctx.fillText(`(A·w)(B·w) = ${row.lhs.toFixed(2)}     C·w = ${row.rhs.toFixed(2)}`, x + 20, ry + 18);

    ctx.fillStyle = row.satisfied ? hexToRgba('#22c55e', 0.9) : hexToRgba('#ef4444', 0.9);
    ctx.fillText(row.satisfied ? '✓ satisfied' : '✗ violated', x + 20, ry + 36);
  }

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textMuted;
  ctx.fillText('R1CS form: each constraint checks (A·w) × (B·w) = C·w', x, y + 120);
}

function drawPolynomialDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  availWidth: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  textMuted: string,
  isDark: boolean,
  _time: number
) {
  if (!results.polynomial) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textMuted;
    ctx.fillText('Step to this stage to encode as polynomial', x, y);
    return;
  }

  const poly = results.polynomial;
  const coeffs = poly.coefficients;

  // Show coefficients
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = textSecondary;
  ctx.fillText('p(x) = ' + formatPolynomial(coeffs), x, y);

  ctx.fillStyle = textPrimary;
  ctx.fillText('Interpolation: p(0)=1, p(1)=x, p(2)=y, p(3)=v₁', x, y + 20);

  // Mini polynomial plot
  const plotX = x;
  const plotY = y + 40;
  const plotW = Math.min(availWidth, 400);
  const plotH = 100;

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(plotX, plotY, plotW, plotH);

  // Find y range
  let yMin = Infinity, yMax = -Infinity;
  for (let px = -0.5; px <= 3.5; px += 0.05) {
    const pv = polynomialEvaluate(coeffs, px);
    if (pv < yMin) yMin = pv;
    if (pv > yMax) yMax = pv;
  }
  const yPad = (yMax - yMin) * 0.15 || 1;
  yMin -= yPad;
  yMax += yPad;

  const toScreenX = (v: number) => plotX + ((v + 0.5) / 4) * plotW;
  const toScreenY = (v: number) => plotY + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Draw curve
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let px = -0.5; px <= 3.5; px += 0.02) {
    const pv = polynomialEvaluate(coeffs, px);
    const sx = toScreenX(px);
    const sy = toScreenY(pv);
    if (first) { ctx.moveTo(sx, sy); first = false; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Draw interpolation points
  for (const pt of poly.points) {
    const sx = toScreenX(pt.x);
    const sy = toScreenY(pt.y);
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.strokeStyle = isDark ? '#000' : '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textMuted;
  ctx.fillText('Polynomial encodes all wire values — commitment hides this curve', plotX, plotY + plotH + 16);
}

function drawCommitDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  textMuted: string
) {
  if (!results.commit || !results.polynomial) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textMuted;
    ctx.fillText('Step to this stage to commit', x, y);
    return;
  }

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = textSecondary;
  ctx.fillText('C = Hash( polynomial coefficients )', x, y);

  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = ACCENT;
  ctx.fillText(`C = 0x${results.commit.commitment}`, x, y + 30);

  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.fillStyle = textPrimary;
  ctx.fillText('The commitment binds the prover to this specific polynomial.', x, y + 60);
  ctx.fillText('Changing any coefficient later would produce a different hash.', x, y + 78);

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textMuted;
  ctx.fillText('In real KZG: C = [p(τ)]₁ using an elliptic curve trusted setup', x, y + 110);
}

function drawChallengeDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  textMuted: string
) {
  if (!results.challenge) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textMuted;
    ctx.fillText('Step to this stage to derive challenge', x, y);
    return;
  }

  const ch = results.challenge;

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = textSecondary;
  ctx.fillText('Fiat-Shamir: z = Hash( transcript )', x, y);

  ctx.fillStyle = textPrimary;
  ctx.fillText(`Transcript inputs: [${ch.transcriptInputs.join(', ')}]`, x, y + 24);

  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = ACCENT;
  ctx.fillText(`z = ${ch.challenge}`, x, y + 56);

  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.fillStyle = textPrimary;
  ctx.fillText('The challenge z acts as the verifier\'s randomness.', x, y + 84);

  if (ch.transcriptInputs[0] === '(fixed)') {
    ctx.fillStyle = hexToRgba('#ef4444', 0.9);
    ctx.fillText('⚠ Challenge is fixed — attacker can precompute a convincing proof', x, y + 104);
  } else {
    ctx.fillStyle = textMuted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('Binding the commitment in the transcript prevents the prover from biasing z', x, y + 110);
  }
}

function drawOpenDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  textMuted: string
) {
  if (!results.open) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textMuted;
    ctx.fillText('Step to this stage to open the polynomial', x, y);
    return;
  }

  const op = results.open;

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = textSecondary;
  ctx.fillText(`Evaluate at z = ${op.z}:`, x, y);

  ctx.fillStyle = textPrimary;
  ctx.fillText(`p(${op.z}) = ${op.pz.toFixed(4)}`, x, y + 24);

  ctx.fillStyle = textSecondary;
  ctx.fillText('Quotient: q(x) = (p(x) − p(z)) / (x − z)', x, y + 52);

  ctx.fillStyle = textPrimary;
  ctx.fillText(`q(x) = ${formatPolynomial(op.quotientCoeffs)}`, x, y + 72);

  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = textMuted;
  ctx.fillText('The quotient exists iff (x − z) divides (p(x) − p(z)) — which it always does for a real polynomial', x, y + 104);
  ctx.fillText('In KZG the verifier checks this via a pairing: e(C − [v]₁, [1]₂) = e([π]₁, [τ − z]₂)', x, y + 120);
}

function drawVerifyDetail(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  results: PipelineResults,
  textPrimary: string,
  textSecondary: string,
  time: number
) {
  if (!results.verify) {
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillStyle = textSecondary;
    ctx.fillText('Step to this stage to verify', x, y);
    return;
  }

  const v = results.verify;

  const checks = [
    { label: 'Commitment binds to polynomial', ok: v.commitmentValid },
    { label: 'Evaluation p(z) is correct', ok: v.evaluationValid },
    { label: 'Quotient reconstructs p(x)', ok: v.quotientValid },
  ];

  ctx.font = '12px "JetBrains Mono", monospace';

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]!;
    const cy = y + i * 28;

    ctx.fillStyle = check.ok ? hexToRgba('#22c55e', 0.9) : hexToRgba('#ef4444', 0.9);
    ctx.fillText(check.ok ? '✓' : '✗', x, cy);

    ctx.fillStyle = textPrimary;
    ctx.fillText(check.label, x + 20, cy);
  }

  // Final verdict
  const verdictY = y + checks.length * 28 + 16;

  if (v.passed) {
    const pulse = 0.8 + 0.2 * Math.sin(time * 2);
    ctx.font = '600 16px "Space Grotesk", sans-serif';
    ctx.fillStyle = hexToRgba('#22c55e', pulse);
    ctx.fillText('PROOF ACCEPTED', x, verdictY);
  } else {
    ctx.font = '600 16px "Space Grotesk", sans-serif';
    ctx.fillStyle = hexToRgba('#ef4444', 0.9);
    ctx.fillText('PROOF REJECTED', x, verdictY);
  }

  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.fillStyle = textSecondary;
  ctx.fillText(v.detail, x, verdictY + 24);
}

// ── Helpers ────────────────────────────────────────────────────────

function formatPolynomial(coeffs: number[]): string {
  const terms: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i]!;
    if (Math.abs(c) < 1e-9) continue;
    const cStr = Math.abs(c) === 1 && i > 0 ? '' : Math.abs(c) % 1 < 1e-9 ? Math.abs(c).toFixed(0) : Math.abs(c).toFixed(2);
    const xStr = i === 0 ? '' : i === 1 ? 'x' : `x${superscript(i)}`;
    const sign = terms.length === 0 ? (c < 0 ? '−' : '') : (c < 0 ? ' − ' : ' + ');
    terms.push(sign + cStr + xStr);
  }
  return terms.length > 0 ? terms.join('') : '0';
}

function superscript(n: number): string {
  const map: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((d) => map[d] ?? d).join('');
}
