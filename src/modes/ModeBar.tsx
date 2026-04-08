import { useState, useEffect } from 'react';
import { Compass, Zap, Swords, Bug } from 'lucide-react';
import { MODES, type ModeId } from './types';
import { useMode } from './ModeProvider';
import { useActiveDemo } from '@/hooks/useActiveDemo';
import { hasPredictChallenges } from './predict/challenges';
import { hasAttackScenario } from './attack/scenarios';
import { hasDebugSupport } from './debug/DebugPanel';
import type { DemoId } from '@/types';

const MODE_ICONS: Record<ModeId, typeof Compass> = {
  explore: Compass,
  predict: Zap,
  attack: Swords,
  debug: Bug,
};

/** Check if a mode is supported for the given demo. */
function isModeSupported(modeId: ModeId, demoId: DemoId): boolean {
  if (modeId === 'predict') return hasPredictChallenges(demoId);
  if (modeId === 'attack') return hasAttackScenario(demoId);
  if (modeId === 'debug') return hasDebugSupport(demoId);
  return true; // explore is always available
}

export function ModeBar() {
  const { mode, setMode } = useMode();
  const { activeDemo } = useActiveDemo();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS') return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= MODES.length) {
        const targetMode = MODES[idx - 1]!;
        if (!isModeSupported(targetMode.id, activeDemo)) return;
        e.preventDefault();
        setMode(targetMode.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, activeDemo]);

  return (
    <div
      className="flex items-center gap-1"
      style={{
        padding: '3px',
        borderRadius: 10,
        background: 'var(--toolbar-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {MODES.map((m) => {
        const supported = isModeSupported(m.id, activeDemo);
        return (
          <ModeButton
            key={m.id}
            meta={m}
            isActive={mode === m.id}
            supported={supported}
            onClick={() => supported && setMode(m.id)}
          />
        );
      })}
    </div>
  );
}

function ModeButton({
  meta,
  isActive,
  supported,
  onClick,
}: {
  meta: typeof MODES[number];
  isActive: boolean;
  supported: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = MODE_ICONS[meta.id];

  const title = supported
    ? `${meta.label} — ${meta.description}`
    : `${meta.label} mode not available for this demo`;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${meta.label} mode (${meta.shortcut})`}
      aria-pressed={isActive}
      aria-disabled={!supported}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: isActive ? '0 10px' : '0 8px',
        borderRadius: 7,
        border: 'none',
        background: isActive && supported
          ? 'var(--button-bg-strong)'
          : hovered && supported
            ? 'var(--button-bg)'
            : 'transparent',
        color: !supported
          ? 'var(--text-muted)'
          : isActive
            ? 'var(--text-primary)'
            : hovered
              ? 'var(--text-secondary)'
              : 'var(--text-muted)',
        opacity: supported ? 1 : 0.35,
        cursor: supported ? 'pointer' : 'not-allowed',
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        letterSpacing: '0.02em',
        transition: 'background 120ms ease, color 120ms ease, opacity 120ms ease',
      }}
    >
      <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
      {isActive && <span>{meta.label}</span>}
    </button>
  );
}
