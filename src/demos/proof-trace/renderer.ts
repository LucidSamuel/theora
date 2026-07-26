import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { drawGrid, drawRoundedRect, hexToRgba } from '@/lib/canvas';
import type { CenterGlyph, FingerprintSpec } from './logic';
import { CENTER_RADIUS, FINGERPRINT_PADDING } from './logic';
import { FINGERPRINT_VERSION } from './schema';

/* ── Public render state ─────────────────────────────────────────────── */

export interface ProofTraceRenderState {
  spec: FingerprintSpec | null;
  traceLabel: string;
  protocol: string;
  field: string;
  loading: boolean;
  error: string | null;
}

/* ── Palette ─────────────────────────────────────────────────────────── */

const ZINC_700 = '#27272a';
const ZINC_600 = '#3f3f46';
const ZINC_300 = '#a1a1aa';
const COLOR_SUCCESS = '#22c55e';
const COLOR_ERROR = '#ef4444';
export const ACCENT = '#d946ef';

/* ── Hue rotation ────────────────────────────────────────────────────── */

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Rotate a hex color's hue by `deg` degrees, returning an hsl() string. */
export function hueRotate(hex: string, deg: number): string {
  const [h, s, l] = hexToHsl(hex);
  const hue = ((h + deg) % 360 + 360) % 360;
  return `hsl(${hue.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%)`;
}

function hslWithAlpha(hslColor: string, alpha: number): string {
  return hslColor.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
}

/* ── Center medallion ────────────────────────────────────────────────── */

function drawCenterMedallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  variant: CenterGlyph,
  accent: string,
  isDark: boolean,
): void {
  const base = isDark ? ZINC_600 : ZINC_300;
  ctx.strokeStyle = hexToRgba(base, 0.5);
  ctx.lineWidth = 1.5;

  switch (variant) {
    case 'ring': {
      ctx.beginPath();
      ctx.arc(cx, cy, CENTER_RADIUS * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hslWithAlpha(accent, 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, CENTER_RADIUS * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'dot-matrix': {
      ctx.fillStyle = hslWithAlpha(accent, 0.6);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.arc(cx + i * 16, cy + j * 16, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'cross-hatch': {
      ctx.strokeStyle = hslWithAlpha(accent, 0.5);
      const r = CENTER_RADIUS * 0.55;
      for (let i = -2; i <= 2; i++) {
        const offset = i * 12;
        ctx.beginPath();
        ctx.moveTo(cx - r + Math.abs(offset) / 2, cy + offset);
        ctx.lineTo(cx + r - Math.abs(offset) / 2, cy + offset);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + offset, cy - r + Math.abs(offset) / 2);
        ctx.lineTo(cx + offset, cy + r - Math.abs(offset) / 2);
        ctx.stroke();
      }
      break;
    }
    case 'concentric': {
      for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = i % 2 === 0 ? hexToRgba(base, 0.5) : hslWithAlpha(accent, 0.6);
        ctx.beginPath();
        ctx.arc(cx, cy, (CENTER_RADIUS * 0.65 * i) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
  }
}

/* ── Glyphs ──────────────────────────────────────────────────────────── */

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  eventType: FingerprintSpec['glyphs'][number]['eventType'],
  ok: boolean | undefined,
  hueShiftDeg: number,
  isDark: boolean,
): void {
  ctx.lineWidth = 1.5 * size;
  switch (eventType) {
    case 'absorb': {
      ctx.fillStyle = hslWithAlpha(hueRotate(ACCENT, hueShiftDeg), 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 6 * size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'challenge': {
      ctx.strokeStyle = hslWithAlpha(hueRotate(ACCENT, hueShiftDeg + 30), 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 7 * size, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'commit': {
      ctx.fillStyle = hexToRgba(isDark ? '#fafafa' : '#09090b', 0.8);
      const s = 12 * size;
      drawRoundedRect(ctx, x - s / 2, y - s / 2, s, s, 2);
      ctx.fill();
      break;
    }
    case 'fold': {
      ctx.strokeStyle = hslWithAlpha(hueRotate(ACCENT, hueShiftDeg - 30), 0.9);
      const r = 8 * size;
      const inward = angle + Math.PI;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(inward - 0.5) * r, y + Math.sin(inward - 0.5) * r);
      ctx.lineTo(x, y);
      ctx.lineTo(x + Math.cos(inward + 0.5) * r, y + Math.sin(inward + 0.5) * r);
      ctx.stroke();
      break;
    }
    case 'query': {
      ctx.strokeStyle = hexToRgba(isDark ? ZINC_300 : ZINC_600, 0.9);
      const r = 5 * size;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
      ctx.lineTo(x - Math.cos(angle) * r, y - Math.sin(angle) * r);
      ctx.stroke();
      break;
    }
    case 'check': {
      const color = ok === false ? COLOR_ERROR : COLOR_SUCCESS;
      if (ok === false) {
        ctx.fillStyle = hexToRgba(COLOR_ERROR, 0.2);
        ctx.beginPath();
        ctx.arc(x, y, 9 * size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hexToRgba(color, 0.95);
      ctx.beginPath();
      ctx.arc(x, y, 4 * size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderFingerprint(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: ProofTraceRenderState,
  theme: 'dark' | 'light',
): void {
  const { width, height } = frame;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const isDark = theme === 'dark';

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, isDark ? '#09090b' : '#ffffff');
  bg.addColorStop(1, isDark ? '#111113' : '#fafafa');
  ctx.fillStyle = bg;
  ctx.fillRect(-50000, -50000, 100000, 100000);

  drawGrid(ctx, width, height, 40, isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)');

  const { spec } = state;
  const cx = width / 2;
  const cy = height / 2;

  if (spec) {
    const accent = hueRotate(ACCENT, spec.hueShiftDeg);

    // Rings
    for (const ring of spec.rings) {
      ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Connector arcs, bent toward the center by curvature
    ctx.lineWidth = 1;
    for (const arc of spec.arcs) {
      const midX = (arc.fromX + arc.toX) / 2;
      const midY = (arc.fromY + arc.toY) / 2;
      const ctrlX = cx + midX * (1 - arc.curvature);
      const ctrlY = cy + midY * (1 - arc.curvature);
      ctx.strokeStyle = hslWithAlpha(accent, 0.12);
      ctx.beginPath();
      ctx.moveTo(cx + arc.fromX, cy + arc.fromY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, cx + arc.toX, cy + arc.toY);
      ctx.stroke();
    }

    drawCenterMedallion(ctx, cx, cy, spec.centerGlyph, accent, isDark);

    for (const glyph of spec.glyphs) {
      drawGlyph(ctx, cx + glyph.x, cy + glyph.y, glyph.angle, glyph.size, glyph.eventType, glyph.ok, spec.hueShiftDeg, isDark);
    }
  }

  // ── Screen-space overlays ─────────────────────────────────────────
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const headerText = state.loading
    ? 'Loading trace…'
    : state.error
      ? state.error
      : `${state.traceLabel} — ${state.protocol}, GF(${state.field})`;
  ctx.font = '11px monospace';
  const maxBadgeW = Math.max(1, width - 24);
  const headerW = Math.min(ctx.measureText(headerText).width + 40, maxBadgeW);
  const headerX = width / 2 - headerW / 2;
  ctx.fillStyle = hexToRgba(isDark ? ZINC_700 : '#e4e4e7', isDark ? 0.85 : 0.9);
  drawRoundedRect(ctx, headerX, 16, headerW, 30, 8);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(isDark ? ZINC_600 : ZINC_300, 0.5);
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, headerX, 16, headerW, 30, 8);
  ctx.stroke();
  ctx.fillStyle = state.error ? COLOR_ERROR : isDark ? '#e4e4e7' : '#27272a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headerText, width / 2, 31, maxBadgeW - 16);

  if (spec) {
    ctx.fillStyle = hexToRgba(isDark ? ZINC_300 : ZINC_600, 0.7);
    ctx.font = '10px monospace';
    ctx.fillText(
      `fingerprint v${FINGERPRINT_VERSION} · ${spec.hashHex.slice(0, 16)}…`,
      width / 2,
      height - 16,
    );
  }

  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export { FINGERPRINT_PADDING };
