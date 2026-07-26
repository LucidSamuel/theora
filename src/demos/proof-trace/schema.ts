/**
 * trace.json schema v1 — types, validation, normalization, canonical
 * serialization, and the bridge to the constraint DSL.
 *
 * The canonicalization + hash rules here are a frozen contract shared
 * with the MCP server (see DESIGN-PROOF-TRACE.md). Do not change them
 * without bumping the version prefix and the pinned test vectors.
 */

import type { CheckResult, CompilationResult, WitnessResult } from '@/lib/dsl/types';

export const TRACE_VERSION = 1;
export const TRACE_HASH_PREFIX = 'theora/proof-trace/v1';
export const FINGERPRINT_VERSION = 1;
export const MAX_TRACE_FILE_BYTES = 2 * 1024 * 1024;

export const TRANSCRIPT_EVENT_TYPES = ['absorb', 'challenge', 'commit', 'fold', 'query', 'check'] as const;
export type TranscriptEventType = (typeof TRANSCRIPT_EVENT_TYPES)[number];

export interface TranscriptEvent {
  t: TranscriptEventType;
  round: number;
  label: string;
  data?: string[];
  ok?: boolean;
}

export interface RoundMeta {
  round: number;
  label?: string;
  stats?: Record<string, string>;
}

export type TraceLinComb = [wireId: number, coeff: string][];

export interface TraceWire {
  id: number;
  name: string;
  type: 'input' | 'public' | 'intermediate' | 'one';
}

export interface TraceConstraint {
  id: number;
  a: TraceLinComb;
  b: TraceLinComb;
  c: TraceLinComb;
  label?: string;
  satisfied?: boolean;
}

export interface ConstraintSection {
  wires: TraceWire[];
  constraints: TraceConstraint[];
  witness?: Record<string, string>;
}

export interface TraceMeta {
  system: string;
  protocol: string;
  field: string;
  label?: string;
  createdAt?: string;
}

export interface ProofTrace {
  version: 1;
  meta: TraceMeta;
  transcript: TranscriptEvent[];
  constraints?: ConstraintSection;
  rounds?: RoundMeta[];
}

export interface TraceValidation {
  ok: boolean;
  trace?: ProofTrace;
  errors: string[];
}

/* ── validation ─────────────────────────────────────────────── */

