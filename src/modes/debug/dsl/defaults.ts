export interface DefaultCircuit {
  id: string;
  name: string;
  source: string;
  defaultInputs: Record<string, number>;
}

export const DEFAULT_CIRCUITS: DefaultCircuit[] = [
  {
    id: 'basic',
    name: 'x² + x + 5',
    source: `// Compute f(x) = x² + x + 5
input x
public out

wire t = x * x
wire u = t + x + 5
assert u == out`,
    defaultInputs: { x: 7, out: 61 },
  },
  {
    id: 'mul-chain',
    name: 'Multiplication chain',
    source: `// Three sequential multiplications
input a
input b
input c
public result

wire ab = a * b
wire abc = ab * c
assert abc == result`,
    defaultInputs: { a: 3, b: 4, c: 5, result: 60 },
  },
  {
    id: 'underconstrained',
    name: 'Underconstrained (buggy!)',
    source: `// BUG: 't' is declared as input but never constrained to equal x*x
// The prover can set t to anything.
input x
input t
public out

wire u = t + x + 5
assert u == out

// Try: set x=7, t=0, out=12. It passes!
// But f(7) should be 61 (= 49 + 7 + 5).
// The fix: replace "input t" with "wire t = x * x".`,
    defaultInputs: { x: 7, t: 0, out: 12 },
  },
  {
    id: 'poseidon-like',
    name: 'Hash-like circuit',
    source: `// Simplified Poseidon-like round
input state
input key
public digest

wire sum = state + key
wire sq = sum * sum
wire cube = sq * sum
wire mixed = cube + 17
wire final = mixed * mixed
assert final == digest`,
    defaultInputs: { state: 3, key: 5, digest: 71 },
  },
];

export function getDefaultCircuit(id: string): DefaultCircuit | null {
  return DEFAULT_CIRCUITS.find((c) => c.id === id) ?? null;
}
