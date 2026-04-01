import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import type { DemoId } from '@/types';
import { isDemoId } from '@/types';

export interface TheoraImportEnvelope {
  version?: 1;
  demo: DemoId;
  state: unknown;
}

// ── GitHub user & save types ────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

export interface TheoraSave {
  id: string;
  description: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  demo: DemoId;
}

const DEMO_QUERY_KEYS: Record<DemoId, string> = {
  pipeline: 'pl',
  merkle: 'm',
  polynomial: 'p',
  accumulator: 'a',
  recursive: 'r',
  'split-accumulation': 'sa',
  rerandomization: 'rr',
  'oblivious-sync': 'os',
  'fiat-shamir': 'fs',
  circuit: 'c',
  elliptic: 'e',
  lookup: 'l',
  pedersen: 'ped',
  'constraint-counter': 'cc',
  plonk: 'plk',
  groth16: 'g16',
};

export function applyImportedState(payload: TheoraImportEnvelope): void {
  const demo = payload.demo;
  const updates: Record<string, string | null> = { pl: null, m: null, p: null, a: null, r: null, sa: null, rr: null, os: null, fs: null, c: null, e: null, l: null, ped: null, cc: null, plk: null, g16: null };
  updates[DEMO_QUERY_KEYS[demo]] = encodeState(payload.state);
  setSearchParams(updates);
  window.location.hash = `${demo}|${encodeStatePlain(payload.state)}`;
}

export function getCurrentExportEnvelope(activeDemo: DemoId): TheoraImportEnvelope | null {
  const demo = activeDemo;
  const hashState = getHashState();
  const hashPayload = hashState?.demo === demo ? decodeStatePlain<unknown>(hashState.state) : null;
  const searchPayload = hashPayload ? null : decodeState<unknown>(getSearchParam(DEMO_QUERY_KEYS[demo]));
  const state = hashPayload ?? searchPayload;

  if (!state || typeof state !== 'object') {
    return null;
  }

  return {
    version: 1,
    demo,
    state,
  };
}

export function serializeTheoraImport(payload: TheoraImportEnvelope): string {
  return JSON.stringify(payload, null, 2);
}

export async function fetchTheoraImport(sourceUrl: string): Promise<TheoraImportEnvelope> {
  const resolved = resolveGitHubImportSource(sourceUrl);

  if (resolved.kind === 'gist-api') {
    const response = await fetch(resolved.url);
    if (!response.ok) {
      throw new Error(`GitHub Gist fetch failed (${response.status})`);
    }
    const gist = await response.json() as {
      files?: Record<string, { filename?: string; type?: string; content?: string }>;
    };
    const files = Object.values(gist.files ?? {});
    const preferred = files.find((file) => file.filename === 'theora.json')
      ?? files.find((file) => file.type === 'application/json')
      ?? files.find((file) => file.filename?.endsWith('.json'))
      ?? files.find((file) => {
        // Fallback: try any file whose content parses as valid theora JSON
        if (!file.content) return false;
        try { const p = JSON.parse(file.content); return p && typeof p === 'object' && 'demo' in p && 'state' in p; } catch { return false; }
      });

    if (!preferred?.content) {
      throw new Error('No JSON file found in the public Gist. Name the file "theora.json" or use a .json extension.');
    }

    return parseTheoraImport(preferred.content);
  }

  const response = await fetch(resolved.url);
  if (!response.ok) {
    throw new Error(`Import fetch failed (${response.status})`);
  }

  return parseTheoraImport(await response.text());
}

export function parseTheoraImport(raw: string): TheoraImportEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Import file is not valid JSON');
  }

  if (!isImportEnvelope(parsed)) {
    throw new Error('Import JSON must match { demo, state, version? }');
  }

  return parsed;
}

const ALLOWED_IMPORT_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'gist.github.com',
]);
const VALID_GIST_ID = /^[0-9a-f]{1,40}$/;

function validateGistId(gistId: string): string {
  if (!VALID_GIST_ID.test(gistId)) {
    throw new Error('Invalid Gist ID');
  }
  return gistId;
}

export function resolveGitHubImportSource(sourceUrl: string): { kind: 'direct'; url: string } | { kind: 'gist-api'; url: string } {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error('Enter a valid public GitHub, raw GitHub, or Gist URL');
  }

  if (!ALLOWED_IMPORT_HOSTS.has(url.hostname)) {
    throw new Error('Only GitHub URLs are supported for import');
  }

  if (url.hostname === 'github.com') {
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (match) {
      const [, owner, repo, branch, path] = match;
      return {
        kind: 'direct',
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
      };
    }
  }

  if (url.hostname === 'raw.githubusercontent.com' || url.hostname === 'gist.githubusercontent.com') {
    return { kind: 'direct', url: url.toString() };
  }

  if (url.hostname === 'gist.github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const gistId = parts.at(-1);
    if (!gistId) {
      throw new Error('Could not determine the public Gist ID');
    }
    return { kind: 'gist-api', url: `https://api.github.com/gists/${validateGistId(gistId)}` };
  }

  throw new Error('Could not resolve GitHub URL. Use a repo file, raw, or Gist URL.');
}

function isImportEnvelope(value: unknown): value is TheoraImportEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.demo === 'string' && isDemoId(candidate.demo) && 'state' in candidate;
}
