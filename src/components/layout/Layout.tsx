import { useState, type ReactNode } from 'react';
import type { DemoId } from '@/types';
import type { Theme } from '@/lib/theme';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { InfoPanel } from './InfoPanel';
import { InfoProvider } from './InfoContext';
import { getSearchParam } from '@/lib/urlState';

interface LayoutProps {
  activeDemo: DemoId;
  onSwitchDemo: (id: DemoId) => void;
  theme: Theme;
  onToggleTheme: () => void;
  children: ReactNode;
}

export function Layout({ activeDemo, onSwitchDemo, theme, onToggleTheme, children }: LayoutProps) {
  const [infoOpen, setInfoOpen] = useState(true);
  const isEmbed = Boolean(getSearchParam('embed'));

  return (
    <InfoProvider>
      <div className="flex h-full w-full overflow-hidden">
        {!isEmbed && <Sidebar activeDemo={activeDemo} onSwitch={onSwitchDemo} />}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {!isEmbed && (
            <Header
              activeDemo={activeDemo}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onToggleInfo={() => setInfoOpen((v) => !v)}
              infoOpen={infoOpen}
              onSwitchDemo={onSwitchDemo}
            />
          )}
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
        {!isEmbed && <InfoPanel activeDemo={activeDemo} isOpen={infoOpen} />}
      </div>
    </InfoProvider>
  );
}
