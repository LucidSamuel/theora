export interface LookupAnalysis {
  table: number[];
  wires: number[];
  sortedTable: number[];
  sortedWires: number[];
  missing: number[];
  multiplicityMismatches: number[];
  passes: boolean;
}

export function parseNumberList(input: string): number[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

export function analyzeLookup(table: number[], wires: number[]): LookupAnalysis {
  const sortedTable = [...table].sort((a, b) => a - b);
  const sortedWires = [...wires].sort((a, b) => a - b);
  const tableCounts = countValues(table);
  const wireCounts = countValues(wires);
  const missing = [...wireCounts.keys()].filter((value) => !tableCounts.has(value));
  const multiplicityMismatches = [...wireCounts.entries()]
    .filter(([value, count]) => (tableCounts.get(value) ?? 0) < count)
    .map(([value]) => value);

  return {
    table,
    wires,
    sortedTable,
    sortedWires,
    missing,
    multiplicityMismatches,
    passes: missing.length === 0 && multiplicityMismatches.length === 0,
  };
}

function countValues(values: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
