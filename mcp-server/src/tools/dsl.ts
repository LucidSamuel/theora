import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parse } from "../lib/dsl/parser.js";
import { compile, exprToString } from "../lib/dsl/compiler.js";
import { evaluateWitnessFromAST } from "../lib/dsl/witness.js";
import { checkConstraints } from "../lib/dsl/checker.js";
import { analyzeConstraints } from "../lib/dsl/analyzer.js";
import { exhaustiveCheck } from "../lib/dsl/exhaustive.js";
import type { CompilationResult, ParseResult } from "../lib/dsl/types.js";
import { linCombToObject, witnessToObject, toJson } from "../lib/serialize.js";
import { buildEditorUrl } from "../lib/appUrl.js";

const sourceSchema = z.string().min(1).describe("Circuit source in the theora constraint DSL (input/public/wire/assert statements, arithmetic mod p)");
const fieldSchema = z.string().regex(/^\d+$/).optional().describe("Prime field modulus as a decimal string. Default 101.");
const inputsSchema = z.record(z.string().regex(/^-?\d+$/)).describe("Wire name -> decimal value for every input/public wire");

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: toJson(payload) }] };
}

function fail(payload: unknown) {
  return ok(payload);
}

function parseErrors(parsed: ParseResult) {
  return parsed.errors.map((e) => ({ line: e.line, column: e.column, message: e.message, hint: e.hint }));
}

function compileSource(source: string, field?: string): { compilation?: CompilationResult; parsed?: ParseResult; error?: object } {
  const parsed = parse(source);
  if (!parsed.success) {
    return { error: { success: false, stage: "parse", errors: parseErrors(parsed) } };
  }
  const fieldSize = BigInt(field || "101");
  if (fieldSize < 2n) {
    return { error: { success: false, stage: "compile", errors: [{ message: "field must be >= 2" }] } };
  }
  const compilation = compile(parsed.ast, fieldSize);
  if (!compilation.success) {
    return { error: { success: false, stage: "compile", errors: compilation.errors }, parsed };
  }
  return { compilation, parsed };
}

function serializeConstraints(compilation: CompilationResult) {
  return compilation.constraints.map((c) => ({
    id: c.id,
    a: linCombToObject(c.a),
    b: linCombToObject(c.b),
    c: linCombToObject(c.c),
    sourceExpr: c.sourceExpr,
    sourceLine: c.sourceLine,
    constraintType: c.constraintType,
  }));
}

function parseInputs(inputs: Record<string, string>): Map<string, bigint> {
  return new Map(Object.entries(inputs).map(([name, value]) => [name, BigInt(value)]));
}

