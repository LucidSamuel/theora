import { useState, useEffect, useCallback } from 'react';
import type { DemoId } from '@/types';
import { getSearchParam, getHashState } from '@/lib/urlState';

const VALID_DEMOS: DemoId[] = ['merkle', 'polynomial', 'accumulator', 'recursive', 'elliptic', 'fiat-shamir', 'circuit', 'lookup'];

function getDemoFromHash(): DemoId {
  const hashState = getHashState();
  if (hashState && VALID_DEMOS.includes(hashState.demo as DemoId)) {
    return hashState.demo as DemoId;
  }
  const hash = window.location.hash.replace('#', '');
  const base = hash.split('|')[0] ?? '';
  if (VALID_DEMOS.includes(base as DemoId)) {
    return base as DemoId;
  }
  return 'merkle';
}

export function useActiveDemo() {
  const [activeDemo, setActiveDemo] = useState<DemoId>(() => {
    const embed = getSearchParam('embed') ?? '';
    if (VALID_DEMOS.includes(embed as DemoId)) {
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
