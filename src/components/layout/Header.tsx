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
      className="flex items-center justify-between border-b shrink-0"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border)',
        height: 48,
        paddingLeft: 20,
        paddingRight: 16,
      }}
    >
      {/* Left — mobile demo tabs + title */}
      <div className="flex items-center gap-3">
        <div className="flex md:hidden gap-0.5">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              onClick={() => onSwitchDemo?.(d.id)}
              className="w-7 h-7 flex items-center justify-center rounded-md"
              style={{
                backgroundColor: activeDemo === d.id ? 'var(--button-bg-strong)' : 'transparent',
              }}
              aria-label={d.title}
            >
              <DemoIcon
                id={d.id}
                size={14}
                color={activeDemo === d.id ? 'var(--text-primary)' : 'var(--text-muted)'}
              />
            </button>
          ))}
        </div>
        <span
          className="text-[13px] font-semibold font-display"
          style={{ color: 'var(--text-primary)' }}
        >
          {demo.title}
        </span>
      </div>

      {/* Right — icon controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onToggleNav}
          className="hidden md:flex w-8 h-8 items-center justify-center rounded-md text-[11px]"
          style={{
            color: 'var(--text-muted)',
            backgroundColor: navCollapsed ? 'var(--button-bg)' : 'transparent',
          }}
          aria-label="Toggle sidebar"
        >
          {navCollapsed ? '›' : '‹'}
        </button>
        <button
          onClick={onToggleInfo}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[11px]"
          style={{
            color: infoOpen ? 'var(--text-primary)' : 'var(--text-muted)',
            backgroundColor: infoOpen ? 'var(--button-bg)' : 'transparent',
          }}
          aria-label="Toggle info panel"
        >
          {infoOpen ? '✕' : 'ℹ'}
        </button>
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[11px]"
          style={{ color: 'var(--text-muted)' }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
