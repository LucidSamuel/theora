export const config = { runtime: 'edge' };

import { deleteUserGist, fetchUserGist, validateGistId } from '../_lib/github.js';
import { isSameOriginMutation, jsonResponse } from '../_lib/http.js';
import { findEnvelopeFile, parseEnvelope, loadAuthenticatedSession, expireSessionResponse } from '../_lib/routeHelpers.js';

function getGistId(request, context) {
  const fromContext = context?.params?.gistId;
  if (typeof fromContext === 'string' && fromContext.length > 0) {
    return fromContext;
  }
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  return segments.at(-1) || '';
}

export default async function handler(request, context) {
  const rawGistId = getGistId(request, context);

  let gistId;
  try {
    gistId = validateGistId(rawGistId);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Invalid Gist ID' }, 400);
  }

  if (request.method === 'GET') {
    const auth = await loadAuthenticatedSession(request);
    if (auth.response) {
      return auth.response;
    }

    try {
      const gist = await fetchUserGist(auth.session.token, gistId);
      const file = findEnvelopeFile(gist.files);
      const raw = typeof file?.content === 'string' ? file.content : null;
      if (!raw) {
        return jsonResponse({ error: 'Gist does not contain a theora JSON file' }, 404, {
          Vary: 'Cookie',
        });
      }

      const envelope = parseEnvelope(raw);
      if (!envelope) {
        return jsonResponse({ error: 'Invalid theora save payload' }, 422, {
          Vary: 'Cookie',
        });
      }

      return jsonResponse(envelope, 200, {
        Vary: 'Cookie',
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
        return expireSessionResponse(request, auth.sessionId);
      }
      const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 502;
      return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to load save' }, status, {
        Vary: 'Cookie',
      });
    }
  }

  if (request.method === 'DELETE') {
    if (!isSameOriginMutation(request)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const auth = await loadAuthenticatedSession(request);
    if (auth.response) {
      return auth.response;
    }

    try {
      await deleteUserGist(auth.session.token, gistId);
      return jsonResponse({ ok: true }, 200, {
        Vary: 'Cookie',
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
        return expireSessionResponse(request, auth.sessionId);
      }
      const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 502;
      return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to delete save' }, status, {
        Vary: 'Cookie',
      });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405, {
    Allow: 'GET, DELETE',
  });
}
