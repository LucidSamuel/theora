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
      className="hidden md:flex flex-col h-full py-6 px-3 border-r panel-surface transition-all"
      style={{ borderColor: 'var(--border)', width: collapsed ? 72 : 240 }}
    >
      <div className="mb-7 px-1 flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
            {collapsed ? 'T' : 'Theora'}
          </h1>
          {!collapsed && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Interactive Cryptography
            </p>
          )}
        </div>
        <button onClick={onToggleCollapse} className="p-1.5 rounded-md text-xs" style={{ color: 'var(--text-muted)' }} aria-label="Collapse sidebar">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      <nav className="flex-1 space-y-1" role="navigation" aria-label="Demo navigation">
        {DEMOS.map((demo) => {
          const isActive = activeDemo === demo.id;
          return (
            <button
              key={demo.id}
              onClick={() => onSwitch(demo.id)}
              className={collapsed ? "w-full flex items-center justify-center px-3 py-3 rounded-lg text-left transition-all" : "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all"}
              style={{
                backgroundColor: isActive ? `color-mix(in srgb, ${demo.accent} 15%, transparent)` : 'transparent',
                color: isActive ? demo.accent : 'var(--text-secondary)',
                borderLeft: isActive ? `3px solid ${demo.accent}` : '3px solid transparent',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <DemoIcon id={demo.id} size={18} color={isActive ? demo.accent : 'var(--text-muted)'} />
              {!collapsed && (
                <div>
                  <div className="text-xs font-medium">{demo.title}</div>
                  <div className="text-[10px] opacity-60">{demo.subtitle}</div>
                </div>
              )}
            </button>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="mt-auto px-2 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Built by{' '}
            <a
              href="https://x.com/lucidzk"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-colors hover:underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              Lucid Samuel
            </a>
          </p>
        </div>
      )}
    </aside>
  );
}
