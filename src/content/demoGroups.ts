import type { DemoId } from '@/types';

export const DEMO_STARTER_ID: DemoId = 'pipeline';

export interface DemoGroup {
  title: string;
  description: string;
  demos: DemoId[];
}

export const DEMO_GROUPS: DemoGroup[] = [
  {
    title: 'Proof Systems',
    description: 'End-to-end proof flows, recursive verification, and verifier cost tradeoffs.',
    demos: ['pipeline', 'recursive', 'split-accumulation', 'groth16', 'plonk'],
  },
  {
    title: 'Commitment Schemes',
    description: 'Hash trees, polynomial commitments, hiding commitments, and set accumulators.',
    demos: ['polynomial', 'pedersen', 'merkle', 'accumulator'],
  },
  {
    title: 'Protocol Primitives',
    description: 'Transcript hashing, curve arithmetic, arithmetization, and table checks.',
    demos: ['fiat-shamir', 'elliptic', 'circuit', 'lookup'],
  },
  {
    title: 'Privacy Primitives',
    description: 'Privacy-preserving protocols, rerandomization, and circuit-friendly primitives.',
    demos: ['oblivious-sync', 'rerandomization', 'constraint-counter'],
  },
];

export const DEMO_CATEGORY_BY_ID: Record<DemoId, string> = {
  pipeline: 'Proof Systems',
  recursive: 'Proof Systems',
  'split-accumulation': 'Proof Systems',
  groth16: 'Proof Systems',
  plonk: 'Proof Systems',
  polynomial: 'Commitment Schemes',
  pedersen: 'Commitment Schemes',
  merkle: 'Commitment Schemes',
  accumulator: 'Commitment Schemes',
  'fiat-shamir': 'Protocol Primitives',
  elliptic: 'Protocol Primitives',
  circuit: 'Protocol Primitives',
  lookup: 'Protocol Primitives',
  rerandomization: 'Protocol Primitives',
  'oblivious-sync': 'Protocol Primitives',
  'constraint-counter': 'Protocol Primitives',
};
