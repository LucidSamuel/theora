import { useState, useCallback } from 'react';
import type { ModeId } from './types';
import { isModeId } from './types';
import { getSearchParam } from '@/lib/urlState';

function getModeFromUrl(): ModeId {
  const param = getSearchParam('mode');
  if (param && isModeId(param)) return param;
  return 'explore';
}

export function useActiveMode() {
  const [mode, setModeState] = useState<ModeId>(getModeFromUrl);

  const setMode = useCallback((id: ModeId) => {
    setModeState(id);
    const params = new URLSearchParams(window.location.search);
    if (id === 'explore') {
      params.delete('mode');
    } else {
      params.set('mode', id);
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, []);

  return { mode, setMode };
}
