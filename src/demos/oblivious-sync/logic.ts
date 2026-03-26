import { fnv1a } from '@/lib/hash';

export type SyncRound = 0 | 1 | 2 | 3 | 4;

export interface WalletQuery {
  nullifier: string;
  blind: string;
  blinded: string;
}

export interface SyncScenario {
  walletQueries: WalletQuery[];
  serviceSpentSet: string[];
  serviceCommitment: string;
  proofDigest: string;
  overlapCount: number;
  verified: boolean;
}

export interface SyncRoundDetails {
  title: string;
  walletAction: string;
  serviceAction: string;
  walletLearns: string[];
  serviceLearns: string[];
  visibleMessages: string[];
}

function buildNullifier(seed: string): string {
  return fnv1a(seed).slice(0, 12);
}

export function buildSyncScenario(walletCount: number, serviceCount: number, injectSpentMatch: boolean): SyncScenario {
  const walletQueries: WalletQuery[] = Array.from({ length: walletCount }, (_, index) => {
    const nullifier = buildNullifier(`wallet:${walletCount}:${index}`);
    const blind = fnv1a(`blind:${nullifier}`).slice(0, 10);
    return {
      nullifier,
      blind,
      blinded: fnv1a(`${nullifier}:${blind}`).slice(0, 14),
    };
  });

  const serviceSpentSet = Array.from({ length: serviceCount }, (_, index) =>
    buildNullifier(`service:${serviceCount}:${index}`)
  );

  if (injectSpentMatch && walletQueries[0]) {
    serviceSpentSet[Math.min(1, serviceSpentSet.length - 1)] = walletQueries[0].nullifier;
  }

  const overlapCount = walletQueries.filter((query) => serviceSpentSet.includes(query.nullifier)).length;
  const serviceCommitment = fnv1a(`spent-root:${serviceSpentSet.join('|')}`);
  const proofDigest = fnv1a(`proof:${walletQueries.map((query) => query.blinded).join('|')}:${serviceCommitment}:${overlapCount}`);

  return {
    walletQueries,
    serviceSpentSet,
    serviceCommitment,
    proofDigest,
    overlapCount,
    verified: overlapCount === 0,
  };
}

export function getSyncRoundDetails(scenario: SyncScenario, round: SyncRound): SyncRoundDetails {
  switch (round) {
    case 0:
      return {
        title: 'Wallet blinds nullifiers',
        walletAction: 'Sample per-note blinds and hash each nullifier into a blinded query.',
        serviceAction: 'Nothing yet — the service sees no wallet data.',
        walletLearns: ['Only its own nullifiers and the freshly sampled blinds.'],
        serviceLearns: ['Nothing.'],
        visibleMessages: scenario.walletQueries.map((query, index) => `wallet[${index}] -> ${query.blinded}`),
      };
    case 1:
      return {
        title: 'Wallet uploads blinded set',
        walletAction: 'Send only blinded nullifiers to the remote service.',
        serviceAction: 'Receives a batch of unlinkable tokens to check against the spent set.',
        walletLearns: ['The request size and the fact that a proof will be required next.'],
        serviceLearns: ['The number of queried notes, but not the underlying nullifiers.'],
        visibleMessages: scenario.walletQueries.map((query) => `blinded ${query.blinded}`),
      };
    case 2:
      return {
        title: 'Service proves disjointness',
        walletAction: 'Wait for a proof that none of the blinded queries open to spent notes.',
        serviceAction: 'Commit to the spent set and generate a proof over the blinded batch.',
        walletLearns: ['A spent-set commitment and a proof digest.'],
        serviceLearns: ['Still no raw wallet nullifiers.'],
        visibleMessages: [`spent-root ${scenario.serviceCommitment.slice(0, 10)}…`, `proof ${scenario.proofDigest.slice(0, 10)}…`],
      };
    case 3:
      return {
        title: 'Wallet verifies locally',
        walletAction: 'Recompute the transcript and verify the service proof against the blinded batch.',
        serviceAction: 'Learns nothing new while the wallet checks the response offline.',
        walletLearns: scenario.verified
          ? ['No queried note appears in the spent set.']
          : ['At least one queried note is already spent.'],
        serviceLearns: ['Nothing about which local note matched or failed.'],
        visibleMessages: [scenario.verified ? 'proof verified' : 'proof rejected'],
      };
    case 4:
    default:
      return {
        title: 'Sync outcome',
        walletAction: scenario.verified
          ? 'Accept the remote sync result and continue scanning with the clean note set.'
          : 'Stop and mark the wallet state as needing user attention.',
        serviceAction: 'Keeps only its normal spent-set state; it never saw raw wallet notes.',
        walletLearns: scenario.verified
          ? ['Clean sync completed without exposing wallet nullifiers.']
          : ['Sync failed because one or more notes are already spent.'],
        serviceLearns: ['The batch completed, but not which notes belong to the wallet.'],
        visibleMessages: [scenario.verified ? 'wallet state stays private' : 'spent note detected'],
      };
  }
}
