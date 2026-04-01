import { createContext, useContext, type ReactNode } from 'react';
import type { ModeId } from './types';
import { useActiveMode } from './useActiveMode';

interface ModeContextValue {
  mode: ModeId;
  setMode: (id: ModeId) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'explore',
  setMode: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const { mode, setMode } = useActiveMode();
  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  return useContext(ModeContext);
}
