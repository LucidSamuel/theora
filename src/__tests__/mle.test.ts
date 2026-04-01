import { describe, it, expect } from 'vitest';
import {
  createMLE,
  computeEqBasis,
  evaluateMLE,
  partialEvaluate,
  sumOverHypercube,
  mleFromFunction,
  addMLE,
  scaleMLE,
  multiplyMLE,
} from '../demos/mle/logic';

const F = 101n; // field size for all tests

/* ── createMLE ───────────────────────────────────────────── */

describe('createMLE', () => {
  it('creates correct number of evaluations (2^n)', () => {
    const mle2 = createMLE(2, F, [1n, 2n, 3n, 4n]);
    expect(mle2.evaluations).toHaveLength(4);
    expect(mle2.numVars).toBe(2);

    const mle3 = createMLE(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    expect(mle3.evaluations).toHaveLength(8);
    expect(mle3.numVars).toBe(3);
  });

  it('stores bits in big-endian binary order', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    expect(mle.evaluations[0]!.bits).toEqual([0, 0]);
    expect(mle.evaluations[1]!.bits).toEqual([0, 1]);
    expect(mle.evaluations[2]!.bits).toEqual([1, 0]);
    expect(mle.evaluations[3]!.bits).toEqual([1, 1]);
  });

  it('stores the correct values at each point', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    expect(mle.evaluations[0]!.value).toBe(10n);
    expect(mle.evaluations[1]!.value).toBe(20n);
    expect(mle.evaluations[2]!.value).toBe(30n);
    expect(mle.evaluations[3]!.value).toBe(40n);
  });

  it('reduces values mod fieldSize', () => {
    const mle = createMLE(1, F, [105n, 203n]);
    expect(mle.evaluations[0]!.value).toBe(4n);  // 105 mod 101
    expect(mle.evaluations[1]!.value).toBe(1n);  // 203 mod 101
  });

  it('throws if wrong number of values provided', () => {
    expect(() => createMLE(2, F, [1n, 2n, 3n])).toThrow();
    expect(() => createMLE(2, F, [1n, 2n, 3n, 4n, 5n])).toThrow();
  });

  it('uses deterministic default values when none provided', () => {
    const mle = createMLE(2, F);
    // Default: value = (index + 1) mod fieldSize
    expect(mle.evaluations[0]!.value).toBe(1n);
    expect(mle.evaluations[1]!.value).toBe(2n);
    expect(mle.evaluations[2]!.value).toBe(3n);
    expect(mle.evaluations[3]!.value).toBe(4n);
  });

  it('handles single variable (n=1)', () => {
    const mle = createMLE(1, F, [7n, 13n]);
    expect(mle.evaluations).toHaveLength(2);
    expect(mle.evaluations[0]!.bits).toEqual([0]);
    expect(mle.evaluations[1]!.bits).toEqual([1]);
  });
});

/* ── computeEqBasis ──────────────────────────────────────── */

describe('computeEqBasis', () => {
  it('basis weights sum to 1 at a boolean point', () => {
    // At any boolean point, eq(b, v) = 1 if v === b, else 0.
    // So the sum is exactly 1.
    const terms = computeEqBasis([0n, 1n], F);
    let sum = 0n;
    for (const t of terms) {
      sum = (sum + t.weight) % F;
    }
    expect(sum).toBe(1n);
  });

  it('is 1 at the matching vertex and 0 elsewhere (boolean point)', () => {
    // eq((0,1), (0,1)) = 1, all others = 0
    const terms = computeEqBasis([0n, 1n], F);
    // Vertex (0,0) -> index 0
    expect(terms[0]!.weight).toBe(0n);
    // Vertex (0,1) -> index 1
    expect(terms[1]!.weight).toBe(1n);
    // Vertex (1,0) -> index 2
    expect(terms[2]!.weight).toBe(0n);
    // Vertex (1,1) -> index 3
    expect(terms[3]!.weight).toBe(0n);
  });

  it('computes correct individual terms at a non-boolean point', () => {
    // eq((2, 3), (1, 1)) = (1*2 + 0*(1-2)) * (1*3 + 0*(1-3)) = 2 * 3 = 6
    const terms = computeEqBasis([2n, 3n], F);
    const v11 = terms[3]!; // vertex [1,1]
    expect(v11.weight).toBe(6n);

    // eq((2, 3), (0, 0)) = (0*2 + 1*(1-2)) * (0*3 + 1*(1-3)) = (-1)*(-2) = 2
    const v00 = terms[0]!; // vertex [0,0]
    expect(v00.weight).toBe(2n);
  });

  it('weights sum to 1 at any field point', () => {
    // The eq basis always sums to 1 (partition of unity).
    const terms = computeEqBasis([17n, 42n, 73n], F);
    let sum = 0n;
    for (const t of terms) {
      sum = (sum + t.weight) % F;
    }
    expect(sum).toBe(1n);
  });

  it('returns 2^n terms', () => {
    const terms = computeEqBasis([5n, 10n, 15n], F);
    expect(terms).toHaveLength(8);
  });

  it('single variable case', () => {
    // eq(r, 0) = 1 - r, eq(r, 1) = r
    const terms = computeEqBasis([7n], F);
    expect(terms[0]!.weight).toBe(101n - 7n + 1n); // 1 - 7 mod 101 = 95
    // Actually: (1 - 7) mod 101 = -6 mod 101 = 95
    expect(terms[0]!.weight).toBe(95n);
    expect(terms[1]!.weight).toBe(7n);
  });
});

