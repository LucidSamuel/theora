import { APP_PATH, SESSION_COOKIE_BASENAME, getAllowedOrigins } from './config.js';

export function getRequestOrigin(request) {
  return new URL(request.url).origin.replace(/\/$/, '');
}

export function getAllowedOrigin(request) {
  const requestOrigin = getRequestOrigin(request);
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0];
}

export function normalizeReturnTo(rawValue) {
  if (!rawValue) return APP_PATH;
  try {
    const url = new URL(rawValue, 'https://theora.local');
    if (url.origin !== 'https://theora.local') return APP_PATH;
    if (url.pathname !== APP_PATH) return APP_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return APP_PATH;
  }
}

export function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const cookies = {};
  for (const entry of raw.split(';')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  return cookies;
}

export function shouldUseSecureCookies(request) {
  const url = new URL(request.url);
  return url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

export function getSessionCookieName(request) {
  return shouldUseSecureCookies(request)
    ? `__Host-${SESSION_COOKIE_BASENAME}`
    : SESSION_COOKIE_BASENAME;
}

export function serializeSessionCookie(request, sessionId, maxAgeSeconds) {
  const parts = [
    `${getSessionCookieName(request)}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    'Priority=High',
  ];
  if (shouldUseSecureCookies(request)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearSessionCookie(request) {
  const parts = [
    `${getSessionCookieName(request)}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Priority=High',
  ];
  if (shouldUseSecureCookies(request)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildHeaders(extraHeaders = {}) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  };
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: buildHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    }),
  });
}

export function redirectResponse(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: buildHeaders({
      Location: location,
      ...headers,
    }),
  });
}

export function buildAppRedirectUrl(request, returnTo = APP_PATH, params = {}) {
  const target = normalizeReturnTo(returnTo);
  const url = new URL(target, getAllowedOrigin(request));
  url.searchParams.delete('gh_error');
  url.searchParams.delete('gh_connected');
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function appErrorRedirect(request, message, headers = {}) {
  return redirectResponse(buildAppRedirectUrl(request, APP_PATH, { gh_error: message }), headers);
}

export function isSameOriginMutation(request) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin.replace(/\/$/, '') === getRequestOrigin(request);
}
