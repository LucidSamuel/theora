import { useState, useEffect } from 'react';
import { Compass, Zap, Swords, Bug } from 'lucide-react';
import { MODES, type ModeId } from './types';
import { useMode } from './ModeProvider';

const MODE_ICONS: Record<ModeId, typeof Compass> = {
  explore: Compass,
  predict: Zap,
  attack: Swords,
  debug: Bug,
};

export function ModeBar() {
  const { mode, setMode } = useMode();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS') return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= MODES.length) {
        e.preventDefault();
        setMode(MODES[idx - 1]!.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

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
      {MODES.map((m) => (
        <ModeButton
          key={m.id}
          meta={m}
          isActive={mode === m.id}
          onClick={() => setMode(m.id)}
        />
      ))}
    </div>
  );
}

function ModeButton({
  meta,
  isActive,
  onClick,
}: {
  meta: typeof MODES[number];
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = MODE_ICONS[meta.id];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${meta.label} mode (${meta.shortcut})`}
      aria-pressed={isActive}
      title={`${meta.label} — ${meta.description}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: isActive ? '0 10px' : '0 8px',
        borderRadius: 7,
        border: 'none',
        background: isActive ? 'var(--button-bg-strong)' : hovered ? 'var(--button-bg)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        letterSpacing: '0.02em',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
      {isActive && <span>{meta.label}</span>}
    </button>
  );
}
