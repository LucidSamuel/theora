import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Witness, ConstraintCheck } from "../lib/types.js";

function buildWitness(x: number, y: number, zVal: number): Witness {
  return { x, y, t: x * x, z: zVal };
}

function evaluateCircuit(witness: Witness, broken: boolean): ConstraintCheck[] {
  const constraints: ConstraintCheck[] = [
    { label: 't = x * x', left: witness.t, right: witness.x * witness.x, satisfied: witness.t === witness.x * witness.x },
  ];
  if (!broken) {
    constraints.push({ label: 'z = t + y', left: witness.z, right: witness.t + witness.y, satisfied: witness.z === witness.t + witness.y });
  }
  return constraints;
}

function witnessSatisfiesAll(witness: Witness, broken: boolean): boolean {
  return evaluateCircuit(witness, broken).every(c => c.satisfied);
}

function getR1CSRows(broken: boolean) {
  return [
    { label: 'x · x = t', A: [0, 1, 0, 0, 0], B: [0, 1, 0, 0, 0], C: [0, 0, 0, 1, 0] },
    ...(broken ? [] : [{ label: '1 · (t + y) = z', A: [0, 0, 1, 1, 0], B: [1, 0, 0, 0, 0], C: [0, 0, 0, 0, 1] }]),
  ];
}

function getExploitWitness(x: number, y: number): Witness {
  return { x, y, t: x * x, z: x * x + y + 5 };
}

export function registerCircuitTools(server: McpServer) {
  server.tool(
    "circuit_evaluate",
    "Evaluate an R1CS circuit (f(x) = x² + y) with a given witness and return constraint satisfaction",
    {
      x: z.number().describe("Input x"),
      y: z.number().describe("Input y"),
      z: z.number().optional().describe("Claimed output z (defaults to x² + y)"),
      broken: z.boolean().default(false).describe("If true, drop the second constraint (underconstrained)"),
      tOverride: z.number().optional().describe("Override the intermediate wire t (normally t = x²)"),
    },
    async ({ x, y, z: zVal, broken, tOverride }) => {
      const effectiveZ = zVal ?? (x * x + y);
      const witness = tOverride !== undefined ? { x, y, t: tOverride, z: effectiveZ } : buildWitness(x, y, effectiveZ);
      const constraints = evaluateCircuit(witness, broken);
      const allSatisfied = constraints.every(c => c.satisfied);
      const rows = getR1CSRows(broken);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            witness,
            constraints,
            allSatisfied,
            r1csRows: rows,
            computation: "f(x, y) = x² + y",
            expectedZ: x * x + y,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "circuit_find_exploit",
    "Find an exploit witness for an underconstrained circuit",
    {
      x: z.number().describe("Input x"),
      y: z.number().describe("Input y"),
    },
    async ({ x, y }) => {
      const validWitness = buildWitness(x, y, x * x + y);
      const exploitWitness = getExploitWitness(x, y);
      const validInFull = witnessSatisfiesAll(validWitness, false);
      const exploitInFull = witnessSatisfiesAll(exploitWitness, false);
      const exploitInBroken = witnessSatisfiesAll(exploitWitness, true);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            validWitness,
            exploitWitness,
            analysis: {
              validPassesFullCircuit: validInFull,
              exploitPassesFullCircuit: exploitInFull,
              exploitPassesBrokenCircuit: exploitInBroken,
            },
            explanation: `The exploit sets z = x² + y + 5 = ${exploitWitness.z} instead of the correct z = x² + y = ${x * x + y}. ` +
              `In the broken (underconstrained) circuit, only t = x² is checked, so z can be anything. ` +
              `In the full circuit, the second constraint z = t + y catches the discrepancy.`,
            isUnderconstrained: true,
          }, null, 2),
        }],
      };
    }
  );
}
