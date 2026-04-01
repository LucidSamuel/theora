import type { ReactNode } from 'react';
import type { DemoId } from '@/types';
import { AttackProvider } from './AttackProvider';
import { AttackPanel } from './AttackPanel';

interface AttackModeProps {
  activeDemo: DemoId;
  children: ReactNode;
}

/**
 * AttackMode wraps the demo canvas content and provides the attack sidebar.
 * The demo renders normally in the canvas area; the sidebar is replaced by AttackPanel.
 */
export function AttackMode({ activeDemo, children }: AttackModeProps) {
  return (
    <AttackProvider activeDemo={activeDemo}>
      <div className="flex h-full w-full overflow-hidden">
        {/* Attack sidebar */}
        <aside
          className="hidden md:flex flex-col h-full border-r shrink-0"
          style={{
            borderColor: 'var(--border)',
            width: 260,
            backgroundColor: 'var(--bg-primary)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <AttackPanel activeDemo={activeDemo} />
        </aside>

        {/* Demo canvas area */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {children}
        </div>
      </div>
    </AttackProvider>
  );
}
