import type { ReactNode } from 'react';

/**
 * ExploreMode is the default mode — a transparent passthrough
 * that renders existing demo content unchanged.
 */
export function ExploreMode({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
