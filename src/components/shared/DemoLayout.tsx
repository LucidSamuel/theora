import { createContext, useContext, useState, type ReactNode } from 'react';
import { getSearchParam } from '@/lib/urlState';

type SidebarWidth = 'standard' | 'compact';
type AsideWidth = 'compact' | 'narrow';
type AsideSide = 'left' | 'right';

interface EmbedContext {
  isEmbed: boolean;
  panelsVisible: boolean;
  togglePanels: () => void;
}

const EmbedCtx = createContext<EmbedContext>({ isEmbed: false, panelsVisible: true, togglePanels: () => {} });

export function useEmbedContext() {
  return useContext(EmbedCtx);
}

interface DemoLayoutProps {
  children: ReactNode;
}

interface DemoSidebarProps {
  children: ReactNode;
  width?: SidebarWidth;
}

interface DemoCanvasAreaProps {
  children: ReactNode;
}

interface DemoAsideProps {
  children: ReactNode;
  side?: AsideSide;
  width?: AsideWidth;
}

export function DemoLayout({ children }: DemoLayoutProps) {
  const isEmbed = Boolean(getSearchParam('embed'));
  const [panelsVisible, setPanelsVisible] = useState(!isEmbed);

  return (
    <EmbedCtx.Provider value={{ isEmbed, panelsVisible, togglePanels: () => setPanelsVisible((v) => !v) }}>
      <div className="demo-layout">
        {children}
        {isEmbed && (
          <button
            onClick={() => setPanelsVisible((v) => !v)}
            className="demo-embed-toggle"
            aria-label={panelsVisible ? 'Hide controls' : 'Show controls'}
            title={panelsVisible ? 'Hide controls' : 'Show controls'}
          >
            {panelsVisible ? '✕' : '☰'}
          </button>
        )}
      </div>
    </EmbedCtx.Provider>
  );
}

export function DemoSidebar({ children, width = 'standard' }: DemoSidebarProps) {
  const { isEmbed, panelsVisible } = useEmbedContext();
  if (isEmbed && !panelsVisible) return null;

  return (
    <div className={`demo-sidebar demo-sidebar--${width}${isEmbed ? ' demo-sidebar--embed' : ''}`}>
      {children}
    </div>
  );
}

export function DemoCanvasArea({ children }: DemoCanvasAreaProps) {
  return <div className="demo-canvas-area">{children}</div>;
}

export function DemoAside({ children, side = 'right', width = 'compact' }: DemoAsideProps) {
  const { isEmbed, panelsVisible } = useEmbedContext();
  if (isEmbed && !panelsVisible) return null;

  return (
    <div className={`demo-aside demo-aside--${side} demo-aside--${width}${isEmbed ? ' demo-aside--embed' : ''}`}>
      {children}
    </div>
  );
}
