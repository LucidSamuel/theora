import { modPow, isPrime } from '@/lib/math';
import { extendedGcd, modInverse } from '@/lib/math';

export const ACC_N = BigInt("1000000007") * BigInt("1000000009");
export const ACC_G = 65537n;

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
