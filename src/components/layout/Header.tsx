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
      className="flex items-center justify-between px-5 h-11 border-b"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Mobile demo selector */}
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
              <DemoIcon id={d.id} size={14} color={activeDemo === d.id ? 'var(--text-primary)' : 'var(--text-muted)'} />
            </button>
          ))}
        </div>
        <span className="text-[13px] font-medium font-display" style={{ color: 'var(--text-primary)' }}>
          {demo.title}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleNav}
          className="hidden md:flex w-7 h-7 items-center justify-center rounded-md text-[10px]"
          style={{
            color: 'var(--text-muted)',
            backgroundColor: navCollapsed ? 'var(--button-bg)' : 'transparent',
          }}
          aria-label="Toggle sidebar"
        >
          {navCollapsed ? '\u203A' : '\u2039'}
        </button>
        <button
          onClick={onToggleInfo}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[10px]"
          style={{
            color: infoOpen ? 'var(--text-primary)' : 'var(--text-muted)',
            backgroundColor: infoOpen ? 'var(--button-bg)' : 'transparent',
          }}
          aria-label="Toggle info panel"
        >
          {infoOpen ? '\u2715' : '\u2139'}
        </button>
        <button
          onClick={onToggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[10px]"
          style={{ color: 'var(--text-muted)' }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>
    </header>
  );
}
