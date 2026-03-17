import { createContext, useContext, useState, type ReactNode } from 'react';
import { getSearchParam } from '@/lib/urlState';
import { Settings, Play, Pause, X, RotateCcw, Maximize2 } from 'lucide-react';

type SidebarWidth = 'standard' | 'compact';
type AsideWidth = 'compact' | 'narrow';
type AsideSide = 'left' | 'right';

interface EmbedContext {
  isEmbed: boolean;
  panelsVisible: boolean;
  togglePanels: () => void;
}

const EmbedCtx = createContext<EmbedContext>({
  isEmbed: false,
  panelsVisible: true,
  togglePanels: () => {},
});

export function useEmbedContext() {
  return useContext(EmbedCtx);
}

interface DemoLayoutProps {
  children: ReactNode;
  /** Callback for the embed play/pause button. If provided, a play button appears in the embed toolbar. */
  onEmbedPlay?: () => void;
  /** Whether the demo is currently "playing" (controls play vs pause icon). */
  embedPlaying?: boolean;
  /** Callback for the embed reset button. If provided, a reset button appears in the embed toolbar. */
  onEmbedReset?: () => void;
  /** Callback for the embed fit-to-view button. If provided, a fit-to-view button appears in the embed toolbar. */
  onEmbedFitToView?: () => void;
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

export function DemoLayout({ children, onEmbedPlay, embedPlaying, onEmbedReset, onEmbedFitToView }: DemoLayoutProps) {
  const isEmbed = Boolean(getSearchParam('embed'));
  const [panelsVisible, setPanelsVisible] = useState(!isEmbed);

  return (
    <EmbedCtx.Provider value={{
      isEmbed,
      panelsVisible,
      togglePanels: () => setPanelsVisible((v) => !v),
    }}>
      <div className="demo-layout">
        {children}
        {/* Floating toolbar only for embed mode */}
        {isEmbed && (
          <div className="demo-embed-toolbar">
            {onEmbedPlay && (
              <button
                onClick={onEmbedPlay}
                className="demo-embed-btn"
                aria-label={embedPlaying ? 'Pause' : 'Play'}
                title={embedPlaying ? 'Pause' : 'Play'}
              >
                {embedPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}
            {onEmbedReset && (
              <button
                onClick={onEmbedReset}
                className="demo-embed-btn"
                aria-label="Reset"
                title="Reset"
              >
                <RotateCcw size={14} />
              </button>
            )}
            {onEmbedFitToView && (
              <button
                onClick={onEmbedFitToView}
                className="demo-embed-btn"
                aria-label="Fit to view"
                title="Fit to view"
              >
                <Maximize2 size={14} />
              </button>
            )}
            <button
              onClick={() => setPanelsVisible((v) => !v)}
              className="demo-embed-btn"
              aria-label={panelsVisible ? 'Hide controls' : 'Show controls'}
              title={panelsVisible ? 'Hide controls' : 'Controls'}
            >
              {panelsVisible ? <X size={14} /> : <Settings size={14} />}
            </button>
          </div>
        )}
      </div>
    </EmbedCtx.Provider>
  );
}

export function DemoSidebar({ children, width = 'standard' }: DemoSidebarProps) {
  const { isEmbed, panelsVisible } = useEmbedContext();

  // Embed: hide entirely when collapsed
  if (isEmbed && !panelsVisible) return null;
  if (isEmbed) {
    return (
      <div className={`demo-sidebar demo-sidebar--${width} demo-sidebar--embed`}>
        {children}
      </div>
    );
  }

  // Main view collapsed: floating settings button over canvas
  if (!panelsVisible) return null;

  // Main view expanded
  return (
    <div className={`demo-sidebar demo-sidebar--${width}`}>
      {children}
    </div>
  );
}

export function DemoCanvasArea({ children }: DemoCanvasAreaProps) {
  const { isEmbed, panelsVisible, togglePanels } = useEmbedContext();

  return (
    <div className="demo-canvas-area">
      {children}
      {/* Floating settings toggle — main view only, matches canvas toolbar style */}
      {!isEmbed && (
        <div className="demo-settings-toggle">
          <div className="canvas-toolbar">
            <button
              type="button"
              className={`canvas-toolbar-btn${panelsVisible ? ' is-active' : ''}`}
              onClick={togglePanels}
              title={panelsVisible ? 'Hide controls' : 'Show controls'}
              aria-label={panelsVisible ? 'Hide controls' : 'Show controls'}
            >
              {panelsVisible ? <X size={14} /> : <Settings size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
