import type { ReactNode } from 'react';
import type { DemoId } from '@/types';
import { PredictProvider } from './PredictProvider';
import { PredictPanel } from './PredictPanel';

interface PredictModeProps {
  activeDemo: DemoId;
  children: ReactNode;
}

/**
 * PredictMode wraps the demo canvas content and provides the predict sidebar.
 * The demo renders normally in the canvas area; the sidebar is replaced by PredictPanel.
 */
export function PredictMode({ activeDemo, children }: PredictModeProps) {
  return (
    <PredictProvider activeDemo={activeDemo}>
      <div className="flex h-full w-full overflow-hidden">
        {/* Predict sidebar */}
        <aside
          className="hidden md:flex flex-col h-full border-r shrink-0"
          style={{
            borderColor: 'var(--border)',
            width: 260,
            backgroundColor: 'var(--bg-primary)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <PredictPanel activeDemo={activeDemo} />
        </aside>

        {/* Demo canvas area */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {children}
        </div>
      </div>
    </PredictProvider>
  );
}
