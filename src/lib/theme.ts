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
  merkle: '#fafafa',
  accumulator: '#a1a1aa',
  polynomial: '#d4d4d8',
  recursive: '#71717a',
} as const;
