import { AUTH_SESSION_TTL_SECONDS, PENDING_SESSION_TTL_SECONDS, SESSION_COOKIE_BASENAME } from './config.js';
import { hasSessionSecret, sealSession, unsealSession } from './crypto.js';
import { getSessionCookieName, parseCookies, serializeSessionCookie, clearSessionCookie } from './http.js';
import { isSessionStoreAvailable, saveSessionValue, getSessionValue, deleteSessionValue } from './store.js';

export function isGitHubServerAuthAvailable() {
  return Boolean(process.env.GITHUB_CLIENT_ID)
    && Boolean(process.env.GITHUB_CLIENT_SECRET)
    && hasSessionSecret()
    && isSessionStoreAvailable();
}

export function createSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function saveSessionRecord(request, sessionId, payload, ttlSeconds) {
  const sealed = await sealSession({
    ...payload,
    exp: Date.now() + ttlSeconds * 1000,
  });
  await saveSessionValue(sessionId, sealed, ttlSeconds);
  return serializeSessionCookie(request, sessionId, ttlSeconds);
}

export async function createPendingSession(request, oauthState, returnTo) {
  const sessionId = createSessionId();
  const cookie = await saveSessionRecord(request, sessionId, {
    kind: 'pending',
    oauthState,
    returnTo,
  }, PENDING_SESSION_TTL_SECONDS);
  return { sessionId, cookie };
}

export async function createAuthenticatedSession(request, token, user, returnTo) {
  const sessionId = createSessionId();
  const cookie = await saveSessionRecord(request, sessionId, {
    kind: 'authenticated',
    token,
    user,
    returnTo,
  }, AUTH_SESSION_TTL_SECONDS);
  return { sessionId, cookie };
}

const SESSION_ID_PATTERN = /^[0-9a-f]{48}$/;

export async function loadSessionFromRequest(request) {
  const cookies = parseCookies(request);
  const sessionId = cookies[getSessionCookieName(request)]
    || cookies[`__Host-${SESSION_COOKIE_BASENAME}`]
    || cookies[SESSION_COOKIE_BASENAME];
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return { sessionId: null, session: null };
  }
  const sealed = await getSessionValue(sessionId);
  if (!sealed) {
    return { sessionId, session: null };
  }
  const session = await unsealSession(sealed);
  if (!session) {
    await deleteSessionValue(sessionId);
    return { sessionId, session: null };
  }
  return { sessionId, session };
}

export async function destroySession(sessionId) {
  if (!sessionId) return;
  await deleteSessionValue(sessionId);
}

export function buildClearedSessionCookie(request) {
  return clearSessionCookie(request);
}
