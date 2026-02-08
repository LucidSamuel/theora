import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DemoId } from '@/types';

export interface InfoContextEntry {
  title: string;
  body: string;
  nextSteps?: string[];
  glossary?: { term: string; definition: string }[];
  updatedAt: number;
}

interface InfoContextValue {
  entries: Partial<Record<DemoId, InfoContextEntry>>;
  setEntry: (demoId: DemoId, entry: Omit<InfoContextEntry, 'updatedAt'> | null) => void;
}

const InfoContext = createContext<InfoContextValue | null>(null);

export function InfoProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Partial<Record<DemoId, InfoContextEntry>>>({});

  const value = useMemo<InfoContextValue>(
    () => ({
      entries,
      setEntry: (demoId, entry) => {
        setEntries((prev) => {
          if (!entry) {
            const next = { ...prev };
            delete next[demoId];
            return next;
          }
          return {
            ...prev,
            [demoId]: { ...entry, updatedAt: Date.now() },
          };
        });
      },
    }),
    [entries]
  );

  return <InfoContext.Provider value={value}>{children}</InfoContext.Provider>;
}

export function useInfoPanel(): InfoContextValue {
  const ctx = useContext(InfoContext);
  if (!ctx) {
    throw new Error('useInfoPanel must be used within InfoProvider');
  }
  return ctx;
}
