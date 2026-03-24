export const config = { runtime: 'edge' };

import { revokeOAuthToken } from './_lib/github.js';
import { isSameOriginMutation, jsonResponse } from './_lib/http.js';
import { buildClearedSessionCookie, destroySession, loadSessionFromRequest } from './_lib/session.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, {
      Allow: 'POST',
    });
  }

  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const { sessionId, session } = await loadSessionFromRequest(request);
  if (sessionId) {
    await destroySession(sessionId);
  }

  if (session && session.kind === 'authenticated') {
    await revokeOAuthToken(session.token);
  }

  return jsonResponse({ ok: true }, 200, {
    'Set-Cookie': buildClearedSessionCookie(request),
    Vary: 'Cookie',
  });
}
