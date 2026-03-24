export const config = { runtime: 'edge' };

import { buildAuthorizeUrl } from './_lib/github.js';
import { appErrorRedirect, normalizeReturnTo, redirectResponse } from './_lib/http.js';
import { createPendingSession, createSessionId, destroySession, isGitHubServerAuthAvailable, loadSessionFromRequest } from './_lib/session.js';

export default async function handler(request) {
  if (!isGitHubServerAuthAvailable()) {
    return appErrorRedirect(request, 'GitHub save/load is unavailable on this deployment.');
  }

  const url = new URL(request.url);
  const returnTo = normalizeReturnTo(url.searchParams.get('returnTo'));

  try {
    const { sessionId } = await loadSessionFromRequest(request);
    if (sessionId) {
      await destroySession(sessionId);
    }

    const oauthState = createSessionId();
    const { cookie } = await createPendingSession(request, oauthState, returnTo);
    return redirectResponse(buildAuthorizeUrl(request, oauthState), {
      'Set-Cookie': cookie,
    });
  } catch {
    return appErrorRedirect(request, 'GitHub sign-in failed. Please try again.');
  }
}
