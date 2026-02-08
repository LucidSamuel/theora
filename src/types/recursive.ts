import type { Spring2D } from '@/lib/animation';

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
  spring: Spring2D;
}

export interface VerificationState {
  order: string[];
  currentIndex: number;
  isRunning: boolean;
  speed: number;
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

export type RecursiveMode = 'tree' | 'ivc';

export interface RecursiveState {
  mode: RecursiveMode;
  treeDepth: number;
  root: ProofNode | null;
  verification: VerificationState;
  ivcLength: number;
  ivcChain: IvcChain | null;
  showPastaCurves: boolean;
  showProofSize: boolean;
  badProofTarget: string | null;
}
