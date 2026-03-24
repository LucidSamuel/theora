export const config = { runtime: 'edge' };

import { APP_PATH } from './_lib/config.js';
import { exchangeCodeForAccessToken, fetchGitHubUser, revokeOAuthToken } from './_lib/github.js';
import { buildAppRedirectUrl, redirectResponse } from './_lib/http.js';
import {
  buildClearedSessionCookie,
  createAuthenticatedSession,
  destroySession,
  isGitHubServerAuthAvailable,
  loadSessionFromRequest,
} from './_lib/session.js';

function errorRedirect(request, returnTo, message, cookie) {
  return redirectResponse(buildAppRedirectUrl(request, returnTo, { gh_error: message }), {
    ...(cookie ? { 'Set-Cookie': cookie } : {}),
  });
}

export default async function handler(request) {
  if (!isGitHubServerAuthAvailable()) {
    return errorRedirect(request, APP_PATH, 'GitHub save/load is unavailable on this deployment.');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const { sessionId, session } = await loadSessionFromRequest(request);
  const returnTo = session && typeof session.returnTo === 'string' ? session.returnTo : APP_PATH;
  const clearedCookie = buildClearedSessionCookie(request);

  if (!code || !returnedState || !sessionId || !session || session.kind !== 'pending') {
    if (sessionId) {
      await destroySession(sessionId);
    }
    return errorRedirect(request, returnTo, 'GitHub sign-in failed. Please try again.', clearedCookie);
  }

  if (session.oauthState !== returnedState) {
    await destroySession(sessionId);
    return errorRedirect(request, returnTo, 'GitHub sign-in failed. Please try again.', clearedCookie);
  }

  let token;
  try {
    token = await exchangeCodeForAccessToken(request, code);
  } catch {
    await destroySession(sessionId);
    return errorRedirect(request, returnTo, 'GitHub sign-in failed. Please try again.', clearedCookie);
  }

  try {
    const user = await fetchGitHubUser(token);
    await destroySession(sessionId);
    const { cookie } = await createAuthenticatedSession(request, token, user, returnTo);
    return redirectResponse(buildAppRedirectUrl(request, returnTo, { gh_connected: '1' }), {
      'Set-Cookie': cookie,
    });
  } catch {
    await destroySession(sessionId);
    await revokeOAuthToken(token);
    return errorRedirect(request, returnTo, 'GitHub sign-in failed. Please try again.', clearedCookie);
  }
}
