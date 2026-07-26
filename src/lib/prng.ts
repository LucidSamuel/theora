/**
 * Deterministic seeded PRNG (sfc32) for reproducible generative visuals.
 *
 * Used by the proof-trace fingerprint: the transcript hash seeds the
 * generator, so the same trace always produces the same drawing spec.
 */

/** sfc32 — small fast counter PRNG. Returns floats in [0, 1). */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  };
}

/** First 32 hex chars of a digest -> 4 big-endian uint32 seeds. */
export function seedFromHex(hex: string): [number, number, number, number] {
  if (!/^[0-9a-fA-F]{32,}$/.test(hex)) {
    throw new Error('seedFromHex requires at least 32 hex characters');
  }
  const word = (offset: number): number => parseInt(hex.slice(offset, offset + 8), 16) >>> 0;
  return [word(0), word(8), word(16), word(24)];
}

export interface Rng {
  nextFloat(): number;
  nextInt(min: number, max: number): number; // inclusive bounds
  pick<T>(arr: readonly T[]): T;
}

export function makeRng(hex: string): Rng {
  const [a, b, c, d] = seedFromHex(hex);
  const next = sfc32(a, b, c, d);
  return {
    nextFloat: () => next(),
    nextInt: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error('pick from empty array');
      return arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))]!;
    },
  };
}