const WIRE_TYPES = new Set(['input', 'public', 'intermediate', 'one']);
const DECIMAL_RE = /^\d+$/;
const SIGNED_DECIMAL_RE = /^-?\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function validateLinComb(value: unknown, path: string, wireIds: Set<number>, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected an array of [wireId, coeff] pairs`);
    return;
  }
  value.forEach((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2 || !isInteger(pair[0]) || typeof pair[1] !== 'string' || !SIGNED_DECIMAL_RE.test(pair[1])) {
      errors.push(`${path}[${i}]: expected [integer wireId, decimal-string coeff]`);
      return;
    }
    if (!wireIds.has(pair[0])) {
      errors.push(`${path}[${i}]: unknown wire id ${pair[0]}`);
    }
  });
}

function validateConstraintSection(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('constraints: expected an object');
    return;
  }
  if (!Array.isArray(value.wires)) {
    errors.push('constraints.wires: expected an array');
    return;
  }
  const wireIds = new Set<number>();
  value.wires.forEach((wire, i) => {
    if (!isRecord(wire) || !isInteger(wire.id) || typeof wire.name !== 'string' || !WIRE_TYPES.has(wire.type as string)) {
      errors.push(`constraints.wires[${i}]: expected { id: integer, name: string, type: input|public|intermediate|one }`);
      return;
    }
    wireIds.add(wire.id);
  });
  if (!Array.isArray(value.constraints)) {
    errors.push('constraints.constraints: expected an array');
    return;
  }
  value.constraints.forEach((c, i) => {
    if (!isRecord(c) || !isInteger(c.id)) {
      errors.push(`constraints.constraints[${i}]: expected an object with integer id`);
      return;
    }
    validateLinComb(c.a, `constraints.constraints[${i}].a`, wireIds, errors);
    validateLinComb(c.b, `constraints.constraints[${i}].b`, wireIds, errors);
    validateLinComb(c.c, `constraints.constraints[${i}].c`, wireIds, errors);
    if (c.label !== undefined && typeof c.label !== 'string') {
      errors.push(`constraints.constraints[${i}].label: expected a string`);
    }
    if (c.satisfied !== undefined && typeof c.satisfied !== 'boolean') {
      errors.push(`constraints.constraints[${i}].satisfied: expected a boolean`);
    }
  });
  if (value.witness !== undefined) {
    if (!isRecord(value.witness)) {
      errors.push('constraints.witness: expected an object of wireId -> decimal value');
    } else {
      for (const [key, val] of Object.entries(value.witness)) {
        if (!DECIMAL_RE.test(key) || typeof val !== 'string' || !SIGNED_DECIMAL_RE.test(val)) {
          errors.push(`constraints.witness["${key}"]: expected decimal-string key and value`);
        }
      }
    }
  }
}

/** Validate an unknown value as a ProofTrace. Returns a normalized copy on success. */
export function validateProofTrace(raw: unknown): TraceValidation {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ['expected a JSON object'] };
  }
  if (raw.version !== TRACE_VERSION) {
    errors.push(`version: expected the literal ${TRACE_VERSION}`);
  }
  if (!isRecord(raw.meta)) {
    errors.push('meta: expected an object');
  } else {
    if (typeof raw.meta.system !== 'string' || raw.meta.system.length === 0) errors.push('meta.system: expected a non-empty string');
    if (typeof raw.meta.protocol !== 'string' || raw.meta.protocol.length === 0) errors.push('meta.protocol: expected a non-empty string');
    if (typeof raw.meta.field !== 'string' || !DECIMAL_RE.test(raw.meta.field) || BigInt(raw.meta.field) < 2n) {
      errors.push('meta.field: expected a decimal modulus >= 2');
    }
    if (raw.meta.label !== undefined && typeof raw.meta.label !== 'string') errors.push('meta.label: expected a string');
    if (raw.meta.createdAt !== undefined && typeof raw.meta.createdAt !== 'string') errors.push('meta.createdAt: expected a string');
  }
  if (!Array.isArray(raw.transcript) || raw.transcript.length === 0) {
    errors.push('transcript: expected a non-empty array');
  } else {
    raw.transcript.forEach((event, i) => {
      if (!isRecord(event)) {
        errors.push(`transcript[${i}]: expected an object`);
        return;
      }
      if (!TRANSCRIPT_EVENT_TYPES.includes(event.t as TranscriptEventType)) {
        errors.push(`transcript[${i}].t: expected one of ${TRANSCRIPT_EVENT_TYPES.join('|')}`);
      }
      if (!isInteger(event.round) || (event.round as number) < 0) {
        errors.push(`transcript[${i}].round: expected an integer >= 0`);
      }
      if (typeof event.label !== 'string') {
        errors.push(`transcript[${i}].label: expected a string`);
      }
      if (event.data !== undefined && (!Array.isArray(event.data) || event.data.some((d) => typeof d !== 'string'))) {
        errors.push(`transcript[${i}].data: expected an array of strings`);
      }
      if (event.ok !== undefined && event.t !== 'check') {
        errors.push(`transcript[${i}].ok: only allowed on check events`);
      }
      if (event.ok !== undefined && typeof event.ok !== 'boolean') {
        errors.push(`transcript[${i}].ok: expected a boolean`);
      }
    });
  }
  if (raw.constraints !== undefined) {
    validateConstraintSection(raw.constraints, errors);
  }
  if (raw.rounds !== undefined) {
    if (!Array.isArray(raw.rounds)) {
      errors.push('rounds: expected an array');
    } else {
      raw.rounds.forEach((r, i) => {
        if (!isRecord(r) || !isInteger(r.round)) {
          errors.push(`rounds[${i}]: expected an object with integer round`);
        }
      });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, trace: normalizeTrace(raw as unknown as ProofTrace), errors: [] };
}

/* ── normalization + canonicalization ───────────────────────── */

/** Normalize a (structurally valid) trace: drop empty data arrays and stray ok flags. */
export function normalizeTrace(trace: ProofTrace): ProofTrace {
  return {
    version: TRACE_VERSION,
    meta: { ...trace.meta },
    transcript: trace.transcript.map((event) => {
      const out: TranscriptEvent = { t: event.t, round: event.round, label: event.label };
      if (event.data !== undefined && event.data.length > 0) out.data = [...event.data];
      if (event.t === 'check' && event.ok !== undefined) out.ok = event.ok;
      return out;
    }),
    ...(trace.constraints !== undefined ? { constraints: trace.constraints } : {}),
    ...(trace.rounds !== undefined ? { rounds: trace.rounds } : {}),
  };
}

/**
 * Canonical JSON: object keys sorted lexicographically, arrays in order,
 * no whitespace, absent keys omitted. Part of the fingerprint contract.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(',')}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(',')}}`;
  }
  throw new Error(`canonicalStringify: unsupported value of type ${typeof value}`);
}

/** The exact preimage hashed for the fingerprint. Exposed for tests and the MCP mirror. */
export function fingerprintPreimage(trace: ProofTrace): string {
  const normalized = normalizeTrace(trace);
  return `${TRACE_HASH_PREFIX}|${normalized.meta.protocol}|${normalized.meta.field}|${canonicalStringify(normalized.transcript)}`;
}

/* ── DSL bridge ─────────────────────────────────────────────── */

function toTraceLinComb(lc: Map<number, bigint>): TraceLinComb {
  return [...lc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([wireId, coeff]) => [wireId, coeff.toString()] as [number, string]);
}

export function toDslLinComb(lc: TraceLinComb): Map<number, bigint> {
  const map = new Map<number, bigint>();
  for (const [wireId, coeff] of lc) {
    map.set(wireId, BigInt(coeff));
  }
  return map;
}

/**
 * Convert a DSL compilation (plus optional check/witness results) into the
 * trace constraint section. This is the editor -> proof-trace export bridge.
 */
export function fromDslConstraints(
  compilation: CompilationResult,
  check?: CheckResult,
  witness?: WitnessResult,
): ConstraintSection {
  const satisfiedById = new Map<number, boolean>();
  if (check) {
    for (const result of check.checks) {
      satisfiedById.set(result.constraintId, result.satisfied);
    }
  }
  const section: ConstraintSection = {
    wires: compilation.wires.map((wire) => ({ id: wire.id, name: wire.name, type: wire.type })),
    constraints: compilation.constraints.map((constraint) => ({
      id: constraint.id,
      a: toTraceLinComb(constraint.a),
      b: toTraceLinComb(constraint.b),
      c: toTraceLinComb(constraint.c),
      label: constraint.sourceExpr,
      ...(satisfiedById.has(constraint.id) ? { satisfied: satisfiedById.get(constraint.id) } : {}),
    })),
  };
  if (witness?.success) {
    const witnessOut: Record<string, string> = {};
    for (const [wireId, value] of witness.values.entries()) {
      witnessOut[String(wireId)] = value.toString();
    }
    section.witness = witnessOut;
  }
  return section;
}
