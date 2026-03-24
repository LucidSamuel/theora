export const APP_PATH = '/app';
export const GITHUB_SCOPE = 'gist';
export const SESSION_COOKIE_BASENAME = 'theora_session';
export const PENDING_SESSION_TTL_SECONDS = 60 * 10;
export const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_KEY_PREFIX = 'theora_github_session_';
export const DEMO_IDS = new Set([
  'pipeline',
  'merkle',
  'polynomial',
  'accumulator',
  'recursive',
  'fiat-shamir',
  'circuit',
  'elliptic',
  'lookup',
  'pedersen',
  'plonk',
  'groth16',
]);

export function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || 'https://www.theora.dev')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
