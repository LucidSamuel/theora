import { useState, type ReactNode } from 'react';
import { DEMOS, type DemoId } from '@/types';
import { useGitHub } from '@/hooks/useGitHub';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ModeBar } from '@/modes';
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
  children: ReactNode;
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

function GitHubMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M7 1C3.686 1 1 3.686 1 7c0 2.654 1.721 4.904 4.107 5.698.3.055.41-.13.41-.29 0-.142-.005-.519-.008-1.018-1.67.363-2.022-.804-2.022-.804-.273-.694-.666-.879-.666-.879-.545-.373.041-.365.041-.365.602.042.919.618.919.618.535.916 1.403.652 1.745.498.054-.387.209-.652.38-.802-1.332-.152-2.733-.666-2.733-2.963 0-.655.234-1.19.618-1.61-.062-.151-.268-.76.058-1.585 0 0 .504-.161 1.65.615A5.75 5.75 0 0 1 7 4.836c.51.002 1.023.069 1.502.202 1.145-.776 1.648-.615 1.648-.615.327.825.121 1.434.06 1.585.385.42.617.955.617 1.61 0 2.304-1.403 2.81-2.739 2.958.215.186.407.552.407 1.113 0 .804-.007 1.452-.007 1.65 0 .16.108.348.413.289C11.28 11.902 13 9.653 13 7c0-3.314-2.686-6-6-6z"/>
    </svg>
  );
}

function ImportMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.25v6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.75 6.75 7 9l2.25-2.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 10.75h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ImportBtn({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const [hovered, setHovered] = useState(false);
  if (compact) {
    return (
      <HeaderBtn onClick={onClick} label="Import from GitHub">
        <ImportMark />
      </HeaderBtn>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-label="Import from GitHub"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 10px',
        height: '26px',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: hovered ? 'var(--text-muted)' : 'var(--border)',
        background: hovered ? 'var(--button-bg-strong)' : 'transparent',
        color: hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        letterSpacing: '0.01em',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
        marginRight: '4px',
      }}
    >
      <ImportMark />
      Import
    </button>
  );
}

function GitHubConnectBtn({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const [hovered, setHovered] = useState(false);
  if (compact) {
    return (
      <HeaderBtn onClick={onClick} label="Connect GitHub">
        <GitHubMark />
      </HeaderBtn>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-label="Connect GitHub"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 10px',
        height: '26px',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: hovered ? 'var(--text-muted)' : 'var(--border)',
        background: hovered ? 'var(--button-bg-strong)' : 'transparent',
        color: hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        letterSpacing: '0.01em',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
        marginRight: '4px',
      }}
    >
      <GitHubMark />
      Connect
    </button>
  );
}

function GitHubUserBtn({
  login,
  avatarUrl,
  onOpenSaves,
  onOpenConnect,
  onOpenImport,
  compact = false,
}: {
  login: string;
  avatarUrl: string;
  onOpenSaves: () => void;
  onOpenConnect: () => void;
  onOpenImport: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative', marginRight: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`GitHub: ${login}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '0' : '6px',
          padding: compact ? '0 7px' : '0 10px',
          height: '26px',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: open || hovered ? 'var(--text-muted)' : 'var(--border)',
          background: open || hovered ? 'var(--button-bg-strong)' : 'transparent',
          color: open || hovered ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          letterSpacing: '0.01em',
          transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
        }}
      >
        <img
          src={avatarUrl}
          alt={login}
          style={{ width: 16, height: 16, borderRadius: '50%' }}
        />
        {!compact && login}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              minWidth: 160,
              padding: '6px',
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              zIndex: 100,
            }}
          >
            <DropdownItem label="My Saves" onClick={() => { setOpen(false); onOpenSaves(); }} />
            <DropdownItem label="Import" onClick={() => { setOpen(false); onOpenImport(); }} />
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <DropdownItem label="Settings" onClick={() => { setOpen(false); onOpenConnect(); }} />
          </div>
        </>
      )}
    </div>
  );
}

function DropdownItem({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '7px 10px',
        borderRadius: 6,
        border: 'none',
        background: hovered ? 'var(--button-bg-strong)' : 'transparent',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        textAlign: 'left',
        transition: 'background 80ms ease, color 80ms ease',
      }}
    >
      {label}
    </button>
  );
}

interface HeaderProps {
  activeDemo: DemoId;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleInfo: () => void;
  onOpenImport: () => void;
  infoOpen: boolean;
  navCollapsed: boolean;
  onToggleNav: () => void;
  onSwitchDemo?: (id: DemoId) => void;
}

export function Header({ activeDemo, theme, onToggleTheme, onToggleInfo, onOpenImport, infoOpen, navCollapsed, onToggleNav, onSwitchDemo }: HeaderProps) {
  const demo = DEMOS.find((d) => d.id === activeDemo)!;
  const { status, user, setConnectOpen, setSavesOpen } = useGitHub();
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <header
      className="flex items-center justify-between h-14 border-b"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border)',
        padding: isMobile ? '0 12px' : '0 20px',
        minHeight: 56,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isMobile && (
          <a
            href="/"
            className="no-underline flex items-center shrink-0"
            aria-label="Go to landing page"
          >
            <span
              className="text-[13px] font-semibold font-display"
              style={{ color: 'var(--text-primary)', opacity: 0.35 }}
            >
              ∴
            </span>
          </a>
        )}

        {isMobile ? (
          <label className="min-w-0">
            <span className="sr-only">Choose demo</span>
            <select
              value={activeDemo}
              onChange={(e) => onSwitchDemo?.(e.target.value as DemoId)}
              aria-label="Choose demo"
              className="outline-none"
              style={{
                width: 'min(56vw, 240px)',
                height: 38,
                padding: '0 30px 0 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--button-bg)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                WebkitAppearance: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              {DEMOS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-[13px] leading-none font-medium font-display truncate" style={{ color: 'var(--text-primary)' }}>
            {demo.title}
          </span>
        )}
      </div>

      {!isMobile && (
        <div className="hidden md:flex">
          <ModeBar />
        </div>
      )}

      <div className="flex items-center gap-1">
        {status === 'connected' && user ? (
          <GitHubUserBtn
            login={user.login}
            avatarUrl={user.avatar_url}
            onOpenSaves={() => setSavesOpen(true)}
            onOpenConnect={() => setConnectOpen(true)}
            onOpenImport={onOpenImport}
            compact={isMobile}
          />
        ) : (
          <>
            <ImportBtn onClick={onOpenImport} compact={isMobile} />
            <GitHubConnectBtn onClick={() => setConnectOpen(true)} compact={isMobile} />
          </>
        )}
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
        <HeaderBtn onClick={onToggleInfo} label="Toggle info panel" active={infoOpen} className="hidden lg:flex">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="7" cy="4.2" r="0.7" fill="currentColor"/>
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
