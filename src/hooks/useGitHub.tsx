import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GitHubUser } from '@/lib/githubImport';
import { fetchGitHubUser } from '@/lib/githubImport';

const STORAGE_KEY = 'theora:gist-token';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface GitHubContextValue {
  status: ConnectionStatus;
  user: GitHubUser | null;
  error: string | null;
  connect: (token: string, persist: boolean) => Promise<void>;
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
  connect: async () => {},
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

  // Auto-connect on mount if a persisted token exists
  useEffect(() => {
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

  const getToken = useCallback(() => tokenRef.current, []);

  return (
    <GitHubContext.Provider
      value={{
        status,
        user,
        error,
        connect,
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
