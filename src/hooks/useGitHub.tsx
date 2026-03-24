import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GitHubUser } from '@/lib/githubImport';
import { fetchGitHubUser } from '@/lib/githubImport';

const STORAGE_KEY = 'theora:gist-token';
const OAUTH_RETURN_KEY = 'theora:oauth_return';

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
    if (hash.startsWith('#gh_token=')) {
      const token = hash.slice('#gh_token='.length);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      tokenRef.current = token;
      setStatus('connecting');
      fetchGitHubUser(token)
        .then((u) => {
          setUser(u);
          setStatus('connected');
          window.localStorage.setItem(STORAGE_KEY, token);
          // Restore the page the user was on before OAuth redirect
          const returnUrl = sessionStorage.getItem(OAUTH_RETURN_KEY);
          sessionStorage.removeItem(OAUTH_RETURN_KEY);
          if (returnUrl) window.location.href = returnUrl;
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
    // Save current URL so we can restore after redirect
    sessionStorage.setItem(OAUTH_RETURN_KEY, window.location.href);
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', oauthClientId);
    url.searchParams.set('scope', 'gist');
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
