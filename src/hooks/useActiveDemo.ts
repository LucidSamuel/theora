import { useState, useEffect, useCallback } from 'react';
import type { DemoId } from '@/types';
import { getSearchParam, getHashState } from '@/lib/urlState';

function getDemoFromHash(): DemoId {
  const hashState = getHashState();
  if (hashState && ['merkle', 'polynomial', 'accumulator', 'recursive'].includes(hashState.demo)) {
    return hashState.demo as DemoId;
  }
  const hash = window.location.hash.replace('#', '');
  const base = hash.split('|')[0] ?? '';
  if (['merkle', 'polynomial', 'accumulator', 'recursive'].includes(base)) {
    return base as DemoId;
  }
  return 'merkle';
}

export function useActiveDemo() {
  const [activeDemo, setActiveDemo] = useState<DemoId>(() => {
    const embed = getSearchParam('embed') ?? '';
    if (['merkle', 'polynomial', 'accumulator', 'recursive'].includes(embed)) {
      return embed as DemoId;
    }
    return getDemoFromHash();
  });

  useEffect(() => {
    const handleHashChange = () => setActiveDemo(getDemoFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchDemo = useCallback((id: DemoId) => {
    window.location.hash = id;
    setActiveDemo(id);
  }, []);

  return { activeDemo, switchDemo };
}
