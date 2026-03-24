export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
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

  // Determine the origin to redirect back to
  const host = request.headers.get('host') || 'localhost:5173';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const origin = `${proto}://${host}`;

  if (data.error) {
    const msg = encodeURIComponent(data.error_description || data.error);
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/#gh_error=${msg}` },
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/#gh_token=${data.access_token}` },
  });
}
