/**
 * Constraint editor preset library: the four debug-mode default circuits
 * plus classic gadgets (bit check, XOR, range check, Fibonacci) and a
 * deliberately buggy range check for bug-hunting practice.
 *
 * Every preset must respect the grammar's one-multiplication-per-expression
 * rule; tests execute each one through the full DSL pipeline.
 */

import { DEFAULT_CIRCUITS, type DefaultCircuit } from '@/lib/dsl/defaults';

const GADGET_PRESETS: DefaultCircuit[] = [
  {
    id: 'boolean-bit',
    name: 'Boolean bit check',
    source: `// Constrain b to be a bit: b * (b - 1) = 0
// Only 0 and 1 satisfy this over any prime field.
input b

wire t = b * (b - 1)
assert t == 0`,
    defaultInputs: { b: 1 },
  },
  {
    id: 'xor',
    name: 'XOR gadget',
    source: `// XOR of two bits: out = a + b - 2ab
input a
input b
public out

wire ca = a * (a - 1)
assert ca == 0
wire cb = b * (b - 1)
assert cb == 0

wire ab = a * b
wire twoab = ab + ab
wire x = a + b - twoab
assert x == out`,
    defaultInputs: { a: 1, b: 0, out: 1 },
  },
  {
    id: 'range3',
    name: '3-bit range check',
    source: `// Prove x < 8 by decomposing into three bits:
// x = b0 + 2*b1 + 4*b2 with each b constrained to {0,1}.
input b0
input b1
input b2
public x

wire c0 = b0 * (b0 - 1)
assert c0 == 0
wire c1 = b1 * (b1 - 1)
assert c1 == 0
wire c2 = b2 * (b2 - 1)
assert c2 == 0

wire twob1 = b1 + b1
wire fourb2 = b2 + b2 + b2 + b2
wire sum = b0 + twob1 + fourb2
assert sum == x`,
    defaultInputs: { b0: 1, b1: 0, b2: 1, x: 5 },
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci chain',
    source: `// Additive chain: f3..f7 from f1, f2. fib(7) = 13.
input f1
input f2
public f7

wire f3 = f1 + f2
wire f4 = f2 + f3
wire f5 = f3 + f4
wire f6 = f4 + f5
wire last = f5 + f6
assert last == f7`,
    defaultInputs: { f1: 1, f2: 1, f7: 13 },
  },
  {
    id: 'buggy-missing-bit',
    name: 'Range check (buggy!)',
    source: `// BUG: b2 is never constrained to be a bit.
// A prover can set b2 to any field element, so "x < 8"
// is not actually enforced: b0=0, b1=0, b2=10 gives x=40.
input b0
input b1
input b2
public x

wire c0 = b0 * (b0 - 1)
assert c0 == 0
wire c1 = b1 * (b1 - 1)
assert c1 == 0

wire twob1 = b1 + b1
wire fourb2 = b2 + b2 + b2 + b2
wire sum = b0 + twob1 + fourb2
assert sum == x

// The fix: add "wire c2 = b2 * (b2 - 1)" and "assert c2 == 0".`,
    defaultInputs: { b0: 0, b1: 0, b2: 10, x: 40 },
  },
];

export const EDITOR_PRESETS: DefaultCircuit[] = [...DEFAULT_CIRCUITS, ...GADGET_PRESETS];

/** Preset ids whose circuits are intentionally buggy (used by tests and UI hints). */
export const BUGGY_PRESET_IDS = new Set(['underconstrained', 'buggy-missing-bit']);

export function getEditorPreset(id: string): DefaultCircuit | null {
  return EDITOR_PRESETS.find((c) => c.id === id) ?? null;
}

export function getPresetIdForSource(source: string): string {
  return EDITOR_PRESETS.find((c) => c.source === source)?.id ?? 'custom';
}
