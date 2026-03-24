import { useState, useEffect, useCallback } from 'react';
import type { DemoId } from '@/types';
import { isDemoId } from '@/types';
import { getSearchParam, getHashState } from '@/lib/urlState';

export interface ActiveDemoLocation {
  activeDemo: DemoId;
  locationKey: string;
}

const SEARCH_PARAM_DEMO_KEYS: Array<[string, DemoId]> = [
  ['pl', 'pipeline'],
  ['m', 'merkle'],
  ['p', 'polynomial'],
  ['a', 'accumulator'],
  ['r', 'recursive'],
  ['fs', 'fiat-shamir'],
  ['c', 'circuit'],
  ['e', 'elliptic'],
  ['l', 'lookup'],
  ['ped', 'pedersen'],
  ['plk', 'plonk'],
  ['g16', 'groth16'],
];

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

  const embed = getSearchParam('embed') ?? '';
  if (isDemoId(embed)) {
    return {
      activeDemo: embed,
      locationKey: `embed:${embed}`,
    };
  }

  for (const [param, demo] of SEARCH_PARAM_DEMO_KEYS) {
    const value = getSearchParam(param);
    if (value) {
      return {
        activeDemo: demo,
        locationKey: `${demo}:${value}`,
      };
    }
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
    const handleLocationChange = () => setLocation(getActiveDemoLocation());
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
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
