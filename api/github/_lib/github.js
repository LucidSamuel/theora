import { DEMO_IDS, GITHUB_SCOPE } from './config.js';
import { getAllowedOrigin } from './http.js';

const VALID_GIST_ID = /^[0-9a-f]{1,40}$/;
const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export function validateGistId(gistId) {
  if (!VALID_GIST_ID.test(gistId)) {
    throw new Error('Invalid Gist ID');
  }
  return gistId;
}

export function buildAuthorizeUrl(request, state) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  url.searchParams.set('scope', GITHUB_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', `${getAllowedOrigin(request)}/api/github/callback`);
  return url.toString();
}

export async function exchangeCodeForAccessToken(request, code) {
  const redirectUri = `${getAllowedOrigin(request)}/api/github/callback`;
  let response;
  let data;

  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    data = await response.json();
  } catch {
    throw new Error('GitHub sign-in failed. Please try again.');
  }

  if (!response.ok || data.error || typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new Error(data?.error_description || data?.error || 'GitHub sign-in failed. Please try again.');
  }

  return data.access_token;
}

export async function fetchGitHubUser(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      ...GITHUB_API_HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('GitHub session expired. Please sign in again.'), { status: response.status });
  }
  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status})`);
  }
  const data = await response.json();
  return {
    login: data.login,
    avatar_url: data.avatar_url,
  };
}

export async function revokeOAuthToken(token) {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET || !token) {
    return;
  }
  const credentials = `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`;
  const basic = typeof Buffer !== 'undefined'
    ? Buffer.from(credentials).toString('base64')
    : btoa(credentials);
  await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`, {
    method: 'DELETE',
    headers: {
      ...GITHUB_API_HEADERS,
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: token }),
  }).catch(() => {});
}

async function githubJson(token, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...GITHUB_API_HEADERS,
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('GitHub session expired. Please sign in again.'), { status: response.status });
  }
  return response;
}

// Note: fetches first 100 gists only. Users with many gists may not see all Theora saves.
// TODO: implement pagination via Link headers if this becomes a real issue.
export async function listUserGists(token) {
  const response = await githubJson(token, 'https://api.github.com/gists?per_page=100');
  if (!response.ok) {
    throw Object.assign(new Error(`Failed to list gists (${response.status})`), { status: response.status });
  }
  return response.json();
}

export async function fetchUserGist(token, gistId) {
  const response = await githubJson(token, `https://api.github.com/gists/${validateGistId(gistId)}`);
  if (!response.ok) {
    throw Object.assign(new Error(`Failed to fetch gist (${response.status})`), { status: response.status });
  }
  return response.json();
}

export async function deleteUserGist(token, gistId) {
  const response = await githubJson(token, `https://api.github.com/gists/${validateGistId(gistId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Failed to delete gist (${response.status})`), { status: response.status });
  }
}

function isImportEnvelope(value) {
  if (!value || typeof value !== 'object') return false;
  return typeof value.demo === 'string' && DEMO_IDS.has(value.demo) && 'state' in value;
}

export function validateImportEnvelope(payload) {
  if (!isImportEnvelope(payload)) {
    throw new Error('Invalid Theora save payload');
  }
  return payload;
}

export function buildGistDescription(payload) {
  const scenarioName = payload && typeof payload.state === 'object' && payload.state && typeof payload.state.scenarioName === 'string'
    ? payload.state.scenarioName
    : null;
  return scenarioName
    ? `Theora ${payload.demo} scenario: ${scenarioName}`
    : `Theora ${payload.demo} save`;
}

function buildGistFilename(saveName) {
  if (!saveName) {
    return 'theora.json';
  }

  const slug = saveName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return `${slug || 'theora-save'}.theora.json`;
}

export async function createUserGist(token, payload, saveName = null) {
  const validated = validateImportEnvelope(payload);
  const response = await githubJson(token, 'https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      public: false,
      description: saveName || buildGistDescription(validated),
      files: {
        [buildGistFilename(saveName)]: {
          content: JSON.stringify(validated, null, 2),
        },
      },
    }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Gist creation failed (${response.status})`), { status: response.status });
  }
  const gist = await response.json();
  return {
    url: gist.html_url,
  };
}
