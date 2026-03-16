import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fnv1a } from "../lib/hash.js";
import type { FiatShamirMode, TranscriptProof } from "../lib/types.js";

const MODULUS = 97;
const GENERATOR = 7;

function fsMod(value: number): number {
  return ((value % MODULUS) + MODULUS) % MODULUS;
}

function derivePublicKey(secret: number): number {
  return fsMod(GENERATOR * secret);
}

function deriveChallenge(mode: FiatShamirMode, statement: number, publicKey: number, commitment: number, verifierSeed: number): number {
  if (mode === 'interactive') return fsMod(verifierSeed % MODULUS);
  const transcript = mode === 'fs-correct' ? `${statement}|${publicKey}|${commitment}` : `${statement}|${publicKey}`;
  return fsMod(parseInt(fnv1a(transcript), 16));
}

function verifyFsProof(_statement: number, publicKey: number, commitment: number, challenge: number, response: number): boolean {
  return fsMod(GENERATOR * response) === fsMod(commitment + challenge * publicKey);
}

function simulateProof(mode: FiatShamirMode, statement: number, secret: number, nonce: number, verifierSeed: number): TranscriptProof {
  const publicKey = derivePublicKey(secret);
  const commitment = fsMod(GENERATOR * nonce);
  const challenge = deriveChallenge(mode, statement, publicKey, commitment, verifierSeed);
  const response = fsMod(nonce + challenge * secret);
  return { statement, publicKey, commitment, challenge, response, valid: verifyFsProof(statement, publicKey, commitment, challenge, response) };
}

function simulateStatement(secret: number): number {
  return fsMod(secret * 11);
}

function forgePredictableProof(statement: number, publicKey: number, mode: FiatShamirMode): TranscriptProof | null {
  if (mode !== 'fs-broken') return null;
  const challenge = deriveChallenge('fs-broken', statement, publicKey, 0, 0);
  const response = 37;
  const commitment = fsMod(GENERATOR * response - challenge * publicKey);
  return { statement, publicKey, commitment, challenge, response, valid: verifyFsProof(statement, publicKey, commitment, challenge, response) };
}

export function registerFiatShamirTools(server: McpServer) {
  server.tool(
    "fiat_shamir_interactive",
    "Simulate an interactive Schnorr-like proof with a random verifier challenge",
    {
      secret: z.number().int().min(1).describe("Prover's secret"),
      nonce: z.number().int().min(1).optional().describe("Prover's nonce (random if omitted)"),
      verifierSeed: z.number().int().optional().describe("Verifier's random seed"),
    },
    async ({ secret, nonce, verifierSeed }) => {
      const actualNonce = nonce ?? (Math.floor(Math.random() * 90) + 1);
      const actualSeed = verifierSeed ?? (Math.floor(Math.random() * 90) + 1);
      const statement = simulateStatement(secret);
      const proof = simulateProof('interactive', statement, secret, actualNonce, actualSeed);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            mode: "interactive",
            ...proof,
            transcript: [
              { step: "statement", value: statement },
              { step: "publicKey", value: proof.publicKey, derivation: `g*secret = ${GENERATOR}*${secret} mod ${MODULUS}` },
              { step: "commitment", value: proof.commitment, derivation: `g*nonce = ${GENERATOR}*${actualNonce} mod ${MODULUS}` },
              { step: "challenge", value: proof.challenge, derivation: `verifier random seed: ${actualSeed}` },
              { step: "response", value: proof.response, derivation: `nonce + challenge*secret mod ${MODULUS}` },
            ],
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "fiat_shamir_noninteractive",
    "Simulate a non-interactive proof using Fiat-Shamir heuristic (correct or broken mode)",
    {
      secret: z.number().int().min(1).describe("Prover's secret"),
      nonce: z.number().int().min(1).optional().describe("Prover's nonce"),
      mode: z.enum(["fs-correct", "fs-broken"]).default("fs-correct").describe("fs-correct includes commitment in hash, fs-broken omits it"),
    },
    async ({ secret, nonce, mode }) => {
      const actualNonce = nonce ?? (Math.floor(Math.random() * 90) + 1);
      const statement = simulateStatement(secret);
      const proof = simulateProof(mode, statement, secret, actualNonce, 0);
      const secure = mode === 'fs-correct';
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            mode,
            secure,
            ...proof,
            explanation: secure
              ? "Challenge derived from full transcript (statement|publicKey|commitment) — cannot be predicted before commitment"
              : "Challenge derived from partial transcript (statement|publicKey only) — attacker can predict challenge before choosing commitment",
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "fiat_shamir_forge",
    "Attempt to forge a proof by exploiting the broken Fiat-Shamir transcript",
    {
      secret: z.number().int().min(1).describe("Target's secret (to derive public key)"),
    },
    async ({ secret }) => {
      const statement = simulateStatement(secret);
      const publicKey = derivePublicKey(secret);
      const forgery = forgePredictableProof(statement, publicKey, 'fs-broken');
      const correctAttempt = forgePredictableProof(statement, publicKey, 'fs-correct');
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            targetPublicKey: publicKey,
            statement,
            brokenModeForgery: forgery ? { ...forgery, accepted: forgery.valid, explanation: "Forgery works because challenge is predictable (commitment not in transcript hash)" } : null,
            correctModeAttempt: correctAttempt ? { ...correctAttempt, accepted: correctAttempt.valid } : { accepted: false, explanation: "Cannot forge — challenge depends on commitment, creating circular dependency" },
          }, null, 2),
        }],
      };
    }
  );
}
