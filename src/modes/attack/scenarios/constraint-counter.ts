import type { AttackScenario } from './types';

export const CONSTRAINT_COUNTER_COST_ATTACK: AttackScenario = {
  id: 'sha256-cost-claim',
  demoId: 'constraint-counter',
  title: 'Claim SHA-256 Is Circuit-Friendly',
  difficulty: 'beginner',
  briefing: {
    goal: 'Convince engineers that SHA-256 is a viable Merkle hash inside zk circuits.',
    adversarySees: [
      'Pedersen and Poseidon constraint counts',
      'Tree depth slider',
      'Savings ratios',
    ],
    adversaryControls: [
      'Tree depth parameter',
      'Which numbers to present',
    ],
    adversaryCannotDo: [
      'Change the per-hash constraint counts',
      'Hide the bar chart',
      'Disable SHA-256 column',
    ],
  },
  steps: [
    {
      id: 'observe-baseline',
      instruction: 'Observe the baseline. Look at Pedersen vs Poseidon costs. Note the ~13.5x savings.',
      observation: 'At depth 16, Poseidon uses far fewer constraints than Pedersen. The savings ratio is roughly 13.5x, showing that algebraic hash design matters enormously inside arithmetic circuits.',
      adversaryNarration: 'Pedersen and Poseidon are both "ZK-friendly" — the gap between them is already large. Maybe I can distract from how much worse SHA-256 is by focusing on this comparison instead.',
      demoAction: { type: 'SET_DEPTH', payload: 16 },
    },
    {
      id: 'introduce-sha256',
      instruction: 'Introduce SHA-256. Show what happens when SHA-256 enters the comparison. At depth 16, SHA-256 full tree cost is approximately 1.65 billion constraints.',
      observation: 'SHA-256 requires roughly 25,000 R1CS constraints per hash — about 30x more than Pedersen and 400x more than Poseidon. At depth 16 the full-tree cost explodes to ~1.65 billion constraints.',
      adversaryNarration: 'The numbers are devastating. At depth 20 the SHA-256 column dwarfs everything else on the chart. There is no way to make this look competitive.',
      demoAction: { type: 'SET_DEPTH', payload: 20 },
    },
    {
      id: 'try-depth-32',
      instruction: 'Try depth 32. At depth 32 the SHA-256 full tree exceeds 108 trillion constraints. Even Pedersen\'s 3.6T pales.',
      observation: 'At depth 32, SHA-256 full-tree cost exceeds 108 trillion constraints. Pedersen sits at roughly 3.6 trillion and Poseidon at around 268 billion. The bar chart makes the gap unmistakable at every depth.',
      adversaryNarration: 'The constraint counter makes it impossible to hide the cost. No amount of framing can overcome a 400x multiplier compounding across every node of a Merkle tree. The attack fails.',
      demoAction: { type: 'SET_DEPTH', payload: 32 },
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'SHA-256 costs approximately 25,000 R1CS constraints per hash — roughly 30x more than Pedersen and 400x more than Poseidon. At any realistic Merkle depth, the full-tree cost becomes astronomical. This is precisely why ZK-friendly hash functions like Poseidon were invented.',
    securityGuarantee: 'The algebraic structure of Poseidon maps directly to field operations, while SHA-256\'s bitwise operations (XOR, rotate, shift) must be decomposed into thousands of R1CS constraints. No implementation trick can close a 400x gap.',
  },
};
