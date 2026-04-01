export const config = { runtime: 'edge' };

import { createUserGist, fetchUserGist, listUserGists } from './_lib/github.js';
import { isSameOriginMutation, jsonResponse } from './_lib/http.js';
import { findEnvelopeFile, parseEnvelope, parseSaveRequest, loadAuthenticatedSession, expireSessionResponse } from './_lib/routeHelpers.js';

async function toTheoraSave(token, gist) {
  try {
    const theoraFile = findEnvelopeFile(gist.files);
    if (!theoraFile) return null;

    let raw = typeof theoraFile.content === 'string' ? theoraFile.content : null;
    if (!raw) {
      const fullGist = await fetchUserGist(token, gist.id);
      const fullFile = findEnvelopeFile(fullGist.files);
      raw = typeof fullFile?.content === 'string' ? fullFile.content : null;
    }

    if (!raw) return null;
    const envelope = parseEnvelope(raw);
    if (!envelope) return null;

    return {
      id: gist.id,
      description: gist.description || `theora ${envelope.demo} save`,
      html_url: gist.html_url,
      created_at: gist.created_at,
      updated_at: gist.updated_at,
      demo: envelope.demo,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
      throw error;
    }
    return null;
  }
}

export default async function handler(request) {
  if (request.method === 'GET') {
    const auth = await loadAuthenticatedSession(request);
    if (auth.response) {
      return auth.response;
    }

    try {
      const gists = await listUserGists(auth.session.token);
      const saves = (await Promise.all(gists.map((gist) => toTheoraSave(auth.session.token, gist))))
        .filter((save) => save !== null);

      return jsonResponse({ saves }, 200, {
        Vary: 'Cookie',
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
        return expireSessionResponse(request, auth.sessionId);
      }
      const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 502;
      return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to list saves' }, status, {
        Vary: 'Cookie',
      });
    }
  }

  if (request.method === 'POST') {
    if (!isSameOriginMutation(request)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const auth = await loadAuthenticatedSession(request);
    if (auth.response) {
      return auth.response;
    }

    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 512_000) {
      return jsonResponse({ error: 'Request body too large' }, 413, {
        Vary: 'Cookie',
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON' }, 400, {
        Vary: 'Cookie',
      });
    }

    try {
      const requestData = parseSaveRequest(payload);
      const result = await createUserGist(auth.session.token, requestData.envelope, requestData.saveName);
      return jsonResponse(result, 201, {
        Vary: 'Cookie',
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
        return expireSessionResponse(request, auth.sessionId);
      }
      const status = error instanceof Error && error.message === 'Invalid theora save payload'
        ? 400
        : error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
          ? error.status
          : 502;
      return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to save gist' }, status, {
        Vary: 'Cookie',
      });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405, {
    Allow: 'GET, POST',
  });
}
