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

function isEnvelopeCandidate(file) {
  return Boolean(file)
    && typeof file === 'object'
    && (typeof file.content === 'string'
      || typeof file.filename === 'string'
      || typeof file.type === 'string');
}

export function findEnvelopeFile(files) {
  const entries = Object.values(files || {}).filter(isEnvelopeCandidate);
  if (entries.length === 0) return null;

  const preferred = entries.find((file) => file.filename === 'theora.json')
    || entries.find((file) => typeof file.filename === 'string' && file.filename.endsWith('.theora.json'))
    || entries.find((file) => typeof file.content === 'string' && parseEnvelope(file.content))
    || entries.find((file) => typeof file.type === 'string' && file.type === 'application/json')
    || entries.find((file) => typeof file.filename === 'string' && file.filename.endsWith('.json'))
    || entries.find((file) => typeof file.content === 'string');

  return preferred || null;
}

export function normalizeSaveName(raw) {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.slice(0, 80);
}

export function parseSaveRequest(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      envelope: payload,
      saveName: null,
    };
  }

  if ('envelope' in payload) {
    return {
      envelope: payload.envelope,
      saveName: normalizeSaveName(payload.saveName),
    };
  }

  return {
    envelope: payload,
    saveName: normalizeSaveName(payload.saveName),
  };
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
