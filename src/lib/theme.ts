export type Theme = 'dark' | 'light';

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theora-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theora-theme', theme);
}

export const DEMO_COLORS = {
  merkle: '#b8733a',
  accumulator: '#c8824a',
  polynomial: '#5f7ea0',
  recursive: '#8a6b5b',
} as const;
