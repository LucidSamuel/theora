import type { DemoId } from '@/types';
import { TreePine, Orbit, Sigma, Repeat, Hexagon, ShieldCheck, CircuitBoard, TableProperties, Workflow, Lock, LayoutGrid, Fingerprint, Split, Shuffle, Radar, BarChart3, Variable, Layers, Combine, Box, Network } from 'lucide-react';

const ICONS = {
  pipeline: Workflow,
  merkle: TreePine,
  polynomial: Sigma,
  accumulator: Orbit,
  recursive: Repeat,
  'split-accumulation': Split,
  rerandomization: Shuffle,
  'oblivious-sync': Radar,
  elliptic: Hexagon,
  'fiat-shamir': ShieldCheck,
  circuit: CircuitBoard,
  lookup: TableProperties,
  pedersen: Lock,
  'constraint-counter': BarChart3,
  plonk: LayoutGrid,
  groth16: Fingerprint,
  sumcheck: Variable,
  fri: Layers,
  nova: Combine,
  mle: Box,
  gkr: Network,
} as const;

interface DemoIconProps {
  id: DemoId;
  size?: number;
  color?: string;
  className?: string;
}

export function DemoIcon({ id, size = 16, color, className }: DemoIconProps) {
  const Icon = ICONS[id];
  return <Icon size={size} color={color} className={className} />;
}
