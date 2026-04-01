export interface EvalPoint {
  x: number;
  y: number;
  label?: string;
}

export interface KzgStep {
  name: 'commit' | 'challenge' | 'reveal' | 'verify';
  label: string;
  description: string;
}

export interface KzgState {
  commitment: string | null;
  challengeZ: number | null;
  revealedValue: number | null;
  quotientPoly: number[] | null;
  proofHash: string | null;
  verified: boolean | null;
  currentStep: number;
}

export type PolyMode = 'coefficients' | 'lagrange' | 'ntt' | 'ipa' | 'batch';

export interface IPADemoState {
  coefficients: bigint[];
  generators: bigint[];
  commitment: bigint;
  fieldSize: bigint;
  evalPoint: bigint;
  evalValue: bigint;
  rounds: import('@/demos/polynomial/ipa').IPARound[];
  currentRound: number; // -1 = overview
  phase: 'committed' | 'proving' | 'verified' | 'failed';
}

export interface NTTState {
  coefficients: bigint[];
  evaluations: bigint[];
  layers: import('@/demos/polynomial/ntt').ButterflyLayer[];
  omega: bigint;
  fieldSize: bigint;
  n: number;
  direction: 'forward' | 'inverse';
  activeLayer: number; // -1 = show all, 0..logn-1 = highlight one
}

export interface BatchOpeningDemoState {
  polynomials: bigint[][];    // the k polynomials
  evalPoint: bigint;          // z
  gamma: bigint;              // combination challenge
  result: import('@/demos/polynomial/batchOpening').BatchOpeningResult | null;
  fieldSize: bigint;
}

export interface PolynomialState {
  coefficients: number[];
  compareEnabled?: boolean;
  compareCoefficients?: number[];
  mode: PolyMode;
  lagrangePoints: EvalPoint[];
  evalPoints: EvalPoint[];
  kzg: KzgState;
  viewRange: { xMin: number; xMax: number; yMin: number; yMax: number };
  ntt: NTTState;
  ipa: IPADemoState;
  batch: BatchOpeningDemoState;
}