export function registerDslTools(server: McpServer) {
  server.tool(
    "dsl_parse",
    "Parse theora constraint-DSL source into an AST. Returns statement summaries or parse errors with line/column and did-you-mean hints.",
    { source: sourceSchema },
    async ({ source }) => {
      try {
        const parsed = parse(source);
        if (!parsed.success) {
          return fail({ success: false, errors: parseErrors(parsed) });
        }
        return ok({
          success: true,
          statements: parsed.ast
            .filter((node) => node.type !== "comment")
            .map((node) => {
              switch (node.type) {
                case "input":
                case "public":
                  return { type: node.type, name: node.name, line: node.line };
                case "wire":
                  return { type: "wire", name: node.name, expr: exprToString(node.expr), line: node.line };
                case "assert":
                  return { type: "assert", left: exprToString(node.left), right: exprToString(node.right), line: node.line };
              }
            }),
        });
      } catch (e) {
        return fail({ error: String(e) });
      }
    },
  );

  server.tool(
    "dsl_compile",
    "Compile theora constraint-DSL source to an R1CS constraint system (wires + A*B=C constraints over a prime field).",
    { source: sourceSchema, field: fieldSchema },
    async ({ source, field }) => {
      try {
        const { compilation, error } = compileSource(source, field);
        if (!compilation) return fail(error);
        return ok({
          success: true,
          fieldSize: compilation.fieldSize.toString(),
          wires: compilation.wires.map((w) => ({ id: w.id, name: w.name, type: w.type })),
          constraints: serializeConstraints(compilation),
          wireCount: compilation.wires.length,
          constraintCount: compilation.constraints.length,
        });
      } catch (e) {
        return fail({ error: String(e) });
      }
    },
  );

  server.tool(
    "dsl_analyze",
    "Analyze a constraint-DSL circuit for soundness bugs: unconstrained wires, inputs that never reach a multiplication, and degrees of freedom. Returns a verdict plus a live editor URL.",
    { source: sourceSchema, field: fieldSchema },
    async ({ source, field }) => {
      try {
        const { compilation, error } = compileSource(source, field);
        if (!compilation) return fail(error);
        const analysis = analyzeConstraints(compilation);
        const problems: string[] = [];
        for (const wire of analysis.unconstrainedWires) {
          problems.push(`UNDERCONSTRAINED: wire '${wire.name}' is never bound by a defining constraint — a prover can set it to anything.`);
        }
        for (const wire of analysis.weakInputWires) {
          problems.push(`WEAK INPUT: '${wire.name}' never reaches a multiplication constraint; its value is only weakly constrained.`);
        }
        if (analysis.degreesOfFreedom > 0) {
          problems.push(`DEGREES OF FREEDOM: ${analysis.degreesOfFreedom} unconstrained dimension(s) in the witness space.`);
        }
        const verdict = problems.length === 0
          ? "SOUND-LOOKING: every wire is bound by a constraint and no free witness dimensions were found. (Structural analysis only — run dsl_exhaustive for a semantic check.)"
          : problems.join(" ");
        return ok({
          success: true,
          verdict,
          analysis: {
            unconstrainedWires: analysis.unconstrainedWires.map((w) => w.name),
            weakInputWires: analysis.weakInputWires.map((w) => w.name),
            overconstrainedWires: analysis.overconstrainedWires.map((w) => w.name),
            constraintCount: analysis.constraintCount,
            wireCount: analysis.wireCount,
            inputCount: analysis.inputCount,
            publicCount: analysis.publicCount,
            degreesOfFreedom: analysis.degreesOfFreedom,
          },
          editorUrl: buildEditorUrl({ source, field }),
        });
      } catch (e) {
        return fail({ error: String(e) });
      }
    },
  );

  server.tool(
    "dsl_witness_check",
    "Evaluate a witness for a constraint-DSL circuit and check every R1CS constraint. Returns per-constraint results, failure details, and a live editor URL.",
    { source: sourceSchema, inputs: inputsSchema, field: fieldSchema },
    async ({ source, inputs, field }) => {
      try {
        const { compilation, parsed, error } = compileSource(source, field);
        if (!compilation || !parsed) return fail(error);
        const witness = evaluateWitnessFromAST(compilation, parsed.ast, parseInputs(inputs));
        if (!witness.success) {
          return fail({ success: false, stage: "witness", errors: witness.errors.map((e) => ({ wire: e.wireName, message: e.message })) });
        }
        const check = checkConstraints(compilation, witness);
        return ok({
          success: true,
          allSatisfied: check.allSatisfied,
          witness: witnessToObject(witness.values),
          checks: check.checks.map((c) => ({
            constraintId: c.constraintId,
            sourceExpr: c.sourceExpr,
            satisfied: c.satisfied,
            aValue: c.a_value.toString(),
            bValue: c.b_value.toString(),
            cValue: c.c_value.toString(),
            abProduct: c.ab_product.toString(),
            ...(c.mismatch
              ? { mismatch: { expected: c.mismatch.expected.toString(), actual: c.mismatch.actual.toString() } }
              : {}),
          })),
          failedConstraints: check.failedConstraints.map((c) => c.sourceExpr),
          editorUrl: buildEditorUrl({ source, inputs, field }),
        });
      } catch (e) {
        return fail({ error: String(e) });
      }
    },
  );

  server.tool(
    "dsl_exhaustive",
    "Exhaustively enumerate every input assignment for a constraint-DSL circuit over its field, hunting for counterexamples (assignments that satisfy all constraints but disagree with the honest computation) and non-determinism. Refuses when the search space exceeds maxCombinations.",
    {
      source: sourceSchema,
      field: fieldSchema,
      maxCombinations: z.number().int().min(1).max(1_000_000).default(100_000).describe("Refuse if fieldSize^numInputs exceeds this bound"),
    },
    async ({ source, field, maxCombinations }) => {
      try {
        const { compilation, parsed, error } = compileSource(source, field);
        if (!compilation || !parsed) return fail(error);
        const numInputs = compilation.inputWires.length + compilation.publicWires.length;
        const total = Number(compilation.fieldSize) ** numInputs;
        if (!Number.isFinite(total) || total > maxCombinations) {
          return fail({
            success: false,
            error: `Search space ${compilation.fieldSize}^${numInputs} exceeds maxCombinations=${maxCombinations}. Use a smaller field (e.g. 13 or 97) or raise maxCombinations (hard cap 1,000,000).`,
          });
        }
        const result = exhaustiveCheck(compilation, parsed.ast);
        return ok({
          success: true,
          totalCombinations: result.totalCombinations,
          tested: result.tested,
          allSatisfied: result.allSatisfied,
          isInputDetermined: result.isInputDetermined,
          uniqueOutputs: result.uniqueOutputs,
          ...(result.counterexample
            ? { counterexample: JSON.parse(toJson(result.counterexample)) }
            : {}),
        });
      } catch (e) {
        return fail({ error: String(e) });
      }
    },
  );
}
