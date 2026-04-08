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
    .filter((value) => /^[+-]?\d+$/.test(value))
    .map((value) => Number(value));
}

export function analyzeLookup(table: number[], wires: number[]): LookupAnalysis {
  const sortedTable = [...table].sort((a, b) => a - b);
  const sortedWires = [...wires].sort((a, b) => a - b);
  const tableSet = new Set(table);
  const wireCounts = countValues(wires);

  // Standard lookup semantics: each wire value must exist in the table,
  // but table values can be looked up any number of times.
  const missing = [...wireCounts.keys()].filter((value) => !tableSet.has(value));

  return {
    table,
    wires,
    sortedTable,
    sortedWires,
    missing,
    multiplicityMismatches: [],
    passes: missing.length === 0,
  };
}

function countValues(values: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
