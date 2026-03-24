import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GitHubUser } from '@/lib/githubImport';
import { fetchGitHubUser } from '@/lib/githubImport';

const STORAGE_KEY = 'theora:gist-token';
const OAUTH_RETURN_KEY = 'theora:oauth_return';
const OAUTH_STATE_KEY = 'theora:oauth_state';

function generateOAuthState(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isSameOriginUrl(url: string): boolean {
  try {
    const target = new URL(url, window.location.origin);
    return target.origin === window.location.origin;
  } catch {
    return false;
  }
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface GitHubContextValue {
  status: ConnectionStatus;
  user: GitHubUser | null;
  error: string | null;
  oauthAvailable: boolean;
  connect: (token: string, persist: boolean) => Promise<void>;
  startOAuth: () => void;
  disconnect: () => void;
  getToken: () => string | null;
  connectOpen: boolean;
  setConnectOpen: (open: boolean) => void;
  savesOpen: boolean;
  setSavesOpen: (open: boolean) => void;
}

const GitHubContext = createContext<GitHubContextValue>({
  status: 'disconnected',
  user: null,
  error: null,
  oauthAvailable: false,
  connect: async () => {},
  startOAuth: () => {},
  disconnect: () => {},
  getToken: () => null,
  connectOpen: false,
  setConnectOpen: () => {},
  savesOpen: false,
  setSavesOpen: () => {},
});

export function GitHubProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const oauthClientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
  const oauthAvailable = Boolean(oauthClientId);

  // On mount: check for OAuth callback in hash, then try localStorage
  useEffect(() => {
    const hash = window.location.hash;

    // Handle OAuth success callback
    if (hash.includes('gh_token=')) {
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get('gh_token');
      const returnedState = params.get('gh_state');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      // CSRF verification: state must match what we stored before redirect
      const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
      sessionStorage.removeItem(OAUTH_STATE_KEY);

      if (!token || !returnedState || returnedState !== expectedState) {
        setStatus('error');
        setError('OAuth state mismatch — possible CSRF attack. Please try again.');
        return;
      }

      tokenRef.current = token;
      setStatus('connecting');
      fetchGitHubUser(token)
        .then((u) => {
          setUser(u);
          setStatus('connected');
          // Respect user's persistence preference — only persist if they previously opted in
          // (i.e. they already have a stored token). OAuth tokens are session-only by default.
          if (window.localStorage.getItem(STORAGE_KEY)) {
            window.localStorage.setItem(STORAGE_KEY, token);
          }
          // Restore the page the user was on before OAuth redirect
          const returnUrl = sessionStorage.getItem(OAUTH_RETURN_KEY);
          sessionStorage.removeItem(OAUTH_RETURN_KEY);
          if (returnUrl && isSameOriginUrl(returnUrl)) {
            window.location.href = returnUrl;
          }
        })
        .catch(() => {
          setStatus('error');
          setError('GitHub authentication failed');
        });
      return;
    }

    // Handle OAuth error callback
    if (hash.startsWith('#gh_error=')) {
      const msg = decodeURIComponent(hash.slice('#gh_error='.length));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setError(msg);
      return;
    }

    // Normal auto-connect from persisted token
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    tokenRef.current = saved;
    setStatus('connecting');
    fetchGitHubUser(saved)
      .then((u) => {
        setUser(u);
        setStatus('connected');
      })
      .catch(() => {
        tokenRef.current = null;
        window.localStorage.removeItem(STORAGE_KEY);
        setStatus('disconnected');
      });
  }, []);

  const connect = useCallback(async (token: string, persist: boolean) => {
    setStatus('connecting');
    setError(null);
    try {
      const u = await fetchGitHubUser(token);
      tokenRef.current = token;
      setUser(u);
      setStatus('connected');
      if (persist) {
        window.localStorage.setItem(STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setStatus('disconnected');
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const startOAuth = useCallback(() => {
    if (!oauthClientId) return;
    // CSRF protection: generate random state and verify on callback
    const state = generateOAuthState();
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    // Save current URL so we can restore after redirect
    sessionStorage.setItem(OAUTH_RETURN_KEY, window.location.href);
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', oauthClientId);
    url.searchParams.set('scope', 'gist');
    url.searchParams.set('state', state);
    window.location.href = url.toString();
  }, [oauthClientId]);

  const getToken = useCallback(() => tokenRef.current, []);

  return (
    <GitHubContext.Provider
      value={{
        status,
        user,
        error,
        oauthAvailable,
        connect,
        startOAuth,
        disconnect,
        getToken,
        connectOpen,
        setConnectOpen,
        savesOpen,
        setSavesOpen,
      }}
    >
      {children}
    </GitHubContext.Provider>
  );
}

export function useGitHub() {
  return useContext(GitHubContext);
}
