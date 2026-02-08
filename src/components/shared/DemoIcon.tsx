import type { DemoId } from '@/types';
import { TreePine, Orbit, Sigma, Repeat } from 'lucide-react';

const ICONS = {
  merkle: TreePine,
  polynomial: Sigma,
  accumulator: Orbit,
  recursive: Repeat,
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
