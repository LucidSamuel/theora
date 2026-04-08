import type { AttackScenario } from './types';

export const OSYNC_DEANONYMIZE: AttackScenario = {
  id: 'osync-deanonymize',
  demoId: 'oblivious-sync',
  title: 'Deanonymize a Wallet\'s Notes via Sync',
  difficulty: 'intermediate',
  briefing: {
    goal: 'As a malicious service operator, try to determine which specific notes a wallet owns by analyzing the oblivious sync queries.',
    adversarySees: [
      'The blinded nullifier batch sent by the wallet',
      'The size of the query batch',
      'The timing and frequency of sync requests',
    ],
    adversaryControls: [
      'The service\'s response to the blinded queries',
    ],
    adversaryCannotDo: [
      'Unblind the wallet\'s nullifiers (does not have the blinding key)',
      'Modify the spent set to inject false positives',
      'Observe the wallet\'s local computation',
    ],
  },
  steps: [
    {
      id: 'observe-blinded-batch',
      instruction: 'The wallet sends a batch of blinded nullifiers. Examine them — can you identify which notes they correspond to?',
      observation: 'The blinded values appear random. Without the blinding key, each blinded nullifier is indistinguishable from a random group element.',
      adversaryNarration: 'I see a batch of blinded values. They look uniformly random. I cannot map them to any known nullifiers in the spent set.',
      demoAction: { type: 'STEP', payload: undefined },
    },
    {
      id: 'analyze-batch-size',
      instruction: 'The batch size reveals how many notes the wallet is checking. Can this metadata leak the wallet\'s identity?',
      observation: 'The batch size is a weak signal — many wallets could have the same number of notes. A well-designed protocol pads batches to a fixed size.',
      adversaryNarration: 'The batch has 4 entries. This tells me the wallet has at most 4 notes, but nothing about which notes. With padding, even this signal disappears.',
      demoAction: { type: 'STEP', payload: undefined },
    },
    {
      id: 'check-intersection-result',
      instruction: 'Process the blinded batch against the spent set. The protocol returns a response — but can you tell which queries matched?',
      observation: 'The intersection result is encrypted or committed in a way that only the wallet can interpret. The service computes over blinded values and returns blinded results.',
      adversaryNarration: 'I processed the batch and sent a response, but I cannot tell if any of the wallet\'s notes are in the spent set. The blinding is information-theoretically hiding.',
      demoAction: { type: 'STEP', payload: undefined },
    },
    {
      id: 'give-up',
      instruction: 'The oblivious sync protocol ensures the service learns nothing about the wallet\'s notes beyond the batch size (which can be padded).',
      observation: 'The cryptographic blinding makes the protocol oblivious: the service performs useful computation (checking for spent notes) without learning what it computed on.',
      adversaryNarration: 'I cannot deanonymize the wallet. The blinded queries are unlinkable to real nullifiers, and the response reveals nothing about which queries matched. The protocol is secure.',
    },
  ],
  conclusion: {
    succeeded: false,
    explanation: 'Oblivious sync uses cryptographic blinding to hide the wallet\'s queries from the service. The blinded nullifiers are computationally indistinguishable from random, and the protocol\'s response is encrypted so only the wallet can interpret it. A malicious service cannot determine which notes the wallet owns or which were spent.',
    securityGuarantee: 'Oblivious sync privacy: under the DDH assumption, a malicious service learns nothing about the wallet\'s notes beyond an upper bound on the batch size. With fixed-size batches, even this leakage is eliminated.',
  },
};
