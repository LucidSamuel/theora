import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sha256 } from "../lib/hash.js";
import { polynomialEvaluate, lagrangeInterpolation } from "../lib/math.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the quotient polynomial q(x) such that:
 *   p(x) - p(z) = (x - z) * q(x)
 *
 * Uses synthetic division (Horner) starting from the leading coefficient.
 * Returns an empty array for a zero-degree polynomial.
 */
function computeQuotientPolynomial(coeffs: number[], zVal: number): number[] {
  if (coeffs.length === 0) return [];
  const n = coeffs.length;
  // quotient has degree n-2 (one less than the dividend)
  const quotient: number[] = new Array<number>(n - 1);
  let remainder = coeffs[n - 1]!;
  quotient[n - 2] = remainder;
  for (let i = n - 2; i >= 1; i--) {
    remainder = coeffs[i]! + zVal * remainder;
    quotient[i - 1] = remainder;
  }
  return quotient;
}

/**
 * Format a coefficient array as a human-readable polynomial string.
 * e.g. [5, 1, 1] => "x^2 + x + 5"
 */
function formatPolynomial(coeffs: number[]): string {
  if (coeffs.length === 0) return "0";
  const terms: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i]!;
    if (Math.abs(c) < 1e-10) continue;
    const absC = Math.abs(c);
    const sign = c < 0 ? "-" : terms.length > 0 ? "+" : "";
    if (i === 0) {
      terms.push(`${sign}${absC}`);
    } else if (i === 1) {
      terms.push(`${sign}${absC === 1 ? "" : absC}x`);
    } else {
      terms.push(`${sign}${absC === 1 ? "" : absC}x^${i}`);
    }
  }
  return terms.join(" ") || "0";
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerPolynomialTools(server: McpServer): void {
  server.tool(
    "polynomial_evaluate",
    "Evaluate a polynomial at a given x value. Coefficients are [constant, linear, quadratic, ...]",
    {
      coefficients: z
        .array(z.number())
        .min(1)
        .describe(
          "Polynomial coefficients [a0, a1, a2, ...] where p(x) = a0 + a1*x + a2*x² + ..."
        ),
      x: z.number().describe("The x value to evaluate at"),
    },
    async ({ coefficients, x }) => {
      const y = polynomialEvaluate(coefficients, x);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { y, polynomial: formatPolynomial(coefficients), x },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "polynomial_interpolate",
    "Fit a polynomial through given points using Lagrange interpolation",
    {
      points: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(1)
        .describe("Points to interpolate through"),
    },
    async ({ points }) => {
      const coefficients = lagrangeInterpolation(points);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                coefficients,
                degree: coefficients.length - 1,
                polynomial: formatPolynomial(coefficients),
                verification: points.map((p) => ({
                  x: p.x,
                  y: p.y,
                  evaluated: polynomialEvaluate(coefficients, p.x),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "polynomial_kzg_commit",
    "Simulate a KZG commitment by hashing the polynomial coefficients",
    {
      coefficients: z
        .array(z.number())
        .min(1)
        .describe("Polynomial coefficients"),
    },
    async ({ coefficients }) => {
      const commitment = sha256(JSON.stringify(coefficients));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { commitment, polynomial: formatPolynomial(coefficients) },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "polynomial_kzg_open",
    "Open a KZG commitment at a challenge point z. Returns p(z), the quotient polynomial, and a proof hash",
    {
      coefficients: z
        .array(z.number())
        .min(1)
        .describe("Polynomial coefficients"),
      challengePoint: z.number().describe("The challenge point z"),
    },
    async ({ coefficients, challengePoint }) => {
      const evaluation = polynomialEvaluate(coefficients, challengePoint);
      const quotientCoefficients = computeQuotientPolynomial(
        coefficients,
        challengePoint
      );
      const proof = sha256(JSON.stringify(quotientCoefficients));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                challengePoint,
                evaluation,
                quotientCoefficients,
                quotientPolynomial: formatPolynomial(quotientCoefficients),
                proof,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "polynomial_kzg_verify",
    "Verify a KZG proof: check commitment, evaluation, and quotient consistency",
    {
      coefficients: z
        .array(z.number())
        .min(1)
        .describe("Original polynomial coefficients"),
      commitment: z.string().describe("The commitment hash"),
      challengePoint: z.number().describe("The challenge point z"),
      evaluation: z.number().describe("The claimed p(z) value"),
      proof: z.string().describe("The proof hash"),
    },
    async ({ coefficients, commitment, challengePoint, evaluation, proof }) => {
      const recomputedCommitment = sha256(JSON.stringify(coefficients));
      const commitmentValid = recomputedCommitment === commitment;

      const computedEval = polynomialEvaluate(coefficients, challengePoint);
      const evaluationValid = Math.abs(computedEval - evaluation) < 1e-6;

      const quotient = computeQuotientPolynomial(coefficients, challengePoint);
      const recomputedProof = sha256(JSON.stringify(quotient));
      const proofValid = recomputedProof === proof;

      const valid = commitmentValid && evaluationValid && proofValid;

      const failureReasons: string[] = [];
      if (!commitmentValid) failureReasons.push("commitment mismatch");
      if (!evaluationValid) {
        failureReasons.push(
          `evaluation mismatch (expected ${computedEval}, got ${evaluation})`
        );
      }
      if (!proofValid) failureReasons.push("proof hash mismatch");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                valid,
                commitmentValid,
                evaluationValid,
                proofValid,
                reason: valid ? "All checks passed" : failureReasons.join(", "),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
