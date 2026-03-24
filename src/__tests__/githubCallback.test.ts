import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
const originalClientId = process.env.GITHUB_CLIENT_ID;
const originalClientSecret = process.env.GITHUB_CLIENT_SECRET;
const originalSessionSecret = process.env.GITHUB_SESSION_SECRET;
type RouteHandler = (request: Request) => Promise<Response>;
let loginHandler: RouteHandler;
let callbackHandler: RouteHandler;

beforeEach(async () => {
  vi.resetModules();
  process.env.ALLOWED_ORIGINS = 'https://app.theora.test,https://www.theora.dev';
  process.env.GITHUB_CLIENT_ID = 'github-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
  process.env.GITHUB_SESSION_SECRET = 'test-session-secret-with-32-plus-bytes';
  delete (globalThis as { __theoraGitHubSessionStore?: unknown }).__theoraGitHubSessionStore;

  // @ts-expect-error The deployed API routes are authored as plain JS.
  const loginMod = await import('../../api/github/login.js') as { default: RouteHandler };
  // @ts-expect-error The deployed API routes are authored as plain JS.
  const callbackMod = await import('../../api/github/callback.js') as { default: RouteHandler };
  loginHandler = loginMod.default;
  callbackHandler = callbackMod.default;
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

describe('GitHub OAuth callback', () => {
  it('creates a pending session, exchanges the code server-side, and redirects back to /app without exposing the token', async () => {
    const loginResponse = await loginHandler(new Request('https://app.theora.test/api/github/login?returnTo=%2Fapp%3Fpl%3Dencoded-state%23pipeline'));
    const authorizeLocation = loginResponse.headers.get('location');
    const pendingCookie = loginResponse.headers.get('set-cookie');

    expect(loginResponse.status).toBe(302);
    expect(authorizeLocation).toBeTruthy();
    expect(pendingCookie).toContain('__Host-theora_session=');

    const authorizeUrl = new URL(authorizeLocation!);
    expect(authorizeUrl.origin).toBe('https://github.com');
    expect(authorizeUrl.pathname).toBe('/login/oauth/authorize');
    expect(authorizeUrl.searchParams.get('client_id')).toBe('github-client-id');
    expect(authorizeUrl.searchParams.get('scope')).toBe('gist');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('https://app.theora.test/api/github/callback');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'oauth-token-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'theora-user', avatar_url: 'https://avatars.example/theora-user.png' }),
      });

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });

    const response = await callbackHandler(new Request(
      `https://app.theora.test/api/github/callback?code=code-123&state=${authorizeUrl.searchParams.get('state')}`,
      {
        headers: {
          cookie: pendingCookie!.split(';')[0]!,
        },
      },
    ));

    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('set-cookie')).toContain('__Host-theora_session=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('location')).not.toContain('gh_token');

    const returnUrl = new URL(response.headers.get('location')!);
    expect(returnUrl.origin).toBe('https://app.theora.test');
    expect(returnUrl.pathname).toBe('/app');
    expect(returnUrl.searchParams.get('pl')).toBe('encoded-state');
    expect(returnUrl.searchParams.get('gh_connected')).toBe('1');
    expect(returnUrl.hash).toBe('#pipeline');

    const requestBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<string, string>;
    expect(requestBody.redirect_uri).toBe('https://app.theora.test/api/github/callback');
  });

  it('clears the pending session and redirects back with a safe error when state verification fails', async () => {
    const response = await callbackHandler(new Request('https://app.theora.test/api/github/callback?code=bad-code&state=csrf-state'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://app.theora.test/app?gh_error=GitHub+sign-in+failed.+Please+try+again.');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
