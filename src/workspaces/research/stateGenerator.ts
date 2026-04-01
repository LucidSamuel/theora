import type { DemoId } from '@/types';

/**
 * Returns sensible default demo states for walkthrough embeds.
 * States are serializable objects matching each demo's URL state schema.
 */
export function generateDemoState(demoId: DemoId): Record<string, unknown> {
  switch (demoId) {
    case 'recursive':
      return { mode: 'tree', depth: 3, showPasta: true, showProofSize: true };
    case 'polynomial':
      return { mode: 'coefficients', coefficients: [5, 1, 1], kzg: { currentStep: 1 } };
    case 'fiat-shamir':
      return { mode: 'fs-correct', secret: 9, nonce: 12 };
    case 'circuit':
      return { x: 7, broken: false, viewMode: 'r1cs' };
    case 'merkle':
      return { leaves: ['tx_0', 'tx_1', 'tx_2', 'tx_3'], hashMode: 'fnv1a' };
    case 'pipeline':
      return { secretInput: 7, fault: 'none' };
    case 'accumulator':
      return { elements: [3, 7, 11, 13], showHistory: true };
    case 'elliptic':
      return { a: 0, b: 7, p: 23 };
    case 'lookup':
      return {};
    case 'pedersen':
      return { mode: 'single', value: 42, randomness: 17 };
    case 'groth16':
      return { x: 7, autoRun: false, showToxicWaste: false };
    case 'plonk':
      return {};
    case 'split-accumulation':
      return {};
    case 'rerandomization':
      return {};
    case 'oblivious-sync':
      return {};
    case 'constraint-counter':
      return {};
  }
}
