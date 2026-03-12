import { DEMOS, type DemoId } from '@/types';
import { DemoIcon } from '@/components/shared/DemoIcon';

interface SidebarProps {
  activeDemo: DemoId;
  onSwitch: (id: DemoId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeDemo, onSwitch, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex flex-col h-full border-r transition-all"
      style={{
        borderColor: 'var(--border)',
        width: collapsed ? 56 : 224,
        backgroundColor: 'var(--bg-primary)',
        padding: collapsed ? '0 8px 24px' : '0 16px 24px',
      }}
    >
      {/* Logo row — exactly 48px tall, matching the header height */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 48,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <a href="/" className="no-underline block">
          <span
            className="text-[13px] font-semibold font-display"
            style={{ color: 'var(--text-primary)' }}
          >
            {collapsed ? (
              <span style={{ opacity: 0.4 }}>∴</span>
            ) : (
              <><span style={{ opacity: 0.4 }}>∴</span> theora</>
            )}
          </span>
        </a>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5" role="navigation" aria-label="Demo navigation">
        {DEMOS.map((demo) => {
          const isActive = activeDemo === demo.id;
          return (
            <button
              key={demo.id}
              onClick={() => onSwitch(demo.id)}
              className="relative flex items-center rounded-lg transition-all text-left"
              style={{
                gap: collapsed ? 0 : 10,
                height: 38,
                padding: collapsed ? '0' : '0 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                backgroundColor: isActive ? 'var(--button-bg-strong)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: 3, height: 16, backgroundColor: 'var(--text-primary)' }}
                />
              )}
              <DemoIcon
                id={demo.id}
                size={15}
                color={isActive ? 'var(--text-primary)' : 'var(--text-muted)'}
              />
              {!collapsed && (
                <span className="text-[12px] font-medium truncate">{demo.title}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer credit */}
      {!collapsed && (
        <div className="mt-auto pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href="https://x.com/lucidzk"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline text-[11px]"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Lucid Samuel
          </a>
        </div>
      )}
    </aside>
  );
}
