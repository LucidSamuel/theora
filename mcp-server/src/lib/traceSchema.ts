// trace.json v1 — MCP mirror of the frozen contract in DESIGN-PROOF-TRACE.md.
// Reference implementation: src/demos/proof-trace/schema.ts. The pinned test
// vector in test/trace.test.mjs guards parity; never change one side alone.

import { createHash } from "node:crypto";
import { z } from "zod";

export const TRACE_HASH_PREFIX = "theora/proof-trace/v1";

export const TRANSCRIPT_EVENT_TYPES = ["absorb", "challenge", "commit", "fold", "query", "check"] as const;
export type TranscriptEventType = (typeof TRANSCRIPT_EVENT_TYPES)[number];

const decimalString = z.string().regex(/^\d+$/, "expected a decimal string");
const signedDecimalString = z.string().regex(/^-?\d+$/, "expected a decimal string");

const transcriptEventSchema = z
  .object({
    t: z.enum(TRANSCRIPT_EVENT_TYPES),
    round: z.number().int().min(0),
    label: z.string(),
    data: z.array(z.string()).optional(),
    ok: z.boolean().optional(),
  })

  .superRefine((event, ctx) => {
    if (event.ok !== undefined && event.t !== "check") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ok"], message: "only allowed on check events" });
    }
  });

const traceLinCombSchema = z.array(z.tuple([z.number().int(), signedDecimalString]));

const constraintSectionSchema = z
  .object({
    wires: z.array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        type: z.enum(["input", "public", "intermediate", "one"]),
      }),
    ),
    constraints: z.array(
      z.object({
        id: z.number().int(),
        a: traceLinCombSchema,
        b: traceLinCombSchema,
        c: traceLinCombSchema,
        label: z.string().optional(),
        satisfied: z.boolean().optional(),
      }),
    ),
    witness: z.record(decimalString, signedDecimalString).optional(),
  })

  .superRefine((section, ctx) => {
    const wireIds = new Set(section.wires.map((w) => w.id));
    section.constraints.forEach((constraint, i) => {
      (["a", "b", "c"] as const).forEach((part) => {
        constraint[part].forEach(([wireId], j) => {
          if (!wireIds.has(wireId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["constraints", i, part, j],
              message: `unknown wire id ${wireId}`,
            });
          }
        });
      });
    });
  });

export const proofTraceSchema = z
  .object({
    version: z.literal(1),
    meta: z
      .object({
        system: z.string().min(1),
        protocol: z.string().min(1),
        field: decimalString.refine((f) => BigInt(f) >= 2n, "field modulus must be >= 2"),
        label: z.string().optional(),
        createdAt: z.string().optional(),
      })
      ,
    transcript: z.array(transcriptEventSchema).min(1),
    constraints: constraintSectionSchema.optional(),
    rounds: z
      .array(
        z.object({
          round: z.number().int(),
          label: z.string().optional(),
          stats: z.record(z.string(), z.string()).optional(),
        }),
      )
      .optional(),
  });

export type ProofTrace = z.infer<typeof proofTraceSchema>;
export type TranscriptEvent = z.infer<typeof transcriptEventSchema>;

export interface TraceValidationError {
  path: string;
  message: string;
}

export function validateTrace(raw: unknown): { valid: boolean; trace?: ProofTrace; errors: TraceValidationError[] } {
  const result = proofTraceSchema.safeParse(raw);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
  return { valid: true, trace: result.data, errors: [] };
}

/** Drop empty data arrays and ok flags on non-check events (contract normalization). */
export function normalizeTranscript(transcript: TranscriptEvent[]): TranscriptEvent[] {
  return transcript.map((event) => {
    const out: TranscriptEvent = { t: event.t, round: event.round, label: event.label };
    if (event.data !== undefined && event.data.length > 0) out.data = [...event.data];
    if (event.t === "check" && event.ok !== undefined) out.ok = event.ok;
    return out;
  });
}

/** Canonical JSON: sorted object keys, arrays in order, no whitespace, undefined omitted. */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k])}`).join(",")}}`;
  }
  throw new Error(`canonicalStringify: unsupported value of type ${typeof value}`);
}

export function fingerprintPreimage(trace: ProofTrace): string {
  return `${TRACE_HASH_PREFIX}|${trace.meta.protocol}|${trace.meta.field}|${canonicalStringify(normalizeTranscript(trace.transcript))}`;
}

export function transcriptFingerprint(trace: ProofTrace): string {
  return createHash("sha256").update(fingerprintPreimage(trace), "utf8").digest("hex");
}
