import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import type { DemoId } from '@/types';

export type GitHubImportDemo = 'pipeline' | 'merkle' | 'polynomial' | 'accumulator' | 'recursive';

export interface TheoraImportEnvelope {
  version?: 1;
  demo: GitHubImportDemo;
  state: unknown;
}

const DEMO_QUERY_KEYS: Record<GitHubImportDemo, string> = {
  pipeline: 'pl',
  merkle: 'm',
  polynomial: 'p',
  accumulator: 'a',
  recursive: 'r',
};

const SUPPORTED_DEMOS: GitHubImportDemo[] = ['pipeline', 'merkle', 'polynomial', 'accumulator', 'recursive'];

export function applyImportedState(payload: TheoraImportEnvelope): void {
  const demo = payload.demo;
  const updates: Record<string, string | null> = { pl: null, m: null, p: null, a: null, r: null };
  updates[DEMO_QUERY_KEYS[demo]] = encodeState(payload.state);
  setSearchParams(updates);
  window.location.hash = `${demo}|${encodeStatePlain(payload.state)}`;
}

export function getCurrentExportEnvelope(activeDemo: DemoId): TheoraImportEnvelope | null {
  if (!SUPPORTED_DEMOS.includes(activeDemo as GitHubImportDemo)) {
    return null;
  }

  const demo = activeDemo as GitHubImportDemo;
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
      ?? files.find((file) => file.filename?.endsWith('.json'));

    if (!preferred?.content) {
      throw new Error('No JSON file found in the public Gist');
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

export function resolveGitHubImportSource(sourceUrl: string): { kind: 'direct'; url: string } | { kind: 'gist-api'; url: string } {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error('Enter a valid public GitHub, raw GitHub, or Gist URL');
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
    return { kind: 'gist-api', url: `https://api.github.com/gists/${gistId}` };
  }

  return { kind: 'direct', url: url.toString() };
}

function isImportEnvelope(value: unknown): value is TheoraImportEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return SUPPORTED_DEMOS.includes(candidate.demo as GitHubImportDemo) && 'state' in candidate;
}

function buildGistDescription(payload: TheoraImportEnvelope): string {
  const scenarioName = typeof payload.state === 'object' && payload.state && 'scenarioName' in (payload.state as Record<string, unknown>)
    ? (payload.state as Record<string, unknown>).scenarioName
    : null;
  return scenarioName && typeof scenarioName === 'string'
    ? `Theora ${payload.demo} scenario: ${scenarioName}`
    : `Theora ${payload.demo} export`;
}
