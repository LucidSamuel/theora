import { fnv1a } from '@/lib/hash';

export type FiatShamirMode = 'interactive' | 'fs-correct' | 'fs-broken';

export interface TranscriptProof {
  statement: number;
  publicKey: number;
  commitment: number;
  challenge: number;
  response: number;
  valid: boolean;
}

export interface ImportedTranscriptTrace {
  source: 'pipeline';
  commitment: string;
  publicOutput: number;
  transcriptInputs: string[];
  challenge: number;
  detail: string;
  predictable: boolean;
}

const MODULUS = 97;
const GENERATOR = 7;

export function derivePublicKey(secret: number): number {
  return mod(GENERATOR * secret);
}

export function deriveChallenge(mode: FiatShamirMode, statement: number, publicKey: number, commitment: number, verifierSeed: number): number {
  if (mode === 'interactive') {
    return mod(verifierSeed % MODULUS);
  }
  const transcript = mode === 'fs-correct'
    ? `${statement}|${publicKey}|${commitment}`
    : `${statement}|${publicKey}`;
  return mod(parseInt(fnv1a(transcript), 16));
}

export function simulateProof(
  mode: FiatShamirMode,
  statement: number,
  secret: number,
  nonce: number,
  verifierSeed: number
): TranscriptProof {
  const publicKey = derivePublicKey(secret);
  const commitment = mod(GENERATOR * nonce);
  const challenge = deriveChallenge(mode, statement, publicKey, commitment, verifierSeed);
  const response = mod(nonce + challenge * secret);
  return {
    statement,
    publicKey,
    commitment,
    challenge,
    response,
    valid: verifyProof(statement, publicKey, commitment, challenge, response),
  };
}

export function verifyProof(
  _statement: number,
  publicKey: number,
  commitment: number,
  challenge: number,
  response: number
): boolean {
  const left = mod(GENERATOR * response);
  const right = mod(commitment + challenge * publicKey);
  return left === right;
}

export function simulateStatement(secret: number): number {
  return mod(secret * 11);
}

export function forgePredictableProof(statement: number, publicKey: number, mode: FiatShamirMode): TranscriptProof | null {
  if (mode !== 'fs-broken') return null;
  const challenge = deriveChallenge('fs-broken', statement, publicKey, 0, 0);
  const response = 37;
  const commitment = mod(GENERATOR * response - challenge * publicKey);
  return {
    statement,
    publicKey,
    commitment,
    challenge,
    response,
    valid: verifyProof(statement, publicKey, commitment, challenge, response),
  };
}

function mod(value: number): number {
  return ((value % MODULUS) + MODULUS) % MODULUS;
}
