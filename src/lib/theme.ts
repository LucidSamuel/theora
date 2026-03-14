export type Theme = 'dark' | 'light';

const THEME_KEY = 'theora-theme-v2';

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

export const DEMO_COLORS = {
  merkle: '#fafafa',
  accumulator: '#a1a1aa',
  polynomial: '#d4d4d8',
  recursive: '#71717a',
} as const;
