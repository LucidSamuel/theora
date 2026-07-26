/**
 * Constraint editor pure logic: the DSL pipeline as one function, the
 * CircuitDocumentV1 serialization contract, and the proof-trace export.
 *
 * CircuitDocumentV1 is shared verbatim with the gist envelope, research
 * walkthrough deep links, and the MCP server's build_editor_url — do not
 * change its shape without updating all four consumers.
 */

import type {
  CheckResult,
  CompilationResult,
  ConstraintAnalysis,
  FailureTrace,
  ParseResult,
  WitnessResult,
} from '@/lib/dsl/types';
import { parse } from '@/lib/dsl/parser';
import { compile } from '@/lib/dsl/compiler';
import { analyzeConstraints } from '@/lib/dsl/analyzer';
import { evaluateWitnessFromAST } from '@/lib/dsl/witness';
import { checkConstraints } from '@/lib/dsl/checker';
import { traceFailure } from '@/lib/dsl/tracer';
import { computeLayout, type GraphLayout } from '@/lib/circuitGraph/layout';
import type { ProofTrace, TranscriptEvent } from '@/demos/proof-trace/schema';
import { fromDslConstraints, normalizeTrace } from '@/demos/proof-trace/schema';

export interface EditorPipeline {
  parseResult: ParseResult;
  compilation: CompilationResult | null;
  analysis: ConstraintAnalysis | null;
  layout: GraphLayout | null;
  witness: WitnessResult | null;
  checks: CheckResult | null;
  failureTrace: FailureTrace | null;
}

/**
 * Run the full DSL pipeline. Missing input values are auto-filled with 0.
 * Stages past the first failure are null.
 */
export function evaluateCircuit(source: string, fieldSize: bigint, inputs: Map<string, bigint>): EditorPipeline {
  const parseResult = parse(source);
  const empty: EditorPipeline = {
    parseResult,
    compilation: null,
    analysis: null,
    layout: null,
    witness: null,
    checks: null,
    failureTrace: null,
  };
  if (!parseResult.success) return empty;

  const compilation = compile(parseResult.ast, fieldSize);
  if (!compilation.success) return { ...empty, compilation };

  const analysis = analyzeConstraints(compilation);
  const layout = computeLayout(compilation);

  const filled = new Map(inputs);
  for (const wire of [...compilation.inputWires, ...compilation.publicWires]) {
    if (!filled.has(wire.name)) filled.set(wire.name, 0n);
  }

  const witness = evaluateWitnessFromAST(compilation, parseResult.ast, filled);
  if (!witness.success) return { ...empty, compilation, analysis, layout, witness };

  const checks = checkConstraints(compilation, witness);
  const failureTrace = checks.firstFailure
    ? traceFailure(compilation, witness, checks, checks.firstFailure)
    : null;

  return { parseResult, compilation, analysis, layout, witness, checks, failureTrace };
}

/** Collect input values actually used by the circuit (for URL/doc serialization). */
export function relevantInputs(compilation: CompilationResult | null, inputs: Map<string, bigint>): Map<string, bigint> {
  if (!compilation) return new Map(inputs);
  const out = new Map<string, bigint>();
  for (const wire of [...compilation.inputWires, ...compilation.publicWires]) {
    out.set(wire.name, inputs.get(wire.name) ?? 0n);
  }
  return out;
}

/* ── CircuitDocumentV1 ──────────────────────────────────────── */

export interface CircuitDocumentV1 {
  v: 1;
  source: string;
  field: string;
  inputs: Record<string, string>;
  presetId?: string;
  view?: {
    selectedWire?: number | null;
    selectedConstraint?: number | null;
  };
}

export interface EditorDocumentState {
  source: string;
  fieldSize: bigint;
  inputs: Map<string, bigint>;
  presetId: string;
  selectedWire: number | null;
  selectedConstraint: number | null;
}

