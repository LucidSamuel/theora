import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { applyImportedState, createPublicGist, fetchTheoraImport, parseTheoraImport, resolveGitHubImportSource, getCurrentExportEnvelope, serializeTheoraImport } from '@/lib/githubImport';
import { getActiveDemoLocation } from '@/hooks/useActiveDemo';

const originalWindow = (globalThis as { window?: unknown }).window;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  const mockLocation = {
    search: '',
    hash: '',
    pathname: '/',
  };
  const mockHistory = {
    replaceState: (_state: unknown, _title: string, url: string) => {
      const parsed = new URL(url, 'https://theora.test');
      mockLocation.pathname = parsed.pathname;
      mockLocation.search = parsed.search;
      mockLocation.hash = parsed.hash;
    },
  };

  Object.defineProperty(globalThis, 'window', {
    value: {
      location: mockLocation,
      history: mockHistory,
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
  }

  if (originalFetch === undefined) {
    delete (globalThis as { fetch?: unknown }).fetch;
  } else {
    Object.defineProperty(globalThis, 'fetch', { value: originalFetch, configurable: true });
  }
});

describe('resolveGitHubImportSource', () => {
  it('converts github blob URLs to raw URLs', () => {
    const resolved = resolveGitHubImportSource('https://github.com/foo/bar/blob/main/examples/theora.json');
    expect(resolved).toEqual({
      kind: 'direct',
      url: 'https://raw.githubusercontent.com/foo/bar/main/examples/theora.json',
    });
  });

  it('converts gist page URLs to the gist api', () => {
    const resolved = resolveGitHubImportSource('https://gist.github.com/user/abcdef123456');
    expect(resolved).toEqual({
      kind: 'gist-api',
      url: 'https://api.github.com/gists/abcdef123456',
    });
  });
});

describe('parseTheoraImport', () => {
  it('accepts a supported import envelope', () => {
    const parsed = parseTheoraImport('{"demo":"merkle","state":{"leaves":["a","b"]}}');
    expect(parsed.demo).toBe('merkle');
  });

  it('accepts pipeline scenarios as supported import envelopes', () => {
    const parsed = parseTheoraImport('{"demo":"pipeline","state":{"scenarioName":"Audit path","x":3,"stage":"challenge","fault":"none"}}');
    expect(parsed.demo).toBe('pipeline');
  });

  it('rejects unsupported demo ids', () => {
    expect(() => parseTheoraImport('{"demo":"lookup","state":{}}')).toThrow();
  });
});

describe('export envelope helpers', () => {
  it('extracts the current supported demo state from the hash', () => {
    window.history.replaceState(null, '', '/app#merkle|%7B%22leaves%22%3A%5B%22a%22%2C%22b%22%5D%7D');
    const payload = getCurrentExportEnvelope('merkle');
    expect(payload).toEqual({
      version: 1,
      demo: 'merkle',
      state: { leaves: ['a', 'b'] },
    });
  });

  it('returns null for unsupported demos', () => {
    expect(getCurrentExportEnvelope('lookup')).toBeNull();
  });

  it('extracts pipeline scenario state from search params when hash state is absent', () => {
    window.history.replaceState(null, '', '/app?pl=eyJzY2VuYXJpb05hbWUiOiJBdWRpdCBwYXRoIiwieCI6Mywic3RhZ2UiOiJjaGFsbGVuZ2UiLCJmYXVsdCI6Im5vbmUifQ%3D%3D');
    const payload = getCurrentExportEnvelope('pipeline');
    expect(payload).toEqual({
      version: 1,
      demo: 'pipeline',
      state: { scenarioName: 'Audit path', x: 3, stage: 'challenge', fault: 'none' },
    });
  });

  it('serializes export envelopes as pretty json', () => {
    const json = serializeTheoraImport({ version: 1, demo: 'recursive', state: { depth: 3 } });
    expect(json).toContain('"demo": "recursive"');
    expect(json).toContain('"depth": 3');
  });
});

describe('same-demo import regression', () => {
  it('changes the active location key when importing new state into the already-open demo', () => {
    window.history.replaceState(null, '', '/app#merkle|%7B%22leaves%22%3A%5B%22a%22%2C%22b%22%5D%7D');

    const before = getActiveDemoLocation();
    expect(before).toEqual({
      activeDemo: 'merkle',
      locationKey: 'merkle|%7B%22leaves%22%3A%5B%22a%22%2C%22b%22%5D%7D',
    });

    applyImportedState({
      version: 1,
      demo: 'merkle',
      state: { leaves: ['alpha', 'beta', 'gamma'], selectedLeafIndex: 2 },
    });

    const after = getActiveDemoLocation();
    expect(after.activeDemo).toBe('merkle');
    expect(after.locationKey).not.toBe(before.locationKey);
    expect(after.locationKey).toContain('selectedLeafIndex');
  });
});

describe('gist publishing', () => {
  it('imports valid Theora payloads from gist files without a json extension', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      value: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          files: {
            'notes.txt': {
              filename: 'notes.txt',
              type: 'text/plain',
              content: '{"demo":"merkle","state":{"leaves":["alpha","beta"]}}',
            },
          },
        }),
      })),
      configurable: true,
    });

    const result = await fetchTheoraImport('https://gist.github.com/user/abcdef123456');

    expect(result).toEqual({
      demo: 'merkle',
      state: { leaves: ['alpha', 'beta'] },
    });
  });

  it('creates a public gist and returns its url', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      value: vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ html_url: 'https://gist.github.com/user/abc123' }),
      })),
      configurable: true,
    });

    const result = await createPublicGist({
      version: 1,
      demo: 'pipeline',
      state: { scenarioName: 'Audit path', x: 3, stage: 'challenge', fault: 'none' },
    }, 'ghp_test');

    expect(result.url).toBe('https://gist.github.com/user/abc123');
  });
});
