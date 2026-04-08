import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, hexToRgba } from '@/lib/canvas';
import type { FiatShamirMode, ImportedTranscriptTrace, TranscriptProof } from './logic';

const MODULUS = 97;
const GENERATOR = 7;

export function renderFiatShamir(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  proof: TranscriptProof,
  forged: TranscriptProof | null,
  mode: FiatShamirMode,
  theme: 'dark' | 'light',
  importedTrace: ImportedTranscriptTrace | null = null,
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

  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');

  // ── Transcript steps ──────────────────────────────────────────────────────
  // Step 2 (Challenge) gets amber highlight — it's the cryptographically
  // sensitive step that distinguishes interactive from non-interactive proofs.
  const steps = importedTrace
    ? [
        { label: '1. Commit', value: `C = ${truncate(importedTrace.commitment, 18)}` },
        { label: '2. Transcript', value: importedTrace.transcriptInputs.join(' | ') || '(fixed challenge)' },
        { label: '3. Challenge', value: `z = ${importedTrace.challenge}` },
        { label: '4. Outcome', value: importedTrace.predictable ? 'predictable' : 'bound to transcript' },
      ]
    : [
        { label: '1. Commit',   value: `t = ${proof.commitment}` },
        { label: '2. Challenge',value: `c = ${proof.challenge}` },
        { label: '3. Respond',  value: `z = ${proof.response}` },
        { label: '4. Verify',   value: proof.valid ? 'passes' : 'fails' },
      ];

  steps.forEach((step, index) => {
    const x = 56 + index * 170;
    const y = 120;
    const isChallenge = index === 1;
    const isVerify = index === 3;
    const verifyValid = importedTrace ? !importedTrace.predictable : proof.valid;

    const borderColor = isChallenge
      ? '#f59e0b'  // amber — challenge is the semantic highlight
      : isVerify
        ? (verifyValid ? '#22c55e' : '#ef4444')
        : (isDark ? '#3f3f46' : '#d4d4d8');

    ctx.fillStyle = hexToRgba(isDark ? '#111113' : '#ffffff', 0.96);
    ctx.fillRect(x, y, 146, 88);
    ctx.strokeStyle = hexToRgba(borderColor, isDark ? 0.65 : 0.55);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 146, 88);

    // Top accent bar for the challenge step
    if (isChallenge) {
      ctx.fillStyle = hexToRgba('#f59e0b', 0.15);
      ctx.fillRect(x, y, 146, 6);
    }
    if (isVerify) {
      ctx.fillStyle = hexToRgba(verifyValid ? '#22c55e' : '#ef4444', 0.12);
      ctx.fillRect(x, y, 146, 88);
    }

    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(step.label, x + 12, y + 28);
    ctx.font = '11px monospace';
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.fillText(step.value, x + 12, y + 52);
  });

  // ── Step card hover detection ────────────────────────────────────────
  let hoveredStep: number | null = null;
  for (let i = 0; i < steps.length; i++) {
    const sx = 56 + i * 170;
    const sy = 120;
    if (mouseX >= sx && mouseX <= sx + 146 && mouseY >= sy && mouseY <= sy + 88) {
      hoveredStep = i;
      break;
    }
  }

  if (hoveredStep !== null) {
    const descriptions = importedTrace
      ? [
          'Prover sends a hiding commitment C',
          'Transcript inputs bound to the challenge',
          'Verifier challenge derived from transcript',
          importedTrace.predictable ? 'Challenge is predictable — vulnerable' : 'Challenge is bound — secure',
        ]
      : [
          `Commitment: t = g·r mod p = ${GENERATOR}·${proof.commitment > 0 ? '...' : '0'}`,
          mode === 'interactive' ? 'Challenge from verifier randomness' : mode === 'fs-correct' ? 'c = H(statement, pubkey, commitment)' : 'c = H(statement, pubkey) — missing commitment!',
          `Response: z = r + c·s mod p = ${proof.response}`,
          proof.valid ? 'g·z ≡ t + c·y (mod p) — verified' : 'Verification failed',
        ];

    const tipText = descriptions[hoveredStep] ?? '';
    const sx = 56 + hoveredStep * 170;

    ctx.save();
    ctx.font = '11px monospace';
    const tm = ctx.measureText(tipText);
    const tw = tm.width + 16;
    const th = 24;
    let tx = sx;
    let ty = 120 + 88 + 6; // Below the card

    if (tx + tw > width - 10) tx = width - tw - 10;
    if (tx < 10) tx = 10;

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

  // ── Heading ────────────────────────────────────────────────────────────────
  ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  const modeLabel =
    mode === 'interactive' ? 'Interactive verifier challenge' :
    mode === 'fs-correct'  ? 'Fiat-Shamir with full transcript hash' :
                             'Broken Fiat-Shamir transcript';
  ctx.fillText(importedTrace ? `${modeLabel} · imported from proof pipeline` : modeLabel, 56, 56);

  ctx.font = '11px monospace';
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.fillText(
    importedTrace
      ? `Committed output y = ${importedTrace.publicOutput}, challenge = ${importedTrace.challenge}`
      : `Public key y = ${proof.publicKey}, statement = ${proof.statement}`,
    56,
    78
  );

  // ── Group parameters (top-right compact box) ──────────────────────────────
  const paramX = width - 180;
  ctx.fillStyle = hexToRgba(isDark ? '#111113' : '#ffffff', 0.92);
  ctx.fillRect(paramX, 44, 140, 44);
  ctx.strokeStyle = hexToRgba(isDark ? '#3f3f46' : '#d4d4d8', 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(paramX, 44, 140, 44);
  ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('g = 7, p = 97', paramX + 12, 64);
  ctx.fillText('GF(97) toy field', paramX + 12, 80);

  // ── Verification equation & hash inputs ───────────────────────────────────
  if (!importedTrace) {
    // Verification equation
    const eqY = 240;
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Verification check', 56, eqY);

    ctx.font = '11px monospace';
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    ctx.fillText(`g\u00B7z mod p  \u225F  (t + c\u00B7y) mod p`, 56, eqY + 20);

    const lhs = ((GENERATOR * proof.response) % MODULUS + MODULUS) % MODULUS;
    const rhs = ((proof.commitment + proof.challenge * proof.publicKey) % MODULUS + MODULUS) % MODULUS;
    ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
    ctx.fillText(`${GENERATOR}\u00B7${proof.response} mod ${MODULUS} = ${lhs}`, 56, eqY + 40);
    ctx.fillText(`${proof.commitment} + ${proof.challenge}\u00B7${proof.publicKey} mod ${MODULUS} = ${rhs}`, 56, eqY + 56);

    ctx.fillStyle = proof.valid ? '#22c55e' : '#ef4444';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(proof.valid ? 'Equal \u2014 proof valid' : 'Not equal \u2014 proof invalid', 56, eqY + 78);

    // Hash inputs / challenge derivation
    const hashY = eqY + 110;
    ctx.fillStyle = isDark ? '#fafafa' : '#09090b';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('Challenge derivation', 56, hashY);

    ctx.font = '11px monospace';
    if (mode === 'interactive') {
      ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
      ctx.fillText('c = verifier seed (no hash)', 56, hashY + 20);
    } else if (mode === 'fs-correct') {
      const hashInput = `H(${proof.statement}, ${proof.publicKey}, ${proof.commitment})`;
      ctx.fillStyle = '#22c55e';
      ctx.fillText(`c = ${hashInput}`, 56, hashY + 20);
      ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
      ctx.fillText('Commitment t is included \u2014 challenge depends on it', 56, hashY + 38);
    } else {
      const hashInputBroken = `H(${proof.statement}, ${proof.publicKey})`;
      const hashInputCorrect = `H(${proof.statement}, ${proof.publicKey}, ${proof.commitment})`;
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`c = ${hashInputBroken}`, 56, hashY + 20);
      ctx.fillStyle = isDark ? '#a1a1aa' : '#71717a';
      ctx.fillText('Commitment t is missing \u2014 challenge is predictable', 56, hashY + 38);
      ctx.fillStyle = hexToRgba('#22c55e', 0.4);
      ctx.fillText(`correct: c = ${hashInputCorrect}`, 56, hashY + 58);
    }
  }

  // ── Forgery panel ─────────────────────────────────────────────────────────
  if (importedTrace || forged) {
    const bannerMaxW = width - 112;
    const textMaxW = bannerMaxW - 32;
    const isImported = !!importedTrace;
    const accentColor = isImported
      ? (importedTrace!.predictable ? '#ef4444' : '#22c55e')
      : '#ef4444';

    // Compute wrapped lines to size the banner
    ctx.font = 'bold 12px monospace';
    const headline = isImported
      ? (importedTrace!.predictable
          ? 'Challenge is predictable before the opening proof is formed.'
          : 'Challenge stays bound to the committed transcript.')
      : 'Forgery succeeds — challenge is predictable without the commitment.';
    const headLines = wrapText(ctx, headline, textMaxW);

    ctx.font = '11px monospace';
    const detail = isImported
      ? importedTrace!.detail
      : `forged t=${forged!.commitment}, c=${forged!.challenge}, z=${forged!.response}, valid=${String(forged!.valid)}`;
    const detailLines = wrapText(ctx, detail, textMaxW);

    const lineH = 16;
    const bannerH = 24 + headLines.length * lineH + 8 + detailLines.length * lineH;
    const bannerY = height - bannerH - 16;

    ctx.fillStyle = hexToRgba(accentColor, isDark ? 0.08 : 0.05);
    ctx.fillRect(56, bannerY, bannerMaxW, bannerH);
    ctx.strokeStyle = hexToRgba(accentColor, isDark ? 0.5 : 0.4);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(56, bannerY, bannerMaxW, bannerH);

    let ty = bannerY + 20;
    const headColor = isImported
      ? (importedTrace!.predictable ? (isDark ? '#fca5a5' : '#b91c1c') : (isDark ? '#86efac' : '#166534'))
      : (isDark ? '#fca5a5' : '#b91c1c');
    ctx.fillStyle = headColor;
    ctx.font = 'bold 12px monospace';
    for (const line of headLines) {
      ctx.fillText(line, 72, ty);
      ty += lineH;
    }
    ty += 8;
    ctx.font = '11px monospace';
    ctx.fillStyle = isDark ? '#a1a1aa' : '#52525b';
    for (const line of detailLines) {
      ctx.fillText(line, 72, ty);
      ty += lineH;
    }
  }
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
