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
  merkle: '#c8824a',
  accumulator: '#c8824a',
  polynomial: '#c8824a',
  recursive: '#c8824a',
} as const;
