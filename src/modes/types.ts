export const MODE_IDS = ['explore', 'predict', 'attack', 'debug'] as const;

export type ModeId = typeof MODE_IDS[number];

export function isModeId(value: string): value is ModeId {
  return (MODE_IDS as readonly string[]).includes(value);
}

export interface ModeMeta {
  id: ModeId;
  label: string;
  shortcut: string;
  description: string;
}

export const MODES: ModeMeta[] = [
  {
    id: 'explore',
    label: 'Explore',
    shortcut: '1',
    description: 'Interactive visualization — the default experience.',
  },
  {
    id: 'predict',
    label: 'Predict',
    shortcut: '2',
    description: 'Guess what happens next, then verify.',
  },
  {
    id: 'attack',
    label: 'Attack',
    shortcut: '3',
    description: 'Find the vulnerability in a broken proof.',
  },
  {
    id: 'debug',
    label: 'Debug',
    shortcut: '4',
    description: 'Trace failures through the proof pipeline.',
  },
];
