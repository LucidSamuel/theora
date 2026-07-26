import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DemoId } from '@/types';

export interface SecurityState {
  fieldSize: bigint;
  /** Degree of polynomial (per-variable for multilinear, total for univariate) */
  degree?: number;
  /** Number of protocol rounds (e.g., sumcheck rounds, FRI fold rounds) */
  numRounds?: number;
  /** Number of query repetitions (FRI) */
  numQueries?: number;
  /** Number of circuit layers (GKR) */
  numLayers?: number;
}

export interface InfoContextEntry {
  title: string;
  body: string;
  nextSteps?: string[];
  glossary?: { term: string; definition: string }[];
  securityState?: SecurityState;
  updatedAt: number;
}

interface InfoContextValue {
  entries: Partial<Record<DemoId, InfoContextEntry>>;
  setEntry: (demoId: DemoId, entry: Omit<InfoContextEntry, 'updatedAt'> | null) => void;
}

const InfoContext = createContext<InfoContextValue | null>(null);

export function InfoProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Partial<Record<DemoId, InfoContextEntry>>>({});

  const setEntry = useCallback((demoId: DemoId, entry: Omit<InfoContextEntry, 'updatedAt'> | null) => {
    setEntries((prev) => {
      if (!entry) {
        const next = { ...prev };
        delete next[demoId];
        return next;
      }
      return { ...prev, [demoId]: { ...entry, updatedAt: Date.now() } };
    });
  }, []);

  const value = useMemo<InfoContextValue>(() => ({ entries, setEntry }), [entries, setEntry]);

  return <InfoContext.Provider value={value}>{children}</InfoContext.Provider>;
}

export function useInfoPanel(): InfoContextValue {
  const ctx = useContext(InfoContext);
  if (!ctx) {
    throw new Error('useInfoPanel must be used within InfoProvider');
  }
  return ctx;
}
