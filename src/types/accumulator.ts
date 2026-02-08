import type { Spring2D } from '@/lib/animation';

export interface AccElement {
  prime: bigint;
  label: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  spring: Spring2D;
  opacity: number;
}

export interface WitnessInfo {
  elementIndex: number;
  witness: bigint;
  element: bigint;
  accValue: bigint;
  verified: boolean | null;
}

export interface NonMembershipInfo {
  target: bigint;
  witness: bigint;
  b: bigint;
  verified: boolean | null;
}

export interface HistoryEntry {
  operation: 'add' | 'remove' | 'batch-add' | 'verify';
  detail: string;
  accBefore: string;
  accAfter: string;
  timestamp: number;
}

export interface AccumulatorState {
  elements: AccElement[];
  accValue: bigint;
  n: bigint;
  g: bigint;
  selectedIndex: number | null;
  witness: WitnessInfo | null;
  nonMembership: NonMembershipInfo | null;
  history: HistoryEntry[];
  batchMode: boolean;
  batchPrimes: string;
}
