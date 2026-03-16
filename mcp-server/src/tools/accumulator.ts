import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { modPow, isPrime, extendedGcd, modInverse } from "../lib/math.js";

// ---------------------------------------------------------------------------
// RSA accumulator parameters
// ---------------------------------------------------------------------------

/**
 * Composite modulus n = p * q where p and q are large (but toy-sized) primes.
 * These are fixed public parameters for the MCP demo — not suitable for
 * production use.
 */
const ACC_N = BigInt("1000000007") * BigInt("1000000009");

/** Generator element */
const ACC_G = 65537n;

// ---------------------------------------------------------------------------
// Accumulator arithmetic
// ---------------------------------------------------------------------------

function addElement(accValue: bigint, prime: bigint, n: bigint): bigint {
  return modPow(accValue, prime, n);
}

function batchAdd(accValue: bigint, primes: bigint[], n: bigint): bigint {
  let product = 1n;
  for (const prime of primes) product *= prime;
  return modPow(accValue, product, n);
}

function computeWitness(
  elements: bigint[],
  targetIndex: number,
  g: bigint,
  n: bigint
): bigint {
  let product = 1n;
  for (let i = 0; i < elements.length; i++) {
    if (i !== targetIndex) product *= elements[i]!;
  }
  return modPow(g, product, n);
}

function verifyWitness(
  witness: bigint,
  element: bigint,
  accValue: bigint,
  n: bigint
): boolean {
  return modPow(witness, element, n) === accValue;
}

/**
 * Modular exponentiation that accepts a potentially negative exponent.
 * For negative exp, computes (modInverse(base, mod))^(-exp) mod mod.
 */
function modPowSigned(base: bigint, exp: bigint, mod: bigint): bigint {
  if (exp >= 0n) return modPow(base, exp, mod);
  const inv = modInverse(base, mod);
  return modPow(inv, -exp, mod);
}

function computeNonMembershipWitness(
  elements: bigint[],
  target: bigint,
  g: bigint,
  n: bigint
): { witness: bigint; b: bigint } | null {
  if (elements.includes(target)) return null;
  let product = 1n;
  for (const el of elements) product *= el;
  const { x, y, gcd } = extendedGcd(target, product);
  if (gcd !== 1n) return null;
  const witness = modPowSigned(g, x, n);
  return { witness, b: y };
}

function verifyNonMembershipWitness(
  witness: bigint,
  b: bigint,
  target: bigint,
  accValue: bigint,
  g: bigint,
  n: bigint
): boolean {
  const left =
    (modPow(witness, target, n) * modPowSigned(accValue, b, n)) % n;
  return left === g % n;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerAccumulatorTools(server: McpServer): void {
  server.tool(
    "accumulator_create",
    "Create a new RSA accumulator with optional initial primes",
    {
      primes: z
        .array(z.number().int().positive())
        .optional()
        .describe("Initial prime numbers to add"),
    },
    async ({ primes }) => {
      try {
        const elements = (primes ?? []).map((p) => {
          if (!isPrime(p)) throw new Error(`${p} is not prime`);
          return BigInt(p);
        });
        let acc = ACC_G;
        if (elements.length > 0) acc = batchAdd(acc, elements, ACC_N);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  accumulator: acc.toString(),
                  g: ACC_G.toString(),
                  n: ACC_N.toString(),
                  elements: elements.map((e) => e.toString()),
                  elementCount: elements.length,
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
    "accumulator_add",
    "Add a prime element to an existing accumulator",
    {
      accumulator: z
        .string()
        .describe("Current accumulator value (as decimal string)"),
      prime: z.number().int().positive().describe("Prime number to add"),
    },
    async ({ accumulator, prime }) => {
      try {
        if (!isPrime(prime)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `${prime} is not prime` }),
              },
            ],
          };
        }
        const acc = BigInt(accumulator);
        const newAcc = addElement(acc, BigInt(prime), ACC_N);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  previousAccumulator: accumulator,
                  newAccumulator: newAcc.toString(),
                  addedPrime: prime,
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
    "accumulator_membership_witness",
    "Compute and verify a membership witness for an element in the accumulator",
    {
      elements: z
        .array(z.number().int().positive())
        .describe("All prime elements in the set"),
      elementIndex: z
        .number()
        .int()
        .min(0)
        .describe("Zero-based index of the element to prove membership for"),
    },
    async ({ elements, elementIndex }) => {
      try {
        const bigElements = elements.map((e) => BigInt(e));
        if (elementIndex >= bigElements.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Index out of range" }),
              },
            ],
          };
        }
        const acc = batchAdd(ACC_G, bigElements, ACC_N);
        const witness = computeWitness(bigElements, elementIndex, ACC_G, ACC_N);
        const element = bigElements[elementIndex]!;
        const verified = verifyWitness(witness, element, acc, ACC_N);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  element: element.toString(),
                  witness: witness.toString(),
                  accumulator: acc.toString(),
                  verified,
                  equation: `witness^element ≡ accumulator (mod n): ${witness.toString().slice(-8)}^${element} ≡ ${acc.toString().slice(-8)} (mod n)`,
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
    "accumulator_nonmembership_proof",
    "Prove that a prime is NOT in the accumulator set using the extended GCD Bezout identity",
    {
      elements: z
        .array(z.number().int().positive())
        .describe("All prime elements in the set"),
      target: z
        .number()
        .int()
        .positive()
        .describe("The prime to prove is not in the set"),
    },
    async ({ elements, target }) => {
      try {
        if (!isPrime(target)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `${target} is not prime` }),
              },
            ],
          };
        }
        const bigElements = elements.map((e) => BigInt(e));
        const bigTarget = BigInt(target);
        const acc = batchAdd(ACC_G, bigElements, ACC_N);
        const result = computeNonMembershipWitness(
          bigElements,
          bigTarget,
          ACC_G,
          ACC_N
        );
        if (!result) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `${target} is in the set or GCD check failed`,
                }),
              },
            ],
          };
        }
        const verified = verifyNonMembershipWitness(
          result.witness,
          result.b,
          bigTarget,
          acc,
          ACC_G,
          ACC_N
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  target,
                  witness: result.witness.toString(),
                  b: result.b.toString(),
                  accumulator: acc.toString(),
                  verified,
                  equation: "witness^target * acc^b ≡ g (mod n)",
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
    "accumulator_batch_add",
    "Add multiple primes to an accumulator in one step",
    {
      accumulator: z
        .string()
        .optional()
        .describe(
          "Current accumulator value as a decimal string (defaults to the generator)"
        ),
      primes: z
        .array(z.number().int().positive())
        .min(1)
        .describe("Prime numbers to add"),
    },
    async ({ accumulator, primes }) => {
      try {
        for (const p of primes) {
          if (!isPrime(p)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ error: `${p} is not prime` }),
                },
              ],
            };
          }
        }
        const acc = accumulator ? BigInt(accumulator) : ACC_G;
        const bigPrimes = primes.map((p) => BigInt(p));
        const newAcc = batchAdd(acc, bigPrimes, ACC_N);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  previousAccumulator: acc.toString(),
                  newAccumulator: newAcc.toString(),
                  addedPrimes: primes,
                  addedCount: primes.length,
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