/* ── evaluateMLE ─────────────────────────────────────────── */

describe('evaluateMLE', () => {
  it('agrees with stored values at boolean points', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);

    expect(evaluateMLE(mle, [0n, 0n]).value).toBe(10n);
    expect(evaluateMLE(mle, [0n, 1n]).value).toBe(20n);
    expect(evaluateMLE(mle, [1n, 0n]).value).toBe(30n);
    expect(evaluateMLE(mle, [1n, 1n]).value).toBe(40n);
  });

  it('interpolation at non-boolean point matches manual computation', () => {
    // f(0,0)=1, f(0,1)=2, f(1,0)=3, f(1,1)=4
    // f~(r1,r2) = 1*(1-r1)(1-r2) + 2*(1-r1)*r2 + 3*r1*(1-r2) + 4*r1*r2
    // At (2,3):
    //   = 1*(-1)*(-2) + 2*(-1)*3 + 3*2*(-2) + 4*2*3
    //   = 2 - 6 - 12 + 24 = 8
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    expect(evaluateMLE(mle, [2n, 3n]).value).toBe(8n);
  });

  it('multilinear extension of linear function is the same function', () => {
    // f(x1,x2,x3) = x1 + 2*x2 + 3*x3 on the boolean cube
    // The MLE of a multilinear function is itself.
    // f(0,0,0)=0, f(0,0,1)=3, f(0,1,0)=2, f(0,1,1)=5,
    // f(1,0,0)=1, f(1,0,1)=4, f(1,1,0)=3, f(1,1,1)=6
    const mle = createMLE(3, F, [0n, 3n, 2n, 5n, 1n, 4n, 3n, 6n]);
    // At (5, 7, 11): 5 + 14 + 33 = 52
    expect(evaluateMLE(mle, [5n, 7n, 11n]).value).toBe(52n);
  });

  it('returns basisTerms with correct vertex labels', () => {
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    const result = evaluateMLE(mle, [5n, 10n]);
    expect(result.basisTerms).toHaveLength(4);
    expect(result.basisTerms[0]!.vertex).toEqual([0, 0]);
    expect(result.basisTerms[1]!.vertex).toEqual([0, 1]);
    expect(result.basisTerms[2]!.vertex).toEqual([1, 0]);
    expect(result.basisTerms[3]!.vertex).toEqual([1, 1]);
  });

  it('value equals manual sum of f(v)*eq(r,v)', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const result = evaluateMLE(mle, [3n, 7n]);

    // Verify: value = sum of f(v) * weight(v) mod F
    let manualSum = 0n;
    for (let i = 0; i < 4; i++) {
      manualSum = (manualSum + mle.evaluations[i]!.value * result.basisTerms[i]!.weight) % F;
    }
    expect(result.value).toBe(manualSum);
  });

  it('throws on dimension mismatch', () => {
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    expect(() => evaluateMLE(mle, [1n])).toThrow();
    expect(() => evaluateMLE(mle, [1n, 2n, 3n])).toThrow();
  });

  it('handles mod wrapping in evaluation', () => {
    // Use large values that will wrap
    const mle = createMLE(1, F, [99n, 100n]);
    // f~(50) = 99*(1-50) + 100*50 = 99*(-49) + 5000
    //        = -4851 + 5000 = 149 mod 101 = 48
    expect(evaluateMLE(mle, [50n]).value).toBe(48n);
  });
});

