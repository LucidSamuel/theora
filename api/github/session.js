export const config = { runtime: 'edge' };

import { jsonResponse } from './_lib/http.js';
import { buildClearedSessionCookie, isGitHubServerAuthAvailable, loadSessionFromRequest } from './_lib/session.js';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, {
      Allow: 'GET',
    });
  }

  if (!isGitHubServerAuthAvailable()) {
    return jsonResponse({
      available: false,
      connected: false,
      user: null,
    }, 200, {
      Vary: 'Cookie',
    });
  }

  const { sessionId, session } = await loadSessionFromRequest(request);
  if (!session || session.kind !== 'authenticated') {
    return jsonResponse({
      available: true,
      connected: false,
      user: null,
    }, 200, {
      Vary: 'Cookie',
      ...(sessionId ? { 'Set-Cookie': buildClearedSessionCookie(request) } : {}),
    });
  }

  return jsonResponse({
    available: true,
    connected: true,
    user: session.user,
  }, 200, {
    Vary: 'Cookie',
  });
}
