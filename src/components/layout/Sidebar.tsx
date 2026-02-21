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
      className="hidden md:flex flex-col h-full py-5 px-2.5 border-r transition-all"
      style={{
        borderColor: 'var(--border)',
        width: collapsed ? 64 : 220,
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div className="mb-6 px-1.5 flex items-center justify-between">
        <a href="/" className="no-underline block">
          <span className="text-[13px] font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
            {collapsed ? <span style={{ opacity: 0.4 }}>∴</span> : <><span style={{ opacity: 0.4 }}>∴</span> theora</>}
          </span>
        </a>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[10px]"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Collapse sidebar"
        >
          {collapsed ? '\u203A' : '\u2039'}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5" role="navigation" aria-label="Demo navigation">
        {DEMOS.map((demo) => {
          const isActive = activeDemo === demo.id;
          return (
            <button
              key={demo.id}
              onClick={() => onSwitch(demo.id)}
              className={
                collapsed
                  ? 'w-full flex items-center justify-center h-10 rounded-lg transition-all'
                  : 'w-full flex items-center gap-3 px-3 h-10 rounded-lg text-left transition-all'
              }
              style={{
                backgroundColor: isActive ? 'var(--button-bg-strong)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                position: 'relative',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{
                    height: 16,
                    backgroundColor: 'var(--text-primary)',
                  }}
                />
              )}
              <DemoIcon id={demo.id} size={16} color={isActive ? 'var(--text-primary)' : 'var(--text-muted)'} />
              {!collapsed && (
                <span className="text-xs font-medium truncate">{demo.title}</span>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mt-auto px-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <a
              href="https://x.com/lucidzk"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Lucid Samuel
            </a>
          </p>
        </div>
      )}
    </aside>
  );
}
