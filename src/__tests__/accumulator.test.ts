import { describe, it, expect } from 'vitest';
import {
  ACC_N,
  ACC_G,
  addElement,
  removeElement,
  batchAdd,
  computeWitness,
  computeWitnessCascade,
  verifyWitness,
  computeNonMembershipWitness,
  verifyNonMembershipWitness,
  randomPrime,
  pickRandomAvailablePrime,
  forgeToyMembershipWitness,
  ACCUMULATOR_PRIME_POOL,
  getOrbitalParams,
} from '@/demos/accumulator/logic';
import { isPrime } from '@/lib/math';

describe('addElement', () => {
  it('accumulates a single prime', () => {
    const acc = addElement(ACC_G, 3n, ACC_N);
    expect(acc).toBeTypeOf('bigint');
    expect(acc).not.toBe(ACC_G);
  });

  it('produces different values for different primes', () => {
    const a1 = addElement(ACC_G, 3n, ACC_N);
    const a2 = addElement(ACC_G, 5n, ACC_N);
    expect(a1).not.toBe(a2);
  });
});

describe('batchAdd', () => {
  it('produces same result as sequential adds', () => {
    let acc = ACC_G;
    acc = addElement(acc, 3n, ACC_N);
    acc = addElement(acc, 5n, ACC_N);
    acc = addElement(acc, 7n, ACC_N);

    const batch = batchAdd(ACC_G, [3n, 5n, 7n], ACC_N);
    expect(batch).toBe(acc);
  });

  it('returns unchanged value for empty array', () => {
    // batchAdd multiplies primes (product=1), then modPow(acc, 1, n) = acc
    const result = batchAdd(ACC_G, [], ACC_N);
    expect(result).toBe(ACC_G);
  });
});

describe('removeElement', () => {
  it('recomputes accumulator without the removed element', () => {
    const primes = [3n, 5n, 7n];
    const acc = removeElement(primes, 1, ACC_G, ACC_N); // remove 5
    const expected = batchAdd(ACC_G, [3n, 7n], ACC_N);
    expect(acc).toBe(expected);
  });
});

describe('witness verification', () => {
  it('computes and verifies a valid witness', () => {
    const primes = [3n, 5n, 7n, 11n];
    const acc = batchAdd(ACC_G, primes, ACC_N);
    const witness = computeWitness(primes, 2, ACC_G, ACC_N); // witness for 7
    const verified = verifyWitness(witness, 7n, acc, ACC_N);
    expect(verified).toBe(true);
  });

  it('rejects an invalid witness', () => {
    const primes = [3n, 5n, 7n];
    const acc = batchAdd(ACC_G, primes, ACC_N);
    const witness = computeWitness(primes, 0, ACC_G, ACC_N); // witness for 3
    // Try to verify with wrong element
    const verified = verifyWitness(witness, 5n, acc, ACC_N);
    expect(verified).toBe(false);
  });
});

describe('non-membership', () => {
  it('computes and verifies non-membership for an absent prime', () => {
    const primes = [3n, 5n, 7n];
    const acc = batchAdd(ACC_G, primes, ACC_N);
    const result = computeNonMembershipWitness(primes, 11n, ACC_G, ACC_N);
    expect(result).not.toBeNull();

    if (result) {
      const verified = verifyNonMembershipWitness(
        result.witness,
        result.b,
        11n,
        acc,
        ACC_G,
        ACC_N
      );
      expect(verified).toBe(true);
    }
  });

  it('returns null for a member prime', () => {
    const primes = [3n, 5n, 7n];
    const result = computeNonMembershipWitness(primes, 5n, ACC_G, ACC_N);
    expect(result).toBeNull();
  });
});

describe('randomPrime', () => {
  it('returns a prime between 3 and 997', () => {
    for (let i = 0; i < 20; i++) {
      const p = randomPrime();
      expect(p).toBeGreaterThanOrEqual(3);
      expect(p).toBeLessThanOrEqual(997);
      expect(isPrime(p)).toBe(true);
    }
  });
});

describe('pickRandomAvailablePrime', () => {
  it('returns the only remaining prime when one candidate is left', () => {
    const remaining = ACCUMULATOR_PRIME_POOL[0]!;
    const used = ACCUMULATOR_PRIME_POOL.slice(1).map((prime) => BigInt(prime));
    expect(pickRandomAvailablePrime(used)).toBe(remaining);
  });

  it('returns null when the entire pool is exhausted', () => {
    const used = ACCUMULATOR_PRIME_POOL.map((prime) => BigInt(prime));
    expect(pickRandomAvailablePrime(used)).toBeNull();
  });
});

describe('forgeToyMembershipWitness', () => {
  it('forges a valid witness for an absent prime on the toy modulus', () => {
    const primes = [3n, 5n, 11n, 13n];
    const acc = batchAdd(ACC_G, primes, ACC_N);
    const forged = forgeToyMembershipWitness(acc, 17n);
    expect(forged).not.toBeNull();
    expect(verifyWitness(forged!, 17n, acc, ACC_N)).toBe(true);
    expect(primes.includes(17n)).toBe(false);
  });

  it('returns null when the target has no inverse modulo φ(n)', () => {
    const acc = batchAdd(ACC_G, [5n, 11n], ACC_N);
    expect(forgeToyMembershipWitness(acc, 3n)).toBeNull();
  });
});

describe('getOrbitalParams', () => {
  it('returns increasing radii for higher indices', () => {
    const p0 = getOrbitalParams(0, 12);
    const p6 = getOrbitalParams(6, 12);
    expect(p6.radius).toBeGreaterThan(p0.radius);
  });

  it('distributes angles evenly within a ring', () => {
    const p0 = getOrbitalParams(0, 6);
    const p1 = getOrbitalParams(1, 6);
    const angleDiff = Math.abs(p1.angle - p0.angle);
    expect(angleDiff).toBeCloseTo(Math.PI / 3, 3);
  });
});

describe('computeWitnessCascade', () => {
  it('marks surviving witnesses as changed after an addition', () => {
    const before = [
      { label: 'e0', prime: 3n },
      { label: 'e1', prime: 5n },
    ];
    const after = [
      ...before,
      { label: 'e2', prime: 7n },
    ];
    const cascade = computeWitnessCascade(before, after, ACC_G, ACC_N);
    expect(cascade).toHaveLength(3);
    expect(cascade[0]!.changed).toBe(true);
    expect(cascade[1]!.changed).toBe(true);
    expect(cascade[2]!.witnessBefore).toBeNull();
  });
});
