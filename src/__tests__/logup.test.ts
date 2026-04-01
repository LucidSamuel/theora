import { describe, it, expect } from 'vitest';
import { computeMultiplicities, logUpCheck } from '@/demos/lookup/logup';

const P = 101n; // GF(101)

describe('computeMultiplicities', () => {
  it('correctly counts occurrences', () => {
    const table = [1n, 2n, 3n, 5n];
    const wires = [2n, 5n, 2n, 3n, 5n, 5n];
    const m = computeMultiplicities(table, wires);

    expect(m.get(1n)).toBe(0);
    expect(m.get(2n)).toBe(2);
    expect(m.get(3n)).toBe(1);
    expect(m.get(5n)).toBe(3);
  });

  it('ignores wire values not in the table', () => {
    const table = [1n, 2n];
    const wires = [1n, 99n, 2n, 88n];
    const m = computeMultiplicities(table, wires);

    expect(m.get(1n)).toBe(1);
    expect(m.get(2n)).toBe(1);
    // 99 and 88 are not table values, so not in the map
    expect(m.has(99n)).toBe(false);
    expect(m.has(88n)).toBe(false);
  });

  it('returns zero multiplicities for unused table entries', () => {
    const table = [10n, 20n, 30n];
    const wires = [20n];
    const m = computeMultiplicities(table, wires);

    expect(m.get(10n)).toBe(0);
    expect(m.get(20n)).toBe(1);
    expect(m.get(30n)).toBe(0);
  });
});

describe('logUpCheck — valid lookups', () => {
  it('accepts a valid lookup where all wires are in the table', () => {
    const result = logUpCheck({
      tableValues: [1n, 2n, 3n],
      wireValues: [1n, 2n, 3n],
      beta: 7n,
      fieldSize: P,
    });

    expect(result.satisfied).toBe(true);
    expect(result.invalidWires).toEqual([]);
    expect(result.wireSum).toBe(result.tableSum);
  });

  it('works with repeated wire values (multiplicities > 1)', () => {
    const result = logUpCheck({
      tableValues: [1n, 2n, 3n],
      wireValues: [2n, 2n, 3n, 3n, 3n],
      beta: 11n,
      fieldSize: P,
    });

    expect(result.satisfied).toBe(true);
    expect(result.wireSum).toBe(result.tableSum);
    expect(result.multiplicities.get(1n)).toBe(0);
    expect(result.multiplicities.get(2n)).toBe(2);
    expect(result.multiplicities.get(3n)).toBe(3);
  });

  it('wire fractions sum equals table fractions sum', () => {
    const result = logUpCheck({
      tableValues: [5n, 10n, 15n, 20n],
      wireValues: [10n, 15n, 10n, 20n, 5n],
      beta: 13n,
      fieldSize: P,
    });

    expect(result.satisfied).toBe(true);

    // Independently verify: sum of wireFractions === wireSum
    let wireFracSum = 0n;
    for (const f of result.wireFractions) {
      wireFracSum = ((wireFracSum + f) % P + P) % P;
    }
    expect(wireFracSum).toBe(result.wireSum);

    // Independently verify: sum of tableFractions === tableSum
    let tableFracSum = 0n;
    for (const f of result.tableFractions) {
      tableFracSum = ((tableFracSum + f) % P + P) % P;
    }
    expect(tableFracSum).toBe(result.tableSum);
  });

  it('accepts a single wire looking up a single table entry', () => {
    const result = logUpCheck({
      tableValues: [42n],
      wireValues: [42n],
      beta: 3n,
      fieldSize: P,
    });

    expect(result.satisfied).toBe(true);
  });
});

describe('logUpCheck — invalid lookups', () => {
  it('rejects a wire value not in the table', () => {
    const result = logUpCheck({
      tableValues: [1n, 2n, 3n],
      wireValues: [1n, 99n],
      beta: 7n,
      fieldSize: P,
    });

    expect(result.satisfied).toBe(false);
    expect(result.invalidWires).toEqual([1]); // index 1 = value 99
  });

  it('reports multiple invalid wire indices', () => {
    const result = logUpCheck({
      tableValues: [10n, 20n],
      wireValues: [10n, 50n, 20n, 60n],
      beta: 5n,
      fieldSize: P,
    });

    expect(result.satisfied).toBe(false);
    expect(result.invalidWires).toEqual([1, 3]); // indices of 50 and 60
  });
});

describe('logUpCheck — step trace', () => {
  it('produces 5 steps for visualization', () => {
    const result = logUpCheck({
      tableValues: [1n, 2n],
      wireValues: [1n, 2n],
      beta: 7n,
      fieldSize: P,
    });

    expect(result.steps.length).toBe(5);
    expect(result.steps[0]!.stepName).toBe('Validate wires');
    expect(result.steps[1]!.stepName).toBe('Compute multiplicities');
    expect(result.steps[2]!.stepName).toBe('Wire fractions');
    expect(result.steps[3]!.stepName).toBe('Table fractions');
    expect(result.steps[4]!.stepName).toBe('LogUp check');
  });
});

describe('logUpCheck — different beta values', () => {
  it('satisfies the identity for multiple beta choices', () => {
    const table = [1n, 2n, 3n, 4n, 5n];
    const wires = [2n, 3n, 5n, 2n, 4n, 1n];

    // The LogUp identity should hold for any valid β that doesn't
    // collide with -tⱼ mod p (which would make β + tⱼ ≡ 0).
    // Table is [1..5], so avoid β = 96..100 (i.e. -5..-1 mod 101).
    for (const beta of [7n, 13n, 29n, 50n, 83n]) {
      const result = logUpCheck({
        tableValues: table,
        wireValues: wires,
        beta,
        fieldSize: P,
      });
      expect(result.satisfied).toBe(true);
      expect(result.wireSum).toBe(result.tableSum);
    }
  });
});
