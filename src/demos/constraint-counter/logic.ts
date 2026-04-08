export interface ConstraintProfile {
  name: 'SHA-256' | 'Pedersen' | 'Poseidon';
  r1csPerHash: number;
  bootle16PerHash: number;
}

export interface ConstraintScenario {
  depth: number;
  internalHashes: bigint;
  pathHashes: bigint;
  profiles: ConstraintProfile[];
}

const PROFILES: ConstraintProfile[] = [
  {
    name: 'SHA-256',
    r1csPerHash: 25210,
    bootle16PerHash: 22400,
  },
  {
    name: 'Pedersen',
    r1csPerHash: 850,
    bootle16PerHash: 760,
  },
  {
    name: 'Poseidon',
    r1csPerHash: 63,
    bootle16PerHash: 56,
  },
];

export function getConstraintProfiles(): ConstraintProfile[] {
  return [...PROFILES];
}

export function buildConstraintScenario(depth: number): ConstraintScenario {
  const safeDepth = Math.max(2, Math.min(32, depth));
  return {
    depth: safeDepth,
    internalHashes: (2n ** BigInt(safeDepth)) - 1n,
    pathHashes: BigInt(safeDepth),
    profiles: getConstraintProfiles(),
  };
}

export function getPathConstraintCost(profile: ConstraintProfile, depth: number, system: 'r1cs' | 'bootle16'): bigint {
  const perHash = system === 'r1cs' ? profile.r1csPerHash : profile.bootle16PerHash;
  return BigInt(perHash * depth);
}

export function getFullTreeConstraintCost(profile: ConstraintProfile, internalHashes: bigint, system: 'r1cs' | 'bootle16'): bigint {
  const perHash = system === 'r1cs' ? profile.r1csPerHash : profile.bootle16PerHash;
  return internalHashes * BigInt(perHash);
}

export function getSavingsRatio(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return 0;
  return Number(numerator) / Number(denominator);
}

export function formatConstraintCount(value: bigint): string {
  if (value < 1000n) return value.toString();
  if (value < 1_000_000n) return `${(Number(value) / 1000).toFixed(1)}k`;
  if (value < 1_000_000_000n) return `${(Number(value) / 1_000_000).toFixed(1)}M`;
  if (value < 1_000_000_000_000n) return `${(Number(value) / 1_000_000_000).toFixed(1)}B`;
  return `${(Number(value) / 1_000_000_000_000).toFixed(1)}T`;
}
