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

export type PolyMode = 'coefficients' | 'lagrange';

export interface PolynomialState {
  coefficients: number[];
  compareEnabled?: boolean;
  compareCoefficients?: number[];
  mode: PolyMode;
  lagrangePoints: EvalPoint[];
  evalPoints: EvalPoint[];
  kzg: KzgState;
  viewRange: { xMin: number; xMax: number; yMin: number; yMax: number };
}
