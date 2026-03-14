import { useState } from 'react';
import { DEMOS, type DemoId } from '@/types';
import { DemoIcon } from '@/components/shared/DemoIcon';
import type { Theme } from '@/lib/theme';

function HeaderBtn({
  onClick,
  label,
  active = false,
  className = '',
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-7 h-7 flex items-center justify-center rounded-md ${className}`}
      style={{
        background: active || hovered ? 'var(--button-bg-strong)' : 'transparent',
        color: active ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

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
      <div className="flex items-center gap-0.5">
        <HeaderBtn
          onClick={onToggleNav}
          label="Toggle sidebar"
          active={navCollapsed}
          className="hidden md:flex"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {navCollapsed ? (
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            ) : (
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            )}
          </svg>
        </HeaderBtn>
        <HeaderBtn onClick={onToggleInfo} label="Toggle info" active={infoOpen}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {infoOpen ? (
              <>
                <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </>
            ) : (
              <>
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="7" cy="4.2" r="0.7" fill="currentColor"/>
              </>
            )}
          </svg>
        </HeaderBtn>
        <HeaderBtn onClick={onToggleTheme} label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {theme === 'dark' ? (
              <>
                <circle cx="7" cy="7" r="2.8" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="7" y1="1" x2="7" y2="2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="7" y1="11.8" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="1" y1="7" x2="2.2" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="11.8" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="2.93" y1="2.93" x2="3.78" y2="3.78" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="10.22" y1="10.22" x2="11.07" y2="11.07" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="11.07" y1="2.93" x2="10.22" y2="3.78" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="3.78" y1="10.22" x2="2.93" y2="11.07" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </>
            ) : (
              <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            )}
          </svg>
        </HeaderBtn>
      </div>
    </header>
  );
}
