import { DEMOS, type DemoId } from '@/types';
import { DemoIcon } from '@/components/shared/DemoIcon';
import type { Theme } from '@/lib/theme';

interface HeaderProps {
  activeDemo: DemoId;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleInfo: () => void;
  infoOpen: boolean;
  navCollapsed: boolean;
  onToggleNav: () => void;
  onSwitchDemo?: (id: DemoId) => void;
}

export function Header({ activeDemo, theme, onToggleTheme, onToggleInfo, infoOpen, navCollapsed, onToggleNav, onSwitchDemo }: HeaderProps) {
  const demo = DEMOS.find((d) => d.id === activeDemo)!;

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-primary) 92%, transparent)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Mobile demo selector */}
        <div className="flex md:hidden gap-1">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              onClick={() => onSwitchDemo?.(d.id)}
              className="p-1.5 rounded-md text-sm"
              style={{
                backgroundColor: activeDemo === d.id ? `color-mix(in srgb, ${d.accent} 20%, transparent)` : 'transparent',
              }}
              aria-label={d.title}
            >
              <DemoIcon id={d.id} size={16} color={activeDemo === d.id ? d.accent : 'var(--text-muted)'} />
            </button>
          ))}
        </div>
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 font-display">
            <span className="hidden md:inline">
              <DemoIcon id={demo.id} size={16} color={demo.accent} />
            </span>
            <span style={{ color: demo.accent }}>{demo.title}</span>
          </h2>
          <p className="text-[10px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>
            {demo.subtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleNav}
          className="hidden md:inline-flex p-2 rounded-lg text-xs transition-colors"
          style={{
            backgroundColor: navCollapsed ? `color-mix(in srgb, ${demo.accent} 12%, transparent)` : "transparent",
            color: navCollapsed ? demo.accent : "var(--text-muted)",
          }}
          aria-label="Toggle sidebar"
        >
          {navCollapsed ? "▶" : "◀"}
        </button>
        <button
          onClick={onToggleInfo}
          className="p-2 rounded-lg text-xs transition-colors"
          style={{
            backgroundColor: infoOpen ? `color-mix(in srgb, ${demo.accent} 15%, transparent)` : 'transparent',
            color: infoOpen ? demo.accent : 'var(--text-muted)',
          }}
          aria-label="Toggle info panel"
        >
          {infoOpen ? '✕' : 'ℹ'}
        </button>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
