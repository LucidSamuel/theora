/**
 * Proof-trace pure logic: transcript hashing and the fingerprint spec.
 *
 * `buildFingerprintSpec` is deterministic: (hashHex, trace) -> spec.
 * The PRNG consumption order is part of FINGERPRINT_VERSION 1 and is
 * documented in DESIGN-PROOF-TRACE.md — do not reorder draws.
 */

import { sha256 } from '@/lib/hash';
import { makeRng } from '@/lib/prng';
import type { ProofTrace, TranscriptEvent, TranscriptEventType } from './schema';
import { fingerprintPreimage } from './schema';

export async function transcriptHash(trace: ProofTrace): Promise<string> {
  return sha256(fingerprintPreimage(trace));
}

export interface RoundGroup {
  round: number;
  events: TranscriptEvent[];
}

export function groupEventsByRound(trace: ProofTrace): RoundGroup[] {
  const byRound = new Map<number, TranscriptEvent[]>();
  for (const event of trace.transcript) {
    const group = byRound.get(event.round);
    if (group) {
      group.push(event);
    } else {
      byRound.set(event.round, [event]);
    }
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, events]) => ({ round, events }));
}

/* ── fingerprint spec ───────────────────────────────────────── */

export const CENTER_RADIUS = 48;
export const RING_WIDTH = 48;
export const FIRST_RING_RADIUS = 96;
export const MAX_RINGS = 8;
export const FINGERPRINT_PADDING = 32;

export type CenterGlyph = 'ring' | 'dot-matrix' | 'cross-hatch' | 'concentric';

export interface FingerprintGlyph {
  eventType: TranscriptEventType;
  ok?: boolean;
  x: number;
  y: number;
  angle: number;      // radians, for oriented glyphs (fold chevrons, ticks)
  size: number;       // 1 = normal, <1 for wrapped outer rings
  ringIndex: number;
  eventIndex: number; // index into trace.transcript
  label: string;
}

export interface FingerprintArc {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curvature: number;  // [0,1) bend factor toward the center
}

export interface FingerprintRing {
  radius: number;
  round: number;
}

export interface FingerprintSpec {
  hashHex: string;
  centerGlyph: CenterGlyph;
  hueShiftDeg: number;   // [-18, +18]
  baseRotation: number;  // radians
  rings: FingerprintRing[];
  glyphs: FingerprintGlyph[];
  arcs: FingerprintArc[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const CENTER_GLYPHS: readonly CenterGlyph[] = ['ring', 'dot-matrix', 'cross-hatch', 'concentric'];

export function buildFingerprintSpec(hashHex: string, trace: ProofTrace): FingerprintSpec {
  const rng = makeRng(hashHex);

  // PRNG draws 1-3: global parameters (fixed order — see design doc).
  const baseRotation = rng.nextFloat() * Math.PI * 2;
  const hueShiftDeg = (rng.nextFloat() * 2 - 1) * 18;
  const centerGlyph = CENTER_GLYPHS[rng.nextInt(0, 3)]!;

  const groups = groupEventsByRound(trace);
  const ringCount = Math.min(groups.length, MAX_RINGS);

  // PRNG draw block 4: per-ring jitter + phase, in round order.
  const rings: FingerprintRing[] = [];
  const ringPhases: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const ringIndex = Math.min(i, MAX_RINGS - 1);
    const radiusJitter = (rng.nextFloat() * 2 - 1) * 3;
    const ringPhase = rng.nextFloat() * Math.PI * 2;
    ringPhases.push(ringPhase);
    if (i < MAX_RINGS) {
      rings.push({ radius: FIRST_RING_RADIUS + ringIndex * RING_WIDTH + radiusJitter, round: groups[i]!.round });
    }
  }

  // PRNG draw block 5: per-event jitter + arc curvature, in transcript order.
  const glyphs: FingerprintGlyph[] = [];
  const arcs: FingerprintArc[] = [];
  let eventIndex = 0;
  groups.forEach((group, groupIdx) => {
    const ringIndex = Math.min(groupIdx, MAX_RINGS - 1);
    const ring = rings[ringIndex]!;
    const wrapped = groupIdx >= MAX_RINGS;
    const phase = ringPhases[groupIdx]!;
    group.events.forEach((event, i) => {
      const glyphJitter = (rng.nextFloat() * 2 - 1) * 2;
      const curvature = rng.nextFloat() * 0.6;
      const angle = baseRotation + phase + (i / group.events.length) * Math.PI * 2;
      const radius = ring.radius + glyphJitter;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const glyph: FingerprintGlyph = {
        eventType: event.t,
        ...(event.t === 'check' && event.ok !== undefined ? { ok: event.ok } : {}),
        x,
        y,
        angle,
        size: wrapped ? 0.6 : 1,
        ringIndex,
        eventIndex,
        label: event.label,
      };
      const prev = glyphs[glyphs.length - 1];
      if (prev) {
        arcs.push({ fromX: prev.x, fromY: prev.y, toX: x, toY: y, curvature });
      }
      glyphs.push(glyph);
      eventIndex += 1;
    });
  });

  const outerRadius =
    ringCount > 0 ? FIRST_RING_RADIUS + (ringCount - 1) * RING_WIDTH + FINGERPRINT_PADDING : CENTER_RADIUS + FINGERPRINT_PADDING;

  return {
    hashHex,
    centerGlyph,
    hueShiftDeg,
    baseRotation,
    rings,
    glyphs,
    arcs,
    bounds: { minX: -outerRadius, minY: -outerRadius, maxX: outerRadius, maxY: outerRadius },
  };
}