/* ── partialEvaluate ─────────────────────────────────────── */

describe('partialEvaluate', () => {
  it('fixing all vars gives a single value equal to evaluateMLE', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const point = [3n, 7n];
    const partial = partialEvaluate(mle, point);

    expect(partial.remainingVars).toBe(0);
    expect(partial.evaluations).toHaveLength(1);
    expect(partial.evaluations[0]!.value).toBe(evaluateMLE(mle, point).value);
  });

  it('fixing 0 vars returns the original evaluations', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const partial = partialEvaluate(mle, []);

    expect(partial.remainingVars).toBe(2);
    expect(partial.evaluations).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(partial.evaluations[i]!.value).toBe(mle.evaluations[i]!.value);
    }
  });

  it('intermediate partial evaluation (fix 1 of 2 vars)', () => {
    // f(0,0)=1, f(0,1)=2, f(1,0)=3, f(1,1)=4
    // Fix x1 = 5:
    //   g(0) = f(0,0)*(1-5) + f(1,0)*5 = 1*(-4) + 3*5 = -4+15 = 11
    //   g(1) = f(0,1)*(1-5) + f(1,1)*5 = 2*(-4) + 4*5 = -8+20 = 12
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    const partial = partialEvaluate(mle, [5n]);

    expect(partial.remainingVars).toBe(1);
    expect(partial.evaluations).toHaveLength(2);
    expect(partial.evaluations[0]!.value).toBe(11n);
    expect(partial.evaluations[1]!.value).toBe(12n);
  });

  it('sequential partial evaluation equals direct full evaluation', () => {
    const mle = createMLE(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    const point = [7n, 13n, 42n];

    // Fix one at a time
    const p1 = partialEvaluate(mle, [7n]);
    // Build a new MLE from partial result to fix the second var
    const mle2 = createMLE(p1.remainingVars, F,
      p1.evaluations.map(e => e.value));
    const p2 = partialEvaluate(mle2, [13n]);
    // And the third
    const mle3 = createMLE(p2.remainingVars, F,
      p2.evaluations.map(e => e.value));
    const p3 = partialEvaluate(mle3, [42n]);

    expect(p3.evaluations[0]!.value).toBe(evaluateMLE(mle, point).value);
  });

  it('partial evaluation with fix 2 of 3 vars', () => {
    const mle = createMLE(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);

    const partial = partialEvaluate(mle, [2n, 3n]);
    expect(partial.remainingVars).toBe(1);
    expect(partial.evaluations).toHaveLength(2);

    // The two remaining values at b3=0 and b3=1, when further evaluated
    // at b3=5, should match evaluateMLE at (2, 3, 5).
    const gMLE = createMLE(1, F, partial.evaluations.map(e => e.value));
    const gResult = evaluateMLE(gMLE, [5n]);
    expect(gResult.value).toBe(evaluateMLE(mle, [2n, 3n, 5n]).value);
  });

  it('throws if fixing more vars than available', () => {
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    expect(() => partialEvaluate(mle, [1n, 2n, 3n])).toThrow();
  });
});

/* ── sumOverHypercube ────────────────────────────────────── */

