// ── Hash ─────────────────────────────────────────────────────────
export type HashFunction = 'sha256' | 'fnv1a';

// ── Merkle ───────────────────────────────────────────────────────
export interface MerkleNode {
  id: string;
  hash: string;
  data?: string;
  left?: MerkleNode;
  right?: MerkleNode;
  depth: number;
  index: number;
}

export interface MerkleTree {
  root: MerkleNode;
  leaves: MerkleNode[];
  depth: number;
  nodeCount: number;
}

export interface MerkleProof {
  leafIndex: number;
  leafHash: string;
  siblings: { hash: string; position: 'left' | 'right' }[];
  root: string;
}

// ── Recursive ────────────────────────────────────────────────────
export type Curve = 'pallas' | 'vesta';
export type ProofStatus = 'pending' | 'verifying' | 'verified' | 'failed';

export interface ProofNode {
  id: string;
  depth: number;
  index: number;
  curve: Curve;
  status: ProofStatus;
  label: string;
  children: ProofNode[];
  isBadProof: boolean;
}

export interface IvcStep {
  id: string;
  index: number;
  curve: Curve;
  status: ProofStatus;
  accumulatorHash: string;
  inputValue: number;
  folded: boolean;
}

export interface IvcChain {
  steps: IvcStep[];
  currentFoldIndex: number;
}

// ── Elliptic ─────────────────────────────────────────────────────
export interface CurveConfig {
  p: number;
  a: number;
  b: number;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface ScalarStep {
  type: 'double' | 'add';
  scalarBit: number;
  accumulator: CurvePoint | null;
}

// ── Fiat-Shamir ──────────────────────────────────────────────────
export type FiatShamirMode = 'interactive' | 'fs-correct' | 'fs-broken';

export interface TranscriptProof {
  statement: number;
  publicKey: number;
  commitment: number;
  challenge: number;
  response: number;
  valid: boolean;
}

// ── Circuit ──────────────────────────────────────────────────────
export interface Witness {
  x: number;
  y: number;
  t: number;
  z: number;
}

export interface ConstraintCheck {
  label: string;
  left: number;
  right: number;
  satisfied: boolean;
}

// ── Lookup ───────────────────────────────────────────────────────
export interface LookupAnalysis {
  table: number[];
  wires: number[];
  sortedTable: number[];
  sortedWires: number[];
  missing: number[];
  multiplicityMismatches: number[];
  passes: boolean;
}

// ── Pipeline ─────────────────────────────────────────────────────
export type PipelineStage =
  | 'witness'
  | 'constraints'
  | 'polynomial'
  | 'commit'
  | 'challenge'
  | 'open'
  | 'verify';

export type FaultType =
  | 'none'
  | 'bad-witness'
  | 'bad-polynomial'
  | 'weak-fiat-shamir'
  | 'bad-opening';

export interface WitnessData {
  x: number;
  v1: number;
  y: number;
  wires: number[];
}

export interface ConstraintRow {
  a: number[];
  b: number[];
  c: number[];
  lhs: number;
  rhs: number;
  satisfied: boolean;
}

export interface ConstraintData {
  rows: ConstraintRow[];
  allSatisfied: boolean;
}

export interface PolynomialData {
  coefficients: number[];
  points: { x: number; y: number }[];
}

export interface CommitData {
  commitment: string;
}

export interface ChallengeData {
  transcriptInputs: string[];
  challenge: number;
}

export interface OpenData {
  z: number;
  pz: number;
  quotientCoeffs: number[];
}

export interface VerifyData {
  commitmentValid: boolean;
  evaluationValid: boolean;
  quotientValid: boolean;
  passed: boolean;
  detail: string;
}

export interface PipelineResults {
  witness: WitnessData | null;
  constraints: ConstraintData | null;
  polynomial: PolynomialData | null;
  commit: CommitData | null;
  challenge: ChallengeData | null;
  open: OpenData | null;
  verify: VerifyData | null;
}
