import { sha256 } from '@/lib/hash';
import {
  polynomialEvaluate,
  lagrangeInterpolation,
} from '@/lib/math';

/**
 * Evaluates a polynomial at a given x value
 */
export function evaluatePolynomial(coeffs: number[], x: number): number {
  return polynomialEvaluate(coeffs, x);
}

/**
 * Computes the quotient polynomial q(x) where p(x) = (x - z) * q(x) + p(z)
 * Uses synthetic division
 */
export function computeQuotientPolynomial(coeffs: number[], z: number): number[] {
  if (coeffs.length === 0) return [];

  // Synthetic division of p(x) by (x - z)
  // coeffs[0] is constant term, coeffs[n] is highest degree term
  const n = coeffs.length;
  const quotient: number[] = new Array(n - 1);

  // Process from highest degree to lowest
  let remainder = coeffs[n - 1]!;
  quotient[n - 2] = remainder;

  for (let i = n - 2; i >= 1; i--) {
    remainder = coeffs[i]! + z * remainder;
    quotient[i - 1] = remainder;
  }

  return quotient;
}

/**
 * Simulates a KZG commitment by hashing the polynomial coefficients
 */
export async function simulateKzgCommit(coeffs: number[]): Promise<string> {
  const data = JSON.stringify(coeffs);
  return await sha256(data);
}

/**
 * Generates a random challenge point
 */
export function simulateKzgChallenge(): number {
  const randomValue = Math.random() * 10 - 5; // Range: [-5, 5]
  return Math.round(randomValue * 100) / 100; // Round to 2 decimal places
}

/**
 * Simulates KZG proof generation
 * Returns the revealed value p(z), quotient polynomial, and proof hash
 */
export async function simulateKzgProof(
  coeffs: number[],
  z: number
): Promise<{
  revealedValue: number;
  quotientPoly: number[];
  proofHash: string;
}> {
  const revealedValue = evaluatePolynomial(coeffs, z);
  const quotientPoly = computeQuotientPolynomial(coeffs, z);
  const proofHash = await sha256(JSON.stringify(quotientPoly));

  return {
    revealedValue,
    quotientPoly,
    proofHash,
  };
}

/**
 * Simulates KZG verification
 * Checks that the commitment matches and the proof is valid
 */
export async function simulateKzgVerify(
  commitment: string,
  z: number,
  pz: number,
  proofHash: string,
  coeffs: number[]
): Promise<boolean> {
  // Recompute commitment
  const recomputedCommitment = await simulateKzgCommit(coeffs);

  if (recomputedCommitment !== commitment) {
    return false;
  }

  // Verify that p(z) matches the revealed value
  const computedPz = evaluatePolynomial(coeffs, z);
  if (Math.abs(computedPz - pz) > 1e-6) {
    return false;
  }

  // Verify the proof hash
  const quotientPoly = computeQuotientPolynomial(coeffs, z);
  const recomputedProofHash = await sha256(JSON.stringify(quotientPoly));

  return recomputedProofHash === proofHash;
}

/**
 * Fits a polynomial through Lagrange interpolation points
 */
export function fitLagrangePolynomial(
  points: { x: number; y: number }[]
): number[] {
  if (points.length === 0) return [];
  return lagrangeInterpolation(points);
}

/**
 * Generates plot points for a polynomial curve
 */
export function generatePlotPoints(
  coeffs: number[],
  xMin: number,
  xMax: number,
  count: number = 400
): { x: number; y: number }[] {
  if (coeffs.length === 0) return [];

  const points: { x: number; y: number }[] = [];
  const step = (xMax - xMin) / (count - 1);

  for (let i = 0; i < count; i++) {
    const x = xMin + i * step;
    const y = evaluatePolynomial(coeffs, x);
    points.push({ x, y });
  }

  return points;
}

/**
 * Automatically scales the view to fit the polynomial
 */
export function autoScale(
  coeffs: number[],
  xRange: [number, number]
): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
} {
  const [xMin, xMax] = xRange;
  const points = generatePlotPoints(coeffs, xMin, xMax, 100);

  if (points.length === 0) {
    return { xMin, xMax, yMin: -10, yMax: 10 };
  }

  let yMin = points[0]?.y ?? 0;
  let yMax = points[0]?.y ?? 0;

  for (const point of points) {
    yMin = Math.min(yMin, point.y);
    yMax = Math.max(yMax, point.y);
  }

  // Add 10% padding
  const yPadding = (yMax - yMin) * 0.1;
  yMin -= yPadding;
  yMax += yPadding;

  // Ensure minimum range
  if (yMax - yMin < 1) {
    const center = (yMax + yMin) / 2;
    yMin = center - 0.5;
    yMax = center + 0.5;
  }

  return { xMin, xMax, yMin, yMax };
}
