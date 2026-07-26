// JSON-safe serialization helpers for DSL results (bigint + Map based).

export function linCombToObject(lc: Map<number, bigint>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [wireId, coeff] of [...lc.entries()].sort(([a], [b]) => a - b)) {
    out[String(wireId)] = coeff.toString();
  }
  return out;
}

export function witnessToObject(values: Map<number, bigint>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [wireId, value] of [...values.entries()].sort(([a], [b]) => a - b)) {
    out[String(wireId)] = value.toString();
  }
  return out;
}

export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, bigintReplacer);
}
