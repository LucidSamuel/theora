import type { Walkthrough } from '../types';
import { haloWalkthrough } from './halo';
import { groth16Walkthrough } from './groth16';
import { plonkWalkthrough } from './plonk';
import { bulletproofsWalkthrough } from './bulletproofs';
import { raguWalkthrough } from './ragu';

export const CURATED_WALKTHROUGHS: Walkthrough[] = [
  haloWalkthrough,
  groth16Walkthrough,
  plonkWalkthrough,
  bulletproofsWalkthrough,
];

// All walkthroughs including unlisted ones (accessible via direct ?paper= link)
const ALL_WALKTHROUGHS: Walkthrough[] = [
  ...CURATED_WALKTHROUGHS,
  raguWalkthrough,
];

export function getCuratedWalkthrough(id: string): Walkthrough | null {
  return ALL_WALKTHROUGHS.find((w) => w.id === id) ?? null;
}
