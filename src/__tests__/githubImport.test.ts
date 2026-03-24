import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { applyImportedState, createPublicGist, fetchGistEnvelope, fetchTheoraImport, listTheoraGists, parseTheoraImport, resolveGitHubImportSource, getCurrentExportEnvelope, serializeTheoraImport } from '@/lib/githubImport';
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
    expect(() => parseTheoraImport('{"demo":"unknown-primitive","state":{}}')).toThrow();
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

  it('returns null when the current demo has no shareable state in the URL', () => {
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
  it('lists Theora saves even when the gist list omits inline file content', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          {
            id: 'gist-1',
            description: '',
            html_url: 'https://gist.github.com/user/gist-1',
            created_at: '2026-03-22T10:00:00Z',
            updated_at: '2026-03-22T11:00:00Z',
            files: {
              'theora.json': {
                filename: 'theora.json',
              },
            },
          },
          {
            id: 'gist-2',
            description: 'Ignore me',
            html_url: 'https://gist.github.com/user/gist-2',
            created_at: '2026-03-22T10:00:00Z',
            updated_at: '2026-03-22T11:00:00Z',
            files: {
              'notes.txt': {
                filename: 'notes.txt',
                content: 'not a theora export',
              },
            },
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: {
            'theora.json': {
              content: '{"demo":"pedersen","state":{"value":5}}',
            },
          },
        }),
      });

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });

    const saves = await listTheoraGists('ghp_test');

    expect(saves).toEqual([
      {
        id: 'gist-1',
        description: 'Theora pedersen export',
        html_url: 'https://gist.github.com/user/gist-1',
        created_at: '2026-03-22T10:00:00Z',
        updated_at: '2026-03-22T11:00:00Z',
        demo: 'pedersen',
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.github.com/gists/gist-1', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer ghp_test',
      }),
    }));
  });

  it('loads a specific gist envelope from the private gist api', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      value: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          files: {
            'theora.json': {
              content: '{"demo":"lookup","state":{"table":[1,2,3],"wires":[2,3]}}',
            },
          },
        }),
      })),
      configurable: true,
    });

    const result = await fetchGistEnvelope('ghp_test', 'gist-123');

    expect(result).toEqual({
      demo: 'lookup',
      state: { table: [1, 2, 3], wires: [2, 3] },
    });
  });

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
