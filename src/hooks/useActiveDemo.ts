import { useState, useEffect, useCallback } from 'react';
import type { DemoId } from '@/types';
import { isDemoId } from '@/types';
import { getSearchParam, getHashState } from '@/lib/urlState';

export interface ActiveDemoLocation {
  activeDemo: DemoId;
  locationKey: string;
}

export function getActiveDemoLocation(): ActiveDemoLocation {
  const hashState = getHashState();
  if (hashState && isDemoId(hashState.demo)) {
    return {
      activeDemo: hashState.demo,
      locationKey: `${hashState.demo}|${hashState.state}`,
    };
  }

  const hash = window.location.hash.replace('#', '');
  const base = hash.split('|')[0] ?? '';
  if (isDemoId(base)) {
    return {
      activeDemo: base,
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
    if (isDemoId(embed)) {
      return {
        activeDemo: embed,
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
