import { DEMO_IDS } from './config.js';
import { jsonResponse } from './http.js';
import { buildClearedSessionCookie, destroySession, isGitHubServerAuthAvailable, loadSessionFromRequest } from './session.js';

export function parseEnvelope(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.demo !== 'string' || !DEMO_IDS.has(parsed.demo) || !('state' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loadAuthenticatedSession(request) {
  if (!isGitHubServerAuthAvailable()) {
    return {
      response: jsonResponse({ error: 'GitHub save/load is unavailable on this deployment.' }, 503),
      session: null,
      sessionId: null,
    };
  }

  const { sessionId, session } = await loadSessionFromRequest(request);
  if (!session || session.kind !== 'authenticated') {
    return {
      response: jsonResponse({ error: 'GitHub session expired. Reconnect and try again.' }, 401, {
        Vary: 'Cookie',
        ...(sessionId ? { 'Set-Cookie': buildClearedSessionCookie(request) } : {}),
      }),
      session: null,
      sessionId,
    };
  }

  return { response: null, session, sessionId };
}

export async function expireSessionResponse(request, sessionId) {
  if (sessionId) {
    await destroySession(sessionId);
  }
  return jsonResponse({ error: 'GitHub session expired. Reconnect and try again.' }, 401, {
    'Set-Cookie': buildClearedSessionCookie(request),
    Vary: 'Cookie',
  });
}
