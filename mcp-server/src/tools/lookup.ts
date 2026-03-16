import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function analyzeLookup(table: number[], wires: number[]) {
  const sortedTable = [...table].sort((a, b) => a - b);
  const sortedWires = [...wires].sort((a, b) => a - b);
  const tableSet = new Set(table);
  const missing = [...new Set(wires)].filter(v => !tableSet.has(v));
  const wireCounts = new Map<number, number>();
  for (const v of wires) wireCounts.set(v, (wireCounts.get(v) ?? 0) + 1);
  return {
    table, wires, sortedTable, sortedWires, missing,
    passes: missing.length === 0,
    wireCounts: Object.fromEntries(wireCounts),
  };
}

export function registerLookupTools(server: McpServer) {
  server.tool(
    "lookup_check",
    "Check if all wire values exist in the lookup table (standard lookup semantics — table values can be reused)",
    {
      table: z.array(z.number()).min(1).describe("Lookup table values"),
      wireValues: z.array(z.number()).min(1).describe("Wire values to check against the table"),
    },
    async ({ table, wireValues }) => {
      const analysis = analyzeLookup(table, wireValues);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            valid: analysis.passes,
            sortedTable: analysis.sortedTable,
            sortedWires: analysis.sortedWires,
            missing: analysis.missing,
            wireCounts: analysis.wireCounts,
            explanation: analysis.passes
              ? "All wire values exist in the table. Standard lookup semantics allow table values to be looked up multiple times."
              : `Missing values: [${analysis.missing.join(', ')}] — these wire values do not appear in the table.`,
          }, null, 2),
        }],
      };
    }
  );
}
