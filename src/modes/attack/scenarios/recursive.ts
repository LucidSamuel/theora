import type { AttackScenario } from './types';

export const RECURSIVE_FORGERY: AttackScenario = {
  id: 'recursive-forgery',
  demoId: 'recursive',
  title: 'Forge a Recursive Proof',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Inject a fraudulent leaf proof and see if the recursive verifier catches it during composition.',
    adversarySees: [
      'The full proof tree structure',
      'All public inputs and outputs at each node',
      'The verification order (bottom-up)',
    ],
    adversaryControls: [
      'One leaf proof\'s witness values',
      'The claimed output of that leaf',
    ],
    adversaryCannotDo: [
      'Modify the verification circuit itself',
      'Skip the parent node\'s verification check',
      'Alter other nodes\' proofs after they are verified',
    ],
  },
  steps: [
    {
      id: 'observe-tree',
      instruction: 'Examine the proof tree. Each leaf computes x\u00B2 + x + 5 and produces a claimed output.',
      observation: 'The tree has 2^d leaves. Each leaf is a standalone proof that the parent will fold.',
      adversaryNarration: 'I can see the full tree. If I can fake just one leaf, maybe the forgery propagates to the root.',
      demoAction: { type: 'LOAD_ATTACK_TREE', payload: { depth: 2, badProofNode: null } },
    },
    {
      id: 'inject-bad-leaf',
      instruction: 'Imagine injecting a leaf that claims output 999 for input 3. The honest result is 3\u00B2 + 3 + 5 = 17.',
      observation: 'The leaf proof must satisfy the R1CS constraints for x\u00B2 + x + 5. A wrong output violates the constraint.',
      adversaryNarration: 'I submit a proof claiming 999. The constraint check at the leaf level should catch this immediately.',
      demoAction: { type: 'LOAD_ATTACK_TREE', payload: { depth: 2, badProofNode: 'node_2_0' } },
    },
    {
      id: 'verify-bottom-up',
      instruction: 'Run verification. Watch the bottom-up traversal — the forged leaf is checked first.',
      observation: 'Verification starts at leaves. The fraudulent leaf fails its constraint check, and the parent cannot fold it.',
      adversaryNarration: 'The verifier rejects my leaf before it even reaches the parent. The forgery is contained at the lowest level.',
      demoAction: { type: 'START_VERIFICATION', payload: undefined },
    },
    {
      id: 'result',
      instruction: 'The recursive structure ensures every sub-proof is verified. A single bad leaf halts the entire composition.',
      observation: 'Soundness is preserved: the root proof is only valid if every leaf and intermediate node passes verification.',
      adversaryNarration: 'No shortcut. I cannot forge a leaf without breaking the constraint system. Recursive composition amplifies soundness.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Recursive proof composition verifies every sub-proof bottom-up. A forged leaf fails its local constraint check, preventing the parent from folding it. The root proof is sound only if all leaves are honest.',
    securityGuarantee: 'Recursive soundness: if the base proof system is sound and the folding circuit is correct, no adversary can forge a valid recursive proof without producing valid sub-proofs at every level.',
  },
};
