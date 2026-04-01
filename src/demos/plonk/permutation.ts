import type { PlonkGate, CopyConstraint } from './logic';
import { modInverse } from '../../lib/math';

const mod = (a: bigint, p: bigint): bigint => ((a % p) + p) % p;

// ── Types ──────────────────────────────────────────────────────────

export interface WirePosition {
  gate: number;
  wire: 'a' | 'b' | 'c';
}

export interface PermutationMapping {
  /** For each wire position, where it maps to under σ. "gate:wire" → "gate:wire" */
  sigma: Map<string, string>;
  /** All cycles (groups of positions that must be equal) */
  cycles: string[][];
}

export interface GrandProductStep {
  gateIndex: number;
  /** Per-wire numerator/denominator contributions */
  numerators: { a: bigint; b: bigint; c: bigint };
  denominators: { a: bigint; b: bigint; c: bigint };
  /** Running product Z at this gate */
  productBefore: bigint;
  productAfter: bigint;
}

export interface PermutationResult {
  mapping: PermutationMapping;
  beta: bigint;
  gamma: bigint;
  steps: GrandProductStep[];
  finalProduct: bigint;
  satisfied: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Encode a wire position as a canonical string key. */
function posKey(gate: number, wire: 'a' | 'b' | 'c'): string {
  return `${gate}:${wire}`;
}

/** Convert a wire position to a unique field element for the grand product. */
export function encodeWirePosition(gate: number, wire: 'a' | 'b' | 'c'): bigint {
  const wireOffset = wire === 'a' ? 0 : wire === 'b' ? 1 : 2;
  return BigInt(gate * 3 + wireOffset) + 1n;
}

// ── Build permutation σ ────────────────────────────────────────────

/**
 * Build the permutation σ from copy constraints.
 *
 * Each wire position maps to itself by default (identity).
 * Each copy constraint creates a 2-cycle: σ(from) = to, σ(to) = from.
 *
 * If a position already belongs to a cycle and a new constraint touches it,
 * the two cycles are merged by splicing the new target into the existing cycle.
 */
export function buildPermutation(
  gates: PlonkGate[],
  copyConstraints: CopyConstraint[],
): PermutationMapping {
  // Initialise σ as the identity permutation.
  const sigma = new Map<string, string>();
  for (let i = 0; i < gates.length; i++) {
    for (const w of ['a', 'b', 'c'] as const) {
      const key = posKey(i, w);
      sigma.set(key, key); // identity
    }
  }

  // Track which cycle each position belongs to.
  // cycleOf maps key → reference to its cycle array.
  const cycleOf = new Map<string, string[]>();
  for (const [key] of sigma) {
    const cycle = [key];
    cycleOf.set(key, cycle);
  }

  for (const cc of copyConstraints) {
    const fromKey = posKey(cc.from.gate, cc.from.wire);
    const toKey = posKey(cc.to.gate, cc.to.wire);

    const cycleA = cycleOf.get(fromKey)!;
    const cycleB = cycleOf.get(toKey)!;

    if (cycleA === cycleB) {
      // Already in the same cycle — nothing to do.
      continue;
    }

    // Merge cycleB into cycleA.
    // Splice: σ(from) was pointing somewhere; σ(to) was pointing somewhere.
    // We swap the targets of from and to to link the two cycles.
    const oldFromTarget = sigma.get(fromKey)!;
    const oldToTarget = sigma.get(toKey)!;
    sigma.set(fromKey, oldToTarget);
    sigma.set(toKey, oldFromTarget);

    // Merge the cycle arrays.
    for (const key of cycleB) {
      cycleA.push(key);
      cycleOf.set(key, cycleA);
    }
    cycleB.length = 0; // mark as absorbed
  }

  // Collect non-trivial cycles (length > 1).
  const seenCycles = new Set<string[]>();
  const cycles: string[][] = [];
  for (const cycle of cycleOf.values()) {
    if (cycle.length > 1 && !seenCycles.has(cycle)) {
      seenCycles.add(cycle);
      cycles.push([...cycle]);
    }
  }

  return { sigma, cycles };
}

// ── Grand product accumulator ──────────────────────────────────────

/**
 * Compute the grand product accumulator Z step by step.
 *
 * Z(0) = 1
 * Z(i+1) = Z(i) · Π_w (f_w + β·id_w + γ) / (f_w + β·σ(w) + γ)  mod p
 *
 * If all copy constraints hold, Z returns to 1 after all gates.
 */
export function computeGrandProduct(
  gates: PlonkGate[],
  mapping: PermutationMapping,
  beta: bigint,
  gamma: bigint,
  p: bigint,
): PermutationResult {
  const steps: GrandProductStep[] = [];
  let z = 1n; // Z(0) = 1

  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i]!;
    const productBefore = z;

    const wires = ['a', 'b', 'c'] as const;
    const nums: Record<'a' | 'b' | 'c', bigint> = { a: 0n, b: 0n, c: 0n };
    const dens: Record<'a' | 'b' | 'c', bigint> = { a: 0n, b: 0n, c: 0n };

    let numProduct = 1n;
    let denProduct = 1n;

    for (const w of wires) {
      const wireVal = mod(BigInt(gate[w]), p);
      const posId = encodeWirePosition(i, w);

      // Parse σ target to get its encoded position.
      const sigmaKey = mapping.sigma.get(posKey(i, w))!;
      const [sigmaGateStr, sigmaWire] = sigmaKey.split(':');
      const sigmaId = encodeWirePosition(Number(sigmaGateStr), sigmaWire as 'a' | 'b' | 'c');

      const num = mod(wireVal + mod(beta * posId, p) + gamma, p);
      const den = mod(wireVal + mod(beta * sigmaId, p) + gamma, p);

      nums[w] = num;
      dens[w] = den;

      numProduct = mod(numProduct * num, p);
      denProduct = mod(denProduct * den, p);
    }

    // Z(i+1) = Z(i) · numProduct / denProduct  mod p
    const denInv = modInverse(denProduct, p);
    z = mod(z * mod(numProduct * denInv, p), p);

    steps.push({
      gateIndex: i,
      numerators: nums,
      denominators: dens,
      productBefore,
      productAfter: z,
    });
  }

  return {
    mapping,
    beta,
    gamma,
    steps,
    finalProduct: z,
    satisfied: z === 1n,
  };
}