describe('sumOverHypercube', () => {
  it('sums correctly for known values', () => {
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    expect(sumOverHypercube(mle)).toBe(10n);
  });

  it('handles field wrapping', () => {
    // 50 + 50 + 50 + 50 = 200 mod 101 = 99
    const mle = createMLE(2, F, [50n, 50n, 50n, 50n]);
    expect(sumOverHypercube(mle)).toBe(99n);
  });

  it('returns 0 for the zero polynomial', () => {
    const mle = createMLE(2, F, [0n, 0n, 0n, 0n]);
    expect(sumOverHypercube(mle)).toBe(0n);
  });

  it('works for 3 variables', () => {
    const mle = createMLE(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    // 1+2+3+4+5+6+7+8 = 36
    expect(sumOverHypercube(mle)).toBe(36n);
  });
});

/* ── mleFromFunction ─────────────────────────────────────── */

describe('mleFromFunction', () => {
  it('AND function: f(x1,x2) = x1 * x2', () => {
    const mle = mleFromFunction(2, F, (bits) => BigInt(bits[0]! * bits[1]!));
    expect(mle.evaluations[0]!.value).toBe(0n); // f(0,0) = 0
    expect(mle.evaluations[1]!.value).toBe(0n); // f(0,1) = 0
    expect(mle.evaluations[2]!.value).toBe(0n); // f(1,0) = 0
    expect(mle.evaluations[3]!.value).toBe(1n); // f(1,1) = 1
  });

  it('OR function: f(x1,x2) = x1 + x2 - x1*x2', () => {
    const mle = mleFromFunction(2, F, (bits) => {
      const a = bits[0]!;
      const b = bits[1]!;
      return BigInt(a + b - a * b);
    });
    expect(mle.evaluations[0]!.value).toBe(0n); // f(0,0) = 0
    expect(mle.evaluations[1]!.value).toBe(1n); // f(0,1) = 1
    expect(mle.evaluations[2]!.value).toBe(1n); // f(1,0) = 1
    expect(mle.evaluations[3]!.value).toBe(1n); // f(1,1) = 1
  });

  it('constant function', () => {
    const mle = mleFromFunction(2, F, () => 42n);
    for (const pt of mle.evaluations) {
      expect(pt.value).toBe(42n);
    }
    // MLE of a constant should evaluate to 42 everywhere
    expect(evaluateMLE(mle, [17n, 53n]).value).toBe(42n);
  });

  it('reduces values mod fieldSize', () => {
    const mle = mleFromFunction(1, F, () => 203n);
    expect(mle.evaluations[0]!.value).toBe(1n); // 203 mod 101
    expect(mle.evaluations[1]!.value).toBe(1n);
  });

  it('identity function on single variable', () => {
    // f(x) = x
    const mle = mleFromFunction(1, F, (bits) => BigInt(bits[0]!));
    expect(mle.evaluations[0]!.value).toBe(0n); // f(0) = 0
    expect(mle.evaluations[1]!.value).toBe(1n); // f(1) = 1
    // MLE at r: f~(r) = r
    expect(evaluateMLE(mle, [50n]).value).toBe(50n);
  });
});

/* ── addMLE ──────────────────────────────────────────────── */

describe('addMLE', () => {
  it('adds pointwise correctly', () => {
    const a = createMLE(2, F, [1n, 2n, 3n, 4n]);
    const b = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const sum = addMLE(a, b);

    expect(sum.evaluations[0]!.value).toBe(11n);
    expect(sum.evaluations[1]!.value).toBe(22n);
    expect(sum.evaluations[2]!.value).toBe(33n);
    expect(sum.evaluations[3]!.value).toBe(44n);
  });

  it('handles mod wrapping', () => {
    const a = createMLE(1, F, [99n, 50n]);
    const b = createMLE(1, F, [5n, 60n]);
    const sum = addMLE(a, b);

    expect(sum.evaluations[0]!.value).toBe(3n);   // (99+5) mod 101
    expect(sum.evaluations[1]!.value).toBe(9n);   // (50+60) mod 101
  });

  it('adding zero MLE is identity', () => {
    const a = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const zero = createMLE(2, F, [0n, 0n, 0n, 0n]);
    const sum = addMLE(a, zero);

    for (let i = 0; i < 4; i++) {
      expect(sum.evaluations[i]!.value).toBe(a.evaluations[i]!.value);
    }
  });

  it('throws on mismatched numVars', () => {
    const a = createMLE(2, F, [1n, 2n, 3n, 4n]);
    const b = createMLE(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    expect(() => addMLE(a, b)).toThrow();
  });

  it('linearity: evaluateMLE(a+b, r) = evaluateMLE(a, r) + evaluateMLE(b, r)', () => {
    const a = createMLE(2, F, [3n, 7n, 11n, 13n]);
    const b = createMLE(2, F, [17n, 19n, 23n, 29n]);
    const sum = addMLE(a, b);
    const r = [5n, 9n];

    const evalSum = evaluateMLE(sum, r).value;
    const sumEval = (evaluateMLE(a, r).value + evaluateMLE(b, r).value) % F;

    expect(evalSum).toBe(sumEval);
  });
});

/* ── scaleMLE ────────────────────────────────────────────── */

describe('scaleMLE', () => {
  it('scales all evaluations by the scalar', () => {
    const mle = createMLE(2, F, [1n, 2n, 3n, 4n]);
    const scaled = scaleMLE(mle, 10n);

    expect(scaled.evaluations[0]!.value).toBe(10n);
    expect(scaled.evaluations[1]!.value).toBe(20n);
    expect(scaled.evaluations[2]!.value).toBe(30n);
    expect(scaled.evaluations[3]!.value).toBe(40n);
  });

  it('handles mod wrapping in scalar', () => {
    const mle = createMLE(1, F, [50n, 3n]);
    const scaled = scaleMLE(mle, 3n);

    expect(scaled.evaluations[0]!.value).toBe(49n); // 150 mod 101
    expect(scaled.evaluations[1]!.value).toBe(9n);  // 9 mod 101
  });

  it('scaling by 0 gives zero MLE', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const scaled = scaleMLE(mle, 0n);

    for (const pt of scaled.evaluations) {
      expect(pt.value).toBe(0n);
    }
  });

  it('scaling by 1 is identity', () => {
    const mle = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const scaled = scaleMLE(mle, 1n);

    for (let i = 0; i < 4; i++) {
      expect(scaled.evaluations[i]!.value).toBe(mle.evaluations[i]!.value);
    }
  });

  it('homogeneity: evaluateMLE(s*f, r) = s * evaluateMLE(f, r)', () => {
    const mle = createMLE(2, F, [3n, 7n, 11n, 13n]);
    const s = 17n;
    const scaled = scaleMLE(mle, s);
    const r = [5n, 9n];

    const evalScaled = evaluateMLE(scaled, r).value;
    const scaledEval = (s * evaluateMLE(mle, r).value) % F;

    expect(evalScaled).toBe(scaledEval);
  });
});

/* ── multiplyMLE ─────────────────────────────────────────── */

describe('multiplyMLE', () => {
  it('multiplies pointwise correctly', () => {
    const a = createMLE(2, F, [2n, 3n, 5n, 7n]);
    const b = createMLE(2, F, [11n, 13n, 17n, 19n]);
    const prod = multiplyMLE(a, b);

    expect(prod.evaluations[0]!.value).toBe(22n);  // 2*11
    expect(prod.evaluations[1]!.value).toBe(39n);  // 3*13
    expect(prod.evaluations[2]!.value).toBe(85n);  // 5*17
    expect(prod.evaluations[3]!.value).toBe(32n);  // 7*19 = 133 mod 101
  });

  it('multiplying by constant-1 MLE is identity on hypercube', () => {
    const a = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const one = createMLE(2, F, [1n, 1n, 1n, 1n]);
    const prod = multiplyMLE(a, one);

    for (let i = 0; i < 4; i++) {
      expect(prod.evaluations[i]!.value).toBe(a.evaluations[i]!.value);
    }
  });

  it('multiplying by zero MLE gives zero', () => {
    const a = createMLE(2, F, [10n, 20n, 30n, 40n]);
    const zero = createMLE(2, F, [0n, 0n, 0n, 0n]);
    const prod = multiplyMLE(a, zero);

    for (const pt of prod.evaluations) {
      expect(pt.value).toBe(0n);
    }
  });

  it('throws on mismatched numVars', () => {
    const a = createMLE(2, F, [1n, 2n, 3n, 4n]);
    const b = createMLE(3, F, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    expect(() => multiplyMLE(a, b)).toThrow();
  });

  it('AND function via multiply equals mleFromFunction AND', () => {
    // x1 * x2 as product of two identity MLEs
    const x1 = mleFromFunction(2, F, (bits) => BigInt(bits[0]!));
    const x2 = mleFromFunction(2, F, (bits) => BigInt(bits[1]!));
    const prod = multiplyMLE(x1, x2);

    const andFn = mleFromFunction(2, F, (bits) => BigInt(bits[0]! * bits[1]!));
    for (let i = 0; i < 4; i++) {
      expect(prod.evaluations[i]!.value).toBe(andFn.evaluations[i]!.value);
    }
  });
});
