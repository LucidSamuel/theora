import { useState, useEffect, useCallback } from 'react';
import type { DemoId } from '@/types';
import { isDemoId } from '@/types';
import { getSearchParam, getHashState } from '@/lib/urlState';
import { trackDemoOpened } from '@/lib/analytics';

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
  ['sa', 'split-accumulation'],
  ['rr', 'rerandomization'],
  ['os', 'oblivious-sync'],
  ['fs', 'fiat-shamir'],
  ['c', 'circuit'],
  ['e', 'elliptic'],
  ['l', 'lookup'],
  ['ped', 'pedersen'],
  ['cc', 'constraint-counter'],
  ['plk', 'plonk'],
  ['g16', 'groth16'],
  ['sc', 'sumcheck'],
  ['fri', 'fri'],
  ['nova', 'nova'],
  ['mle', 'mle'],
  ['gkr', 'gkr'],
];

const MODE_PARAM_KEYS = ['scenario', 'step', 'src', 'inputs', 'field'] as const;

export function clearCrossDemoParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [paramKey] of SEARCH_PARAM_DEMO_KEYS) {
    next.delete(paramKey);
  }
  for (const key of MODE_PARAM_KEYS) {
    next.delete(key);
  }
  if (next.get('mode') === 'debug') {
    next.delete('mode');
  }
  return next;
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
    activeDemo: 'pipeline',
    locationKey: 'pipeline',
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
    // Clear demo-scoped params to prevent state from leaking across demos.
    const params = clearCrossDemoParams(new URLSearchParams(window.location.search));
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);

    trackDemoOpened(id, 'sidebar');
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
