import { encodeState } from '@/lib/urlState';
import type { DemoId } from '@/types';
import type { WalkthroughDemo } from './types';

export const RESEARCH_DEMO_PARAM_KEYS: Record<DemoId, string> = {
  pipeline: 'pl',
  merkle: 'm',
  polynomial: 'p',
  accumulator: 'a',
  recursive: 'r',
  'split-accumulation': 'sa',
  rerandomization: 'rr',
  'oblivious-sync': 'os',
  elliptic: 'e',
  'fiat-shamir': 'fs',
  circuit: 'c',
  lookup: 'l',
  pedersen: 'ped',
  'constraint-counter': 'cc',
  plonk: 'plk',
  groth16: 'g16',
  sumcheck: 'sc',
  fri: 'fri',
  nova: 'nova',
  mle: 'mle',
  gkr: 'gkr',
};

interface BuildWalkthroughDemoUrlOptions {
  origin?: string;
  embed?: boolean;
}

export function buildWalkthroughDemoUrl(
  demo: WalkthroughDemo,
  options: BuildWalkthroughDemoUrlOptions = {},
): string {
  const origin =
    options.origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://theora.local');
  const url = new URL('/app', origin);
  const key = RESEARCH_DEMO_PARAM_KEYS[demo.demoId];

  if (options.embed) {
    url.searchParams.set('embed', demo.demoId);
  } else {
    url.hash = demo.demoId;
  }

  if (Object.keys(demo.state).length > 0) {
    url.searchParams.set(key, encodeState(demo.state));
  }

  return url.toString();
}

const EPRINT_ID_PATTERN = /^(\d{4})\/(\d+)$/;
const EPRINT_PATH_PATTERN = /^\/(\d{4})\/(\d+)(?:\.pdf)?\/?$/;

export function normalizePaperPdfUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const bareIdMatch = trimmed.match(EPRINT_ID_PATTERN);
  if (bareIdMatch) {
    return `https://eprint.iacr.org/${bareIdMatch[1]}/${bareIdMatch[2]}.pdf`;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'eprint.iacr.org') {
      const match = url.pathname.match(EPRINT_PATH_PATTERN);
      if (match) {
        url.pathname = `/${match[1]}/${match[2]}.pdf`;
        url.search = '';
        url.hash = '';
      }
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function isPdfResponse(url: string, contentType: string | null): boolean {
  if (url.toLowerCase().endsWith('.pdf')) return true;
  if (!contentType) return false;

  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('application/pdf') ||
    normalized.includes('application/octet-stream')
  );
}
