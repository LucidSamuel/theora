import { modPow, isPrime } from '@/lib/math';
import { extendedGcd, modInverse, gcd } from '@/lib/math';

export const ACC_P = 1000000007n;
export const ACC_Q = 1000000009n;
export const ACC_N = ACC_P * ACC_Q;
export const ACC_G = 65537n;
export const ACCUMULATOR_PRIME_POOL = Object.freeze(
  Array.from({ length: 997 - 3 + 1 }, (_, index) => index + 3).filter((candidate) => isPrime(candidate))
);

/**
 * Add an element to the accumulator
 * acc' = acc^prime mod n
 */
export function addElement(accValue: bigint, prime: bigint, n: bigint): bigint {
  return modPow(accValue, prime, n);
}

/**
 * Remove an element from the accumulator by recomputing from scratch
 * Excludes the element at removedIndex
 */
export function removeElement(
  elements: bigint[],
  removedIndex: number,
  g: bigint,
  n: bigint
): bigint {
  let product = 1n;
  for (let i = 0; i < elements.length; i++) {
    if (i !== removedIndex) {
      product *= elements[i]!;
    }
  }
  return modPow(g, product, n);
}

/**
 * Add multiple elements to the accumulator in batch
 * acc' = acc^(product of primes) mod n
 */
export function batchAdd(accValue: bigint, primes: bigint[], n: bigint): bigint {
  let product = 1n;
  for (const prime of primes) {
    product *= prime;
  }
  return modPow(accValue, product, n);
}

/**
 * Compute witness for an element
 * witness = g^(product of all elements except target) mod n
 */
export function computeWitness(
  elements: bigint[],
  targetIndex: number,
  g: bigint,
  n: bigint
): bigint {
  let product = 1n;
  for (let i = 0; i < elements.length; i++) {
    if (i !== targetIndex) {
      product *= elements[i]!;
    }
  }
  return modPow(g, product, n);
}

/**
 * Verify a witness for an element
 * Check: witness^element ≡ acc (mod n)
 */
export function verifyWitness(
  witness: bigint,
  element: bigint,
  accValue: bigint,
  n: bigint
): boolean {
  return modPow(witness, element, n) === accValue;
}

function modPowSigned(base: bigint, exp: bigint, mod: bigint): bigint {
  if (exp >= 0n) return modPow(base, exp, mod);
  const inv = modInverse(base, mod);
  return modPow(inv, -exp, mod);
}

export function computeNonMembershipWitness(
  elements: bigint[],
  target: bigint,
  g: bigint,
  n: bigint
): { witness: bigint; b: bigint } | null {
  if (elements.includes(target)) return null;
  let product = 1n;
  for (const el of elements) {
    product *= el;
  }
  const { x, y, gcd } = extendedGcd(target, product);
  if (gcd !== 1n) return null;
  const a = x;
  const b = y;
  const witness = modPowSigned(g, a, n);
  return { witness, b };
}

export function verifyNonMembershipWitness(
  witness: bigint,
  b: bigint,
  target: bigint,
  accValue: bigint,
  g: bigint,
  n: bigint
): boolean {
  // Check: witness^target * acc^b == g (mod n)
  const left = (modPow(witness, target, n) * modPowSigned(accValue, b, n)) % n;
  return left === (g % n);
}

/**
 * Generate a random prime number between 3 and 997
 */
export function randomPrime(): number {
  const min = 3;
  const max = 997;
  const candidate = Math.floor(Math.random() * (max - min + 1)) + min;

  // Find next prime starting from candidate
  let current = candidate;
  while (current <= max) {
    if (isPrime(current)) {
      return current;
    }
    current++;
  }

  // If we didn't find one forward, search backward
  current = candidate - 1;
  while (current >= min) {
    if (isPrime(current)) {
      return current;
    }
    current--;
  }

  // Fallback to a known prime
  return 3;
}

export function pickRandomAvailablePrime(usedPrimes: bigint[]): number | null {
  const used = new Set(usedPrimes.map((prime) => prime.toString()));
  const available = ACCUMULATOR_PRIME_POOL.filter((prime) => !used.has(String(prime)));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index] ?? null;
}

export function forgeToyMembershipWitness(accValue: bigint, target: bigint): bigint | null {
  if (target <= 1n) return null;
  const phi = (ACC_P - 1n) * (ACC_Q - 1n);
  if (gcd(target, phi) !== 1n) return null;
  const inverse = modInverse(target, phi);
  return modPow(accValue, inverse, ACC_N);
}

/**
 * Get orbital parameters for an element based on its index
 * Distributes elements in concentric rings of 6 elements each
 */
export function getOrbitalParams(
  index: number,
  total: number
): { radius: number; speed: number; angle: number } {
  const elementsPerRing = 6;
  const ringIndex = Math.floor(index / elementsPerRing);
  const positionInRing = index % elementsPerRing;

  const baseRadius = 120;
  const ringSpacing = 70;
  const radius = baseRadius + ringIndex * ringSpacing;

  // Different rings rotate at different speeds
  const baseSpeed = 0.3;
  const speed = baseSpeed * (1 + ringIndex * 0.2);

  // Distribute elements evenly around the ring
  const elementsInCurrentRing = Math.min(elementsPerRing, total - ringIndex * elementsPerRing);
  const angle = (positionInRing / elementsInCurrentRing) * Math.PI * 2;

  return { radius, speed, angle };
}

export function computeWitnessCascade(
  beforeElements: { label: string; prime: bigint }[],
  afterElements: { label: string; prime: bigint }[],
  g: bigint,
  n: bigint
): Array<{
  label: string;
  prime: bigint;
  witnessBefore: bigint | null;
  witnessAfter: bigint;
  changed: boolean;
}> {
  const beforePrimes = beforeElements.map((element) => element.prime);
  const afterPrimes = afterElements.map((element) => element.prime);
  const beforeMap = new Map<string, bigint>();

  beforeElements.forEach((element, index) => {
    beforeMap.set(element.label, computeWitness(beforePrimes, index, g, n));
  });

  return afterElements.map((element, index) => {
    const witnessBefore = beforeMap.get(element.label) ?? null;
    const witnessAfter = computeWitness(afterPrimes, index, g, n);
    return {
      label: element.label,
      prime: element.prime,
      witnessBefore,
      witnessAfter,
      changed: witnessBefore === null || witnessBefore !== witnessAfter,
    };
  });
}