export function serializeDocument(state: EditorDocumentState): CircuitDocumentV1 {
  const doc: CircuitDocumentV1 = {
    v: 1,
    source: state.source,
    field: state.fieldSize.toString(),
    inputs: Object.fromEntries([...state.inputs.entries()].map(([k, v]) => [k, v.toString()])),
  };
  if (state.presetId !== 'custom') doc.presetId = state.presetId;
  if (state.selectedWire !== null || state.selectedConstraint !== null) {
    doc.view = { selectedWire: state.selectedWire, selectedConstraint: state.selectedConstraint };
  }
  return doc;
}

const MIN_FIELD = 2n;
const MAX_FIELD = 9999n;

export function deserializeDocument(raw: unknown): Partial<EditorDocumentState> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const doc = raw as Record<string, unknown>;
  if (doc.v !== 1 || typeof doc.source !== 'string') return null;

  let fieldSize = 101n;
  if (typeof doc.field === 'string' && /^\d+$/.test(doc.field)) {
    try {
      const f = BigInt(doc.field);
      if (f >= MIN_FIELD && f <= MAX_FIELD) fieldSize = f;
    } catch {
      /* keep default */
    }
  }

  const inputs = new Map<string, bigint>();
  if (typeof doc.inputs === 'object' && doc.inputs !== null && !Array.isArray(doc.inputs)) {
    for (const [name, value] of Object.entries(doc.inputs as Record<string, unknown>)) {
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      try {
        inputs.set(name, BigInt(value));
      } catch {
        /* skip malformed value */
      }
    }
  }

  const view = (typeof doc.view === 'object' && doc.view !== null ? doc.view : {}) as Record<string, unknown>;
  const selectedWire = typeof view.selectedWire === 'number' ? view.selectedWire : null;
  const selectedConstraint = typeof view.selectedConstraint === 'number' ? view.selectedConstraint : null;

  return {
    source: doc.source,
    fieldSize,
    inputs,
    presetId: typeof doc.presetId === 'string' ? doc.presetId : 'custom',
    selectedWire,
    selectedConstraint,
  };
}

/* ── proof-trace export ─────────────────────────────────────── */

export interface EditorAuditExport {
  demo: 'constraint-editor';
  analysis: {
    unconstrainedWires: string[];
    weakInputWires: string[];
    degreesOfFreedom: number;
    constraintCount: number;
    wireCount: number;
    allSatisfied: boolean | null;
  } | null;
  trace: ProofTrace | null;
}

/**
 * Emit the current circuit run as a proof trace (loadable by the
 * proof-trace demo) plus an analysis summary.
 */
export function exportTrace(pipeline: EditorPipeline, fieldSize: bigint): EditorAuditExport {
  const { compilation, analysis, witness, checks } = pipeline;
  const analysisOut = analysis
    ? {
        unconstrainedWires: analysis.unconstrainedWires.map((w) => w.name),
        weakInputWires: analysis.weakInputWires.map((w) => w.name),
        degreesOfFreedom: analysis.degreesOfFreedom,
        constraintCount: analysis.constraintCount,
        wireCount: analysis.wireCount,
        allSatisfied: checks?.allSatisfied ?? null,
      }
    : null;

  if (!compilation?.success) {
    return { demo: 'constraint-editor', analysis: analysisOut, trace: null };
  }

  const transcript: TranscriptEvent[] = [
    {
      t: 'absorb',
      round: 0,
      label: 'public inputs',
      data: compilation.publicWires.map((w) => (witness?.values.get(w.id) ?? 0n).toString()),
    },
  ];
  if (checks) {
    for (const check of checks.checks) {
      transcript.push({ t: 'check', round: 1, label: check.sourceExpr, ok: check.satisfied });
    }
  } else {
    for (const constraint of compilation.constraints) {
      transcript.push({ t: 'check', round: 1, label: constraint.sourceExpr });
    }
  }

  const trace = normalizeTrace({
    version: 1,
    meta: { system: 'theora', protocol: 'r1cs', field: fieldSize.toString(), label: 'Constraint editor circuit' },
    transcript,
    constraints: fromDslConstraints(compilation, checks ?? undefined, witness ?? undefined),
  });

  return { demo: 'constraint-editor', analysis: analysisOut, trace };
}
