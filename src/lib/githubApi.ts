import type { GitHubUser, TheoraImportEnvelope, TheoraSave } from '@/lib/githubImport';

export interface GitHubSessionInfo {
  available: boolean;
  connected: boolean;
  user: GitHubUser | null;
}

export class GitHubSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubSessionError';
  }
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text ? { error: text } : null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

async function requestGitHubApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  const payload = await parseResponsePayload(response);

  if (response.status === 401) {
    throw new GitHubSessionError(getErrorMessage(payload, 'GitHub session expired. Reconnect and try again.'));
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `GitHub request failed (${response.status})`));
  }

  return payload as T;
}

export async function fetchGitHubSession(): Promise<GitHubSessionInfo> {
  return requestGitHubApi<GitHubSessionInfo>('/api/github/session');
}

export function startGitHubOAuth(returnTo: string): void {
  const url = new URL('/api/github/login', window.location.origin);
  url.searchParams.set('returnTo', returnTo);
  window.location.assign(url.toString());
}

export async function logoutGitHubSession(): Promise<void> {
  await requestGitHubApi<{ ok: true }>('/api/github/logout', {
    method: 'POST',
  });
}

export async function listGitHubSaves(): Promise<TheoraSave[]> {
  const payload = await requestGitHubApi<{ saves: TheoraSave[] }>('/api/github/gists');
  return payload.saves;
}

export async function createGitHubSave(envelope: TheoraImportEnvelope): Promise<{ url: string }> {
  return requestGitHubApi<{ url: string }>('/api/github/gists', {
    method: 'POST',
    body: JSON.stringify(envelope),
  });
}

export async function fetchGitHubSave(gistId: string): Promise<TheoraImportEnvelope> {
  return requestGitHubApi<TheoraImportEnvelope>(`/api/github/gists/${encodeURIComponent(gistId)}`);
}

export async function deleteGitHubSave(gistId: string): Promise<void> {
  await requestGitHubApi<{ ok: true }>(`/api/github/gists/${encodeURIComponent(gistId)}`, {
    method: 'DELETE',
  });
}
