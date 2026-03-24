import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { GitHubUser } from '@/lib/githubImport';
import { fetchGitHubSession, logoutGitHubSession, startGitHubOAuth as startGitHubOAuthFlow } from '@/lib/githubApi';
import { showToast } from '@/lib/toast';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface GitHubContextValue {
  status: ConnectionStatus;
  user: GitHubUser | null;
  error: string | null;
  oauthAvailable: boolean;
  startOAuth: () => void;
  disconnect: () => Promise<void>;
  refreshSession: () => Promise<void>;
  handleSessionExpired: (message?: string) => Promise<void>;
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
  startOAuth: () => {},
  disconnect: async () => {},
  refreshSession: async () => {},
  handleSessionExpired: async () => {},
  connectOpen: false,
  setConnectOpen: () => {},
  savesOpen: false,
  setSavesOpen: () => {},
});

function getSafeReturnPath(): string {
  const { pathname, search, hash } = window.location;
  return pathname === '/app' ? `${pathname}${search}${hash}` : '/app';
}

function consumeGitHubStatusParams(): { connected: boolean; error: string | null } {
  const url = new URL(window.location.href);
  const connected = url.searchParams.get('gh_connected') === '1';
  const error = url.searchParams.get('gh_error');

  if (!connected && !error) {
    return { connected: false, error: null };
  }

  url.searchParams.delete('gh_connected');
  url.searchParams.delete('gh_error');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);

  return {
    connected,
    error,
  };
}

export function GitHubProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    setStatus('connecting');
    try {
      const session = await fetchGitHubSession();
      setOauthAvailable(session.available);

      if (session.connected && session.user) {
        setUser(session.user);
        setStatus('connected');
        setError(null);
        return;
      }

      setUser(null);
      setStatus('disconnected');
      setError(null);
    } catch (err) {
      setUser(null);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'GitHub session check failed');
      throw err;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const { connected, error: callbackError } = consumeGitHubStatusParams();

    const bootstrap = async () => {
      setStatus('connecting');
      try {
        const session = await fetchGitHubSession();
        if (!active) return;

        setOauthAvailable(session.available);

        if (session.connected && session.user) {
          setUser(session.user);
          setStatus('connected');
          setError(null);
          if (connected) {
            showToast(`Connected as ${session.user.login}`);
          }
          return;
        }

        setUser(null);
        setStatus('disconnected');

        if (callbackError) {
          setError(callbackError);
          setConnectOpen(true);
          showToast(callbackError, 'error');
          return;
        }

        if (connected) {
          const msg = 'GitHub sign-in failed — please try again.';
          setError(msg);
          setConnectOpen(true);
          showToast(msg, 'error');
          return;
        }

        setError(null);
      } catch (err) {
        if (!active) return;
        const msg = callbackError || (err instanceof Error ? err.message : 'GitHub session check failed');
        setUser(null);
        setStatus('error');
        setError(msg);
        if (callbackError || connected) {
          setConnectOpen(true);
          showToast(msg, 'error');
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await logoutGitHubSession();
    } catch {
      // Local state is cleared even if the backend logout request fails.
    }
    setUser(null);
    setStatus('disconnected');
    setError(null);
    setSavesOpen(false);
  }, []);

  const handleSessionExpired = useCallback(async (message = 'GitHub session expired — reconnect to continue') => {
    try {
      await logoutGitHubSession();
    } catch {
      // Ignore logout cleanup failures; the reconnect path still works.
    }
    setUser(null);
    setStatus('disconnected');
    setError(message);
    setSavesOpen(false);
    setConnectOpen(true);
    showToast(message, 'error');
  }, []);

  const startOAuth = useCallback(() => {
    if (!oauthAvailable) {
      const msg = 'GitHub save/load is unavailable on this deployment.';
      setError(msg);
      showToast(msg, 'error');
      return;
    }
    setError(null);
    startGitHubOAuthFlow(getSafeReturnPath());
  }, [oauthAvailable]);

  return (
    <GitHubContext.Provider
      value={{
        status,
        user,
        error,
        oauthAvailable,
        startOAuth,
        disconnect,
        refreshSession,
        handleSessionExpired,
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
