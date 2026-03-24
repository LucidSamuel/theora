export const config = { runtime: 'edge' };

// Hardcoded allowed origins — never derive from Host header
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://www.theora.dev')
  .split(',')
  .map((o) => o.trim());

function getAllowedOrigin(request) {
  const host = request.headers.get('host') || '';
  for (const origin of ALLOWED_ORIGINS) {
    try {
      const u = new URL(origin);
      if (u.host === host) return origin;
    } catch { /* skip invalid */ }
  }
  return ALLOWED_ORIGINS[0];
}

export default async function handler(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const origin = getAllowedOrigin(request);

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  // CSRF: state parameter is required
  if (!state) {
    return new Response('Missing state parameter', { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response('GitHub OAuth not configured', { status: 500 });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const data = await tokenRes.json();

  if (data.error) {
    const msg = encodeURIComponent(data.error_description || data.error);
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/#gh_error=${msg}` },
    });
  }

  // Pass state back so the client can verify it
  const encodedState = encodeURIComponent(state);
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/#gh_token=${data.access_token}&gh_state=${encodedState}` },
  });
}
