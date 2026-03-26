import { fnv1a } from '@/lib/hash';

export interface ProofComponent {
  label: 'commitment' | 'evaluation' | 'ipa';
  bytes: number[];
}

export interface ProofArtifact {
  id: string;
  statementId: string;
  statementLabel: string;
  statementHash: string;
  proofHash: string;
  rerandomizationTag: string;
  components: ProofComponent[];
}

export interface MatchCard {
  id: string;
  originalId: string;
  proof: ProofArtifact;
}

export interface MatchingGame {
  originals: ProofArtifact[];
  shuffled: MatchCard[];
}

const COMPONENT_SIZES: Array<[ProofComponent['label'], number]> = [
  ['commitment', 10],
  ['evaluation', 8],
  ['ipa', 14],
];

const STATEMENTS = [
  { id: 'transfer-42', label: 'Spend note #42 without linking to the original proof' },
  { id: 'kzg-open-13', label: 'Open p(z) at z = 13 for the same public polynomial' },
  { id: 'shielded-send', label: 'Send a shielded transfer with the same public amount' },
];

function expandBytes(seed: string, length: number): number[] {
  const bytes: number[] = [];
  let counter = 0;
  while (bytes.length < length) {
    const block = fnv1a(`${seed}:${counter}`);
    for (let i = 0; i < block.length && bytes.length < length; i += 2) {
      bytes.push(parseInt(block.slice(i, i + 2), 16));
    }
    counter++;
  }
  return bytes;
}

function flattenBytes(components: ProofComponent[]): number[] {
  return components.flatMap((component) => component.bytes);
}

export function getStatementCatalog(): Array<{ id: string; label: string }> {
  return [...STATEMENTS];
}

export function createOriginalProof(statementIndex: number): ProofArtifact {
  const statement = STATEMENTS[statementIndex % STATEMENTS.length] ?? STATEMENTS[0]!;
  const statementHash = fnv1a(`statement:${statement.id}`);
  const components = COMPONENT_SIZES.map(([label, size], componentIndex) => ({
    label,
    bytes: expandBytes(`${statementHash}:orig:${componentIndex}`, size),
  }));
  const proofHash = fnv1a(`${statementHash}:${flattenBytes(components).join(',')}`);

  return {
    id: `proof:${statement.id}`,
    statementId: statement.id,
    statementLabel: statement.label,
    statementHash,
    proofHash,
    rerandomizationTag: 'orig',
    components,
  };
}

export function rerandomizeProof(proof: ProofArtifact, nonce: number): ProofArtifact {
  const components = COMPONENT_SIZES.map(([label, size], componentIndex) => ({
    label,
    bytes: expandBytes(`${proof.statementHash}:rerand:${nonce}:${proof.proofHash}:${componentIndex}`, size),
  }));
  const rerandomizationTag = fnv1a(`${proof.proofHash}:nonce:${nonce}`).slice(0, 8);
  const proofHash = fnv1a(`${proof.statementHash}:${rerandomizationTag}:${flattenBytes(components).join(',')}`);

  return {
    id: `proof:${proof.statementId}:rerand:${nonce}`,
    statementId: proof.statementId,
    statementLabel: proof.statementLabel,
    statementHash: proof.statementHash,
    proofHash,
    rerandomizationTag,
    components,
  };
}

export function countChangedBytes(original: ProofArtifact, rerandomized: ProofArtifact): number {
  const originalBytes = flattenBytes(original.components);
  const rerandomizedBytes = flattenBytes(rerandomized.components);
  let changed = 0;
  for (let i = 0; i < Math.min(originalBytes.length, rerandomizedBytes.length); i++) {
    if (originalBytes[i] !== rerandomizedBytes[i]) {
      changed++;
    }
  }
  return changed;
}

export function verifiedSameStatement(original: ProofArtifact, rerandomized: ProofArtifact): boolean {
  return original.statementHash === rerandomized.statementHash && original.proofHash !== rerandomized.proofHash;
}

export function buildMatchingGame(seed: number): MatchingGame {
  const originals = STATEMENTS.map((_, index) => createOriginalProof(index));
  const rerandomized = originals.map((proof, index) => ({
    id: `match:${index}`,
    originalId: proof.id,
    proof: rerandomizeProof(proof, seed + index + 1),
  }));

  const shuffled = [...rerandomized].sort((a, b) =>
    fnv1a(`${seed}:${a.proof.proofHash}`).localeCompare(fnv1a(`${seed}:${b.proof.proofHash}`))
  );

  return { originals, shuffled };
}

export function scoreMatchingGame(game: MatchingGame, guesses: Record<string, string>): { correct: number; total: number } {
  let correct = 0;
  for (const card of game.shuffled) {
    if (guesses[card.id] === card.originalId) {
      correct++;
    }
  }
  return { correct, total: game.shuffled.length };
}
