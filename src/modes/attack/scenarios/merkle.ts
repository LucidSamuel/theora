import type { AttackScenario } from './types';

export const MERKLE_FORGERY: AttackScenario = {
  id: 'merkle-forgery',
  demoId: 'merkle',
  title: 'Forge a Merkle Inclusion Proof',
  difficulty: 'beginner',
  briefing: {
    goal: 'Convince the verifier that a fake leaf is in the tree.',
    adversarySees: [
      'The Merkle root hash (public)',
      'The tree depth',
      'The hash function used (FNV-1a or SHA-256)',
    ],
    adversaryControls: [
      'The fake leaf value',
      'The sibling hashes in the proof path',
    ],
    adversaryCannotDo: [
      'Change the Merkle root',
      'Invert the hash function (for SHA-256)',
    ],
  },
  steps: [
    {
      id: 'build-tree',
      instruction: 'A Merkle tree with 8 leaves has been built. The root hash is public. Your goal: produce a valid inclusion proof for a leaf that is NOT in the tree.',
      demoAction: { type: 'BUILD_DEFAULT_TREE' },
      observation: 'The tree has 8 leaves (Alice through Heidi). The root hash is computed from all leaves. A valid proof for "Alice" requires correct sibling hashes at each level.',
      adversaryNarration: 'I can see the root hash and the tree depth (3 levels of siblings). I need to produce sibling hashes that reconstruct to this root.',
    },
    {
      id: 'generate-honest-proof',
      instruction: 'First, see how a legitimate proof works. Generate a proof for "Alice" (leaf 0) and step through verification.',
      demoAction: { type: 'GENERATE_PROOF', payload: 0 },
      observation: 'Each verification step hashes the current value with the sibling hash. After 3 steps, the result matches the root. The proof is valid.',
      adversaryNarration: 'The proof path has 3 sibling hashes. Each step produces the parent hash. The final hash must match the root exactly.',
    },
    {
      id: 'attempt-forgery',
      instruction: 'Now try to forge a proof for "Mallory" — a leaf not in the tree. You need to provide 3 sibling hashes that reconstruct to the root.',
      observation: 'To forge the proof, you would need sibling hashes that, when combined with Hash("Mallory"), produce each intermediate hash up to the root. This requires inverting the hash function.',
      adversaryNarration: 'I need to find h₁ such that Hash(Hash("Mallory") || h₁) = target. Then find h₂ such that Hash(result || h₂) = next target. Each step requires a preimage.',
    },
    {
      id: 'forgery-fails',
      instruction: 'With random sibling hashes, the verification will fail. The running hash diverges from the expected path at the very first step.',
      demoAction: { type: 'ATTEMPT_FORGERY' },
      observation: 'Verification fails. The running hash after step 1 does not match any intermediate node in the tree. Random guessing has negligible probability of success.',
      adversaryNarration: 'My random siblings produce a completely wrong intermediate hash. For SHA-256, finding the right sibling requires ~2²⁵⁶ operations. The attack is infeasible.',
    },
    {
      id: 'weak-hash-caveat',
      instruction: 'However, with FNV-1a (a non-cryptographic hash), collisions are easy to find. The 32-bit output space is small enough to brute-force. This is why production systems use SHA-256.',
      observation: 'FNV-1a has only 2³² possible outputs. A birthday attack finds collisions in ~2¹⁶ operations. With SHA-256, collisions require ~2¹²⁸ operations — computationally infeasible.',
      adversaryNarration: 'Against a weak hash, I could brute-force sibling values. Against SHA-256, the attack is hopeless. The security guarantee comes entirely from the hash function.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Forging a Merkle inclusion proof requires finding hash preimages at each level of the tree. With a cryptographic hash function like SHA-256, this is computationally infeasible (collision resistance: ~2¹²⁸ operations).',
    securityGuarantee: 'Merkle trees derive their security from the collision resistance of the underlying hash function. As long as Hash is collision-resistant, no adversary can produce a valid proof for a leaf not in the tree without finding a collision.',
    realWorldExample: 'Merkle trees secure Bitcoin block headers, Ethereum state tries, certificate transparency logs, and data availability sampling in rollups.',
  },
};
