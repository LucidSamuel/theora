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

interface GitHubGistFile {
  filename?: string;
  content?: string;
  raw_url?: string;
}

// ── GitHub API helpers ──────────────────────────────────────────────────────

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid or expired token. Use a token with gist scope.');
  }
  if (!res.ok) throw new Error(`GitHub API error (${res.status})`);
  const data = await res.json() as { login: string; avatar_url: string };
  return { login: data.login, avatar_url: data.avatar_url };
}

export async function listTheoraGists(token: string): Promise<TheoraSave[]> {
  const res = await fetch('https://api.github.com/gists?per_page=100', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`Failed to list gists (${res.status})`);
  const gists = await res.json() as Array<{
    id: string;
    description: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    files: Record<string, GitHubGistFile>;
  }>;

  const saves = await Promise.all(gists.map(async (g) => {
    const theoraFile = g.files['theora.json'];
    if (!theoraFile) return null;

    let parsedDemo: DemoId | null = null;
    if (theoraFile.content) {
      try {
        const parsed = JSON.parse(theoraFile.content) as Record<string, unknown>;
        if (typeof parsed.demo === 'string' && isDemoId(parsed.demo)) {
          parsedDemo = parsed.demo;
        }
      } catch {
        return null;
      }
    } else {
      try {
        const envelope = await fetchGistEnvelope(token, g.id);
        parsedDemo = envelope.demo;
      } catch {
        return null;
      }
    }

    if (!parsedDemo) return null;

    return {
      id: g.id,
      description: g.description || `Theora ${parsedDemo} export`,
      html_url: g.html_url,
      created_at: g.created_at,
      updated_at: g.updated_at,
      demo: parsedDemo,
    };
  }));

  return saves.filter((save): save is TheoraSave => save !== null);
}

// Gist IDs are hex strings; reject anything with slashes, dots, or other path-traversal chars
const VALID_GIST_ID = /^[a-zA-Z0-9_-]+$/;

function validateGistId(gistId: string): string {
  if (!VALID_GIST_ID.test(gistId)) {
    throw new Error('Invalid Gist ID');
  }
  return gistId;
}

export async function deleteGist(token: string, gistId: string): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${validateGistId(gistId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`Failed to delete gist (${res.status})`);
}

export async function fetchGistEnvelope(token: string, gistId: string): Promise<TheoraImportEnvelope> {
  const res = await fetch(`https://api.github.com/gists/${validateGistId(gistId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch gist (${res.status})`);
  const gist = await res.json() as { files: Record<string, { content?: string }> };
  const theoraFile = gist.files['theora.json'];
  if (!theoraFile?.content) throw new Error('Gist does not contain theora.json');
  return parseTheoraImport(theoraFile.content);
}

const DEMO_QUERY_KEYS: Record<DemoId, string> = {
  pipeline: 'pl',
  merkle: 'm',
  polynomial: 'p',
  accumulator: 'a',
  recursive: 'r',
  'fiat-shamir': 'fs',
  circuit: 'c',
  elliptic: 'e',
  lookup: 'l',
  pedersen: 'ped',
  plonk: 'plk',
  groth16: 'g16',
};

export function applyImportedState(payload: TheoraImportEnvelope): void {
  const demo = payload.demo;
  const updates: Record<string, string | null> = { pl: null, m: null, p: null, a: null, r: null, fs: null, c: null, e: null, l: null, ped: null, plk: null, g16: null };
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

export async function createPublicGist(payload: TheoraImportEnvelope, token: string): Promise<{ url: string }> {
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      public: true,
      description: buildGistDescription(payload),
      files: {
        'theora.json': {
          content: serializeTheoraImport(payload),
        },
      },
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('GitHub rejected the token. Use a token with gist scope.');
  }

  if (!response.ok) {
    throw new Error(`Gist creation failed (${response.status})`);
  }

  const gist = await response.json() as { html_url?: string };
  if (!gist.html_url) {
    throw new Error('GitHub did not return a public Gist URL');
  }

  return { url: gist.html_url };
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
        // Fallback: try any file whose content parses as valid Theora JSON
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

function buildGistDescription(payload: TheoraImportEnvelope): string {
  const scenarioName = typeof payload.state === 'object' && payload.state && 'scenarioName' in (payload.state as Record<string, unknown>)
    ? (payload.state as Record<string, unknown>).scenarioName
    : null;
  return scenarioName && typeof scenarioName === 'string'
    ? `Theora ${payload.demo} scenario: ${scenarioName}`
    : `Theora ${payload.demo} export`;
}
