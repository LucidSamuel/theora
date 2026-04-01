/**
 * LogUp — logarithmic-derivative lookup argument over GF(p).
 *
 * Instead of checking multiset equality directly (à la Plookup),
 * LogUp proves:
 *
 *   Σᵢ 1/(β + wᵢ)  =  Σⱼ mⱼ/(β + tⱼ)
 *
 * where wᵢ are wire values, tⱼ are table values, mⱼ is the
 * multiplicity of tⱼ in the wire vector, and β is a random
 * challenge from the verifier.
 *
 * All arithmetic is over GF(fieldSize) using BigInt.
 */

import { modInverse } from '@/lib/math';

/* ── helpers ─────────────────────────────────────────────── */

const mod = (a: bigint, p: bigint): bigint => ((a % p) + p) % p;

/* ── types ───────────────────────────────────────────────── */

export interface LogUpInput {
  tableValues: bigint[]; // t₁,...,tₙ (distinct)
  wireValues: bigint[]; // w₁,...,wₘ (each must appear in table)
  beta: bigint; // random challenge
  fieldSize: bigint;
}

export interface LogUpStep {
  stepName: string;
  description: string;
}

export interface LogUpResult {
  multiplicities: Map<bigint, number>; // how many times each table value appears in wires
  wireFractions: bigint[]; // 1/(β + wᵢ) for each wire
  tableFractions: bigint[]; // mⱼ/(β + tⱼ) for each table entry
  wireSum: bigint; // Σ 1/(β + wᵢ)
  tableSum: bigint; // Σ mⱼ/(β + tⱼ)
  satisfied: boolean; // wireSum === tableSum
  steps: LogUpStep[]; // for visualization
  invalidWires: number[]; // indices of wires not in the table
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Count how many times each table value appears in the wire vector.
 * Only counts values that actually exist in the table.
 */
export function computeMultiplicities(
  tableValues: bigint[],
  wireValues: bigint[],
): Map<bigint, number> {
  const tableSet = new Set(tableValues);
  const counts = new Map<bigint, number>();

  // Initialize all table values with multiplicity 0
  for (const t of tableValues) {
    counts.set(t, 0);
  }

  // Count wire values that are in the table
  for (const w of wireValues) {
    if (tableSet.has(w)) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Run the LogUp check.
 *
 * 1. Compute multiplicities from wire values against the table
 * 2. Compute wire-side fractions 1/(β + wᵢ) and sum them
 * 3. Compute table-side fractions mⱼ/(β + tⱼ) and sum them
 * 4. Check wireSum === tableSum in GF(p)
 */
export function logUpCheck(input: LogUpInput): LogUpResult {
  const { tableValues, wireValues, beta, fieldSize: p } = input;
  const steps: LogUpStep[] = [];
  const tableSet = new Set(tableValues);

  // ── Step 1: find invalid wires ──
  const invalidWires: number[] = [];
  for (let i = 0; i < wireValues.length; i++) {
    if (!tableSet.has(wireValues[i]!)) {
      invalidWires.push(i);
    }
  }

  steps.push({
    stepName: 'Validate wires',
    description:
      invalidWires.length === 0
        ? 'All wire values found in the table'
        : `${invalidWires.length} wire value(s) not found in the table`,
  });

  // ── Step 2: compute multiplicities ──
  const multiplicities = computeMultiplicities(tableValues, wireValues);

  steps.push({
    stepName: 'Compute multiplicities',
    description: `Counted how many times each of ${tableValues.length} table values appears among ${wireValues.length} wires`,
  });

  // ── Step 3: wire-side fractions and sum ──
  const wireFractions: bigint[] = [];
  let wireSum = 0n;

  for (const w of wireValues) {
    const denom = mod(beta + w, p);
    // If β + wᵢ ≡ 0 (mod p), the fraction is undefined.
    // In practice β is chosen to avoid this. We use modInverse
    // which will throw if denom is 0 — callers should pick β
    // that avoids collisions with -wᵢ.
    const frac = modInverse(denom, p);
    wireFractions.push(frac);
    wireSum = mod(wireSum + frac, p);
  }

  steps.push({
    stepName: 'Wire fractions',
    description: `Computed Σᵢ 1/(β + wᵢ) with β = ${beta}`,
  });

  // ── Step 4: table-side fractions and sum ──
  const tableFractions: bigint[] = [];
  let tableSum = 0n;

  for (const t of tableValues) {
    const m = BigInt(multiplicities.get(t) ?? 0);
    if (m === 0n) {
      tableFractions.push(0n);
      continue;
    }
    const denom = mod(beta + t, p);
    const inv = modInverse(denom, p);
    const frac = mod(m * inv, p);
    tableFractions.push(frac);
    tableSum = mod(tableSum + frac, p);
  }

  steps.push({
    stepName: 'Table fractions',
    description: `Computed Σⱼ mⱼ/(β + tⱼ) with β = ${beta}`,
  });

  // ── Step 5: final check ──
  const satisfied = wireSum === tableSum && invalidWires.length === 0;

  steps.push({
    stepName: 'LogUp check',
    description: satisfied
      ? `wireSum = tableSum = ${wireSum} — lookup argument satisfied`
      : `wireSum = ${wireSum}, tableSum = ${tableSum} — ${
          invalidWires.length > 0
            ? 'invalid wires present'
            : 'sums do not match'
        }`,
  });

  return {
    multiplicities,
    wireFractions,
    tableFractions,
    wireSum,
    tableSum,
    satisfied,
    steps,
    invalidWires,
  };
}
