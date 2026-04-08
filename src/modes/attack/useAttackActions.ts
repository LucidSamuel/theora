import { useEffect, useRef } from 'react';
import { useMode } from '@/modes/ModeProvider';

/**
 * Hook that bridges attack scenario demo actions to local demo state setters.
 *
 * `handlers` maps action type strings to callbacks that execute the demo-specific
 * state change. The hook watches `currentDemoAction` from the AttackProvider and
 * dispatches the corresponding handler when it changes.
 *
 * Only active when mode === 'attack'.
 */
export function useAttackActions(
  currentDemoAction: { type: string; payload?: unknown } | null,
  handlers: Record<string, (payload: unknown) => void>,
) {
  const { mode } = useMode();
  const lastActionRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'attack' || !currentDemoAction) {
      lastActionRef.current = null;
    }
  }, [mode, currentDemoAction]);

  useEffect(() => {
    if (mode !== 'attack' || !currentDemoAction) return;

    // Deduplicate: don't re-fire the same action
    const key = `${currentDemoAction.type}:${JSON.stringify(currentDemoAction.payload ?? null)}`;
    if (lastActionRef.current === key) return;
    lastActionRef.current = key;

    const handler = handlers[currentDemoAction.type];
    if (handler) {
      handler(currentDemoAction.payload);
    }
  }, [mode, currentDemoAction, handlers]);
}
