import { useState, useEffect, useCallback } from 'react';
import type { DemoId } from '@/types';
import { getSearchParam, getHashState } from '@/lib/urlState';

const VALID_DEMOS: DemoId[] = ['pipeline', 'merkle', 'polynomial', 'accumulator', 'recursive', 'elliptic', 'fiat-shamir', 'circuit', 'lookup'];

export interface ActiveDemoLocation {
  activeDemo: DemoId;
  locationKey: string;
}

export function getActiveDemoLocation(): ActiveDemoLocation {
  const hashState = getHashState();
  if (hashState && VALID_DEMOS.includes(hashState.demo as DemoId)) {
    return {
      activeDemo: hashState.demo as DemoId,
      locationKey: `${hashState.demo}|${hashState.state}`,
    };
  }

  const hash = window.location.hash.replace('#', '');
  const base = hash.split('|')[0] ?? '';
  if (VALID_DEMOS.includes(base as DemoId)) {
    return {
      activeDemo: base as DemoId,
      locationKey: base,
    };
  }

  return {
    activeDemo: 'merkle',
    locationKey: 'merkle',
  };
}

export function useActiveDemo() {
  const [location, setLocation] = useState<ActiveDemoLocation>(() => {
    const embed = getSearchParam('embed') ?? '';
    if (VALID_DEMOS.includes(embed as DemoId)) {
      return {
        activeDemo: embed as DemoId,
        locationKey: `embed:${embed}`,
      };
    }
    return getActiveDemoLocation();
  });

  useEffect(() => {
    const handleHashChange = () => setLocation(getActiveDemoLocation());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchDemo = useCallback((id: DemoId) => {
    window.location.hash = id;
    setLocation({
      activeDemo: id,
      locationKey: id,
    });
  }, []);

  return {
    activeDemo: location.activeDemo,
    activeLocationKey: location.locationKey,
    switchDemo,
  };
}
