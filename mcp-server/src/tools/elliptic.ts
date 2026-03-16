import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CurveConfig, CurvePoint, ScalarStep } from "../lib/types.js";

// ---------------------------------------------------------------------------
// Default curve: y² = x³ + 2x + 3 (mod 97)
// ---------------------------------------------------------------------------

const DEFAULT_CURVE: CurveConfig = { p: 97, a: 2, b: 3 };

// ---------------------------------------------------------------------------
// Finite-field arithmetic
// ---------------------------------------------------------------------------

function mod(value: number, p: number): number {
  return ((value % p) + p) % p;
}

/** Extended Euclidean modular inverse for a small (number-range) modulus. */
function ecModInverse(value: number, p: number): number {
  let t = 0;
  let newT = 1;
  let r = p;
  let newR = mod(value, p);

  while (newR !== 0) {
    const quotient = Math.floor(r / newR);
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r !== 1) throw new Error("Inverse does not exist");
  return mod(t, p);
}

// ---------------------------------------------------------------------------
// Curve validation and point operations
// ---------------------------------------------------------------------------

function isPrimeLocal(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

function isCurveValid(curve: CurveConfig): boolean {
  if (!isPrimeLocal(curve.p) || curve.p < 3) return false;
  // Non-singularity: 4a³ + 27b² ≢ 0 (mod p)
  const disc = mod(
    4 * curve.a * curve.a * curve.a + 27 * curve.b * curve.b,
    curve.p
  );
  return disc !== 0;
}

function isOnCurve(point: CurvePoint | null, curve: CurveConfig): boolean {
  if (point === null) return true; // point at infinity is always on the curve
  const left = mod(point.y * point.y, curve.p);
  const right = mod(
    point.x * point.x * point.x + curve.a * point.x + curve.b,
    curve.p
  );
  return left === right;
}

function enumerateCurvePoints(curve: CurveConfig): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let x = 0; x < curve.p; x++) {
    const rhs = mod(x * x * x + curve.a * x + curve.b, curve.p);
    for (let y = 0; y < curve.p; y++) {
      if (mod(y * y, curve.p) === rhs) points.push({ x, y });
    }
  }
  return points;
}

function addPoints(
  p1: CurvePoint | null,
  p2: CurvePoint | null,
  curve: CurveConfig
): CurvePoint | null {
  if (p1 === null) return p2;
  if (p2 === null) return p1;
  // Additive inverse — result is the point at infinity
  if (p1.x === p2.x && mod(p1.y + p2.y, curve.p) === 0) return null;

  const slope =
    p1.x === p2.x && p1.y === p2.y
      ? mod(
          (3 * p1.x * p1.x + curve.a) * ecModInverse(2 * p1.y, curve.p),
          curve.p
        )
      : mod(
          (p2.y - p1.y) * ecModInverse(p2.x - p1.x, curve.p),
          curve.p
        );

  const x3 = mod(slope * slope - p1.x - p2.x, curve.p);
  const y3 = mod(slope * (p1.x - x3) - p1.y, curve.p);
  return { x: x3, y: y3 };
}

function scalarMultiply(
  point: CurvePoint | null,
  scalar: number,
  curve: CurveConfig
): { result: CurvePoint | null; steps: ScalarStep[] } {
  let accumulator: CurvePoint | null = null;
  let current = point;
  let k = scalar;
  const steps: ScalarStep[] = [];

  while (k > 0 && current) {
    const bit = k & 1;
    if (bit === 1) {
      accumulator = addPoints(accumulator, current, curve);
      steps.push({ type: "add", scalarBit: bit, accumulator });
    }
    current = addPoints(current, current, curve);
    steps.push({ type: "double", scalarBit: bit, accumulator: current });
    k >>= 1;
  }

  return { result: accumulator, steps };
}

function pointLabel(point: CurvePoint | null): string {
  return point ? `(${point.x}, ${point.y})` : "∞";
}

// ---------------------------------------------------------------------------
// Shared schema
// ---------------------------------------------------------------------------

const curveConfigSchema = z
  .object({
    p: z.number().int().min(3).describe("Prime field order"),
    a: z.number().int().describe("Curve parameter a"),
    b: z.number().int().describe("Curve parameter b"),
  })
  .optional()
  .describe(
    "Curve y² = x³ + ax + b (mod p). Defaults to y² = x³ + 2x + 3 (mod 97)"
  );

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerEllipticTools(server: McpServer): void {
  server.tool(
    "elliptic_enumerate",
    "Enumerate all affine points on an elliptic curve over a finite field",
    { curve: curveConfigSchema },
    async ({ curve: curveInput }) => {
      try {
        const curve = curveInput ?? DEFAULT_CURVE;
        if (!isCurveValid(curve)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error:
                    "Invalid curve: p must be prime and discriminant 4a³ + 27b² must be non-zero mod p",
                }),
              },
            ],
          };
        }
        if (curve.p > 500) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Field too large (max p=500 for enumeration)",
                }),
              },
            ],
          };
        }
        const points = enumerateCurvePoints(curve);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  curve: `y² = x³ + ${curve.a}x + ${curve.b} (mod ${curve.p})`,
                  pointCount: points.length,
                  groupOrder: points.length + 1, // +1 for point at infinity
                  points: points.map((p) => pointLabel(p)),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: String(e) }) },
          ],
        };
      }
    }
  );

  server.tool(
    "elliptic_add",
    "Add two points on an elliptic curve over a finite field",
    {
      p1: z
        .object({ x: z.number().int(), y: z.number().int() })
        .nullable()
        .describe("First point (null for point at infinity)"),
      p2: z
        .object({ x: z.number().int(), y: z.number().int() })
        .nullable()
        .describe("Second point (null for point at infinity)"),
      curve: curveConfigSchema,
    },
    async ({ p1, p2, curve: curveInput }) => {
      try {
        const curve = curveInput ?? DEFAULT_CURVE;
        if (!isCurveValid(curve)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Invalid curve parameters" }),
              },
            ],
          };
        }
        const result = addPoints(p1, p2, curve);
        const resultOnCurve = isOnCurve(result, curve);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  p1: pointLabel(p1),
                  p2: pointLabel(p2),
                  result: pointLabel(result),
                  resultOnCurve,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: String(e) }) },
          ],
        };
      }
    }
  );

  server.tool(
    "elliptic_scalar_multiply",
    "Compute scalar multiplication kP on an elliptic curve using the double-and-add algorithm",
    {
      point: z
        .object({ x: z.number().int(), y: z.number().int() })
        .describe("Base point P"),
      scalar: z.number().int().min(1).describe("Scalar k"),
      curve: curveConfigSchema,
    },
    async ({ point, scalar, curve: curveInput }) => {
      try {
        const curve = curveInput ?? DEFAULT_CURVE;
        if (!isCurveValid(curve)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Invalid curve parameters" }),
              },
            ],
          };
        }
        const { result, steps } = scalarMultiply(point, scalar, curve);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  basePoint: pointLabel(point),
                  scalar,
                  result: pointLabel(result),
                  resultOnCurve: isOnCurve(result, curve),
                  steps: steps.map((s) => ({
                    type: s.type,
                    bit: s.scalarBit,
                    accumulator: pointLabel(s.accumulator),
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: String(e) }) },
          ],
        };
      }
    }
  );
}
