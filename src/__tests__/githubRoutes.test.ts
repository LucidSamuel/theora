import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
const originalClientId = process.env.GITHUB_CLIENT_ID;
const originalClientSecret = process.env.GITHUB_CLIENT_SECRET;
const originalSessionSecret = process.env.GITHUB_SESSION_SECRET;
type RouteHandler = (request: Request, context?: { params?: Record<string, string> }) => Promise<Response>;
type SessionFactory = (
  request: Request,
  token: string,
  user: { login: string; avatar_url: string },
  returnTo: string,
) => Promise<{ cookie: string; sessionId: string }>;
let gistsHandler: RouteHandler;
let gistDetailHandler: RouteHandler;
let createAuthenticatedSession: SessionFactory;

beforeEach(async () => {
  vi.resetModules();
  process.env.ALLOWED_ORIGINS = 'https://app.theora.test,https://www.theora.dev';
  process.env.GITHUB_CLIENT_ID = 'github-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
  process.env.GITHUB_SESSION_SECRET = 'test-session-secret-with-32-plus-bytes';
  delete (globalThis as { __theoraGitHubSessionStore?: unknown }).__theoraGitHubSessionStore;

  // @ts-expect-error The deployed API routes are authored as plain JS.
  const gistsMod = await import('../../api/github/gists.js') as { default: RouteHandler };
  // @ts-expect-error The deployed API routes are authored as plain JS.
  const gistDetailMod = await import('../../api/github/gists/[gistId].js') as { default: RouteHandler };
  // @ts-expect-error The deployed session helper is authored as plain JS.
  const sessionMod = await import('../../api/github/_lib/session.js') as { createAuthenticatedSession: SessionFactory };
  gistsHandler = gistsMod.default;
  gistDetailHandler = gistDetailMod.default;
  createAuthenticatedSession = sessionMod.createAuthenticatedSession;
});

afterEach(() => {
  vi.restoreAllMocks();

  if (originalFetch === undefined) {
    delete (globalThis as { fetch?: unknown }).fetch;
  } else {
    Object.defineProperty(globalThis, 'fetch', { value: originalFetch, configurable: true });
  }

  if (originalAllowedOrigins === undefined) {
    delete process.env.ALLOWED_ORIGINS;
  } else {
    process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  }

  if (originalClientId === undefined) {
    delete process.env.GITHUB_CLIENT_ID;
  } else {
    process.env.GITHUB_CLIENT_ID = originalClientId;
  }

  if (originalClientSecret === undefined) {
    delete process.env.GITHUB_CLIENT_SECRET;
  } else {
    process.env.GITHUB_CLIENT_SECRET = originalClientSecret;
  }

  if (originalSessionSecret === undefined) {
    delete process.env.GITHUB_SESSION_SECRET;
  } else {
    process.env.GITHUB_SESSION_SECRET = originalSessionSecret;
  }

  delete (globalThis as { __theoraGitHubSessionStore?: unknown }).__theoraGitHubSessionStore;
});

async function createCookieHeader() {
  const request = new Request('https://app.theora.test/api/github/session');
  const session = await createAuthenticatedSession(
    request,
    'oauth-token-123',
    { login: 'theora-user', avatar_url: 'https://avatars.example/theora-user.png' },
    '/app',
  );
  return session.cookie.split(';')[0]!;
}

describe('GitHub gist routes', () => {
  it('creates named unlisted GitHub saves through the backend route', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 201,
      json: async () => ({ html_url: 'https://gist.github.com/user/secret-save-1' }),
      init,
    }));

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });

    const response = await gistsHandler(new Request('https://app.theora.test/api/github/gists', {
      method: 'POST',
      headers: {
        cookie: await createCookieHeader(),
        origin: 'https://app.theora.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        saveName: 'My audit trace',
        envelope: {
          version: 1,
          demo: 'pipeline',
          state: { scenarioName: 'Audit path', x: 3, stage: 'challenge', fault: 'none' },
        },
      }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      url: 'https://gist.github.com/user/secret-save-1',
    });

    const requestBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      public: boolean;
      description: string;
      files: Record<string, { content: string }>;
    };
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.github.com/gists');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer oauth-token-123',
    }));
    expect(requestBody.public).toBe(false);
    expect(requestBody.description).toBe('My audit trace');
    expect(requestBody.files['my-audit-trace.theora.json']!.content).toContain('"demo": "pipeline"');
  });

  it('lists Theora saves even when the gist list omits inline file content', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          {
            id: 'a1b2c3d4e5f6a1b2c3d4',
            description: '',
            html_url: 'https://gist.github.com/user/a1b2c3d4e5f6a1b2c3d4',
            created_at: '2026-03-22T10:00:00Z',
            updated_at: '2026-03-22T11:00:00Z',
            files: {
              'pedersen-audit.theora.json': {
                filename: 'pedersen-audit.theora.json',
              },
            },
          },
          {
            id: 'b2c3d4e5f6a1b2c3d4e5',
            description: 'Ignore me',
            html_url: 'https://gist.github.com/user/b2c3d4e5f6a1b2c3d4e5',
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
            'pedersen-audit.theora.json': {
              content: '{"demo":"pedersen","state":{"value":5}}',
            },
          },
        }),
      });

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });

    const response = await gistsHandler(new Request('https://app.theora.test/api/github/gists', {
      headers: {
        cookie: await createCookieHeader(),
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      saves: [
        {
          id: 'a1b2c3d4e5f6a1b2c3d4',
          description: 'Theora pedersen save',
          html_url: 'https://gist.github.com/user/a1b2c3d4e5f6a1b2c3d4',
          created_at: '2026-03-22T10:00:00Z',
          updated_at: '2026-03-22T11:00:00Z',
          demo: 'pedersen',
        },
      ],
    });
  });

  it('loads a specific saved envelope through the authenticated gist route', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      value: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          files: {
            'lookup-run.theora.json': {
              content: '{"demo":"lookup","state":{"table":[1,2,3],"wires":[2,3]}}',
            },
          },
        }),
      })),
      configurable: true,
    });

    const response = await gistDetailHandler(new Request('https://app.theora.test/api/github/gists/a1b2c3d4e5f6a1b2c3d423', {
      headers: {
        cookie: await createCookieHeader(),
      },
    }), {
      params: { gistId: 'a1b2c3d4e5f6a1b2c3d423' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      demo: 'lookup',
      state: { table: [1, 2, 3], wires: [2, 3] },
    });
  });
});
