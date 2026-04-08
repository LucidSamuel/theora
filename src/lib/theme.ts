export type Theme = 'dark' | 'light';

const THEME_KEY = 'theora-theme-v2';

export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage blocked in cross-origin iframes
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage blocked in cross-origin iframes
  }
  // Notify all useTheme() instances so demo renderers re-draw with correct colors
  window.dispatchEvent(new CustomEvent('theora-theme', { detail: theme }));
}

export const DEMO_COLORS = {
  merkle: '#fafafa',
  accumulator: '#a1a1aa',
  polynomial: '#d4d4d8',
  recursive: '#71717a',
} as const;
