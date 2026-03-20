import { createContext, useContext, useState, type ReactNode } from 'react';
import { getSearchParam } from '@/lib/urlState';
import { Settings, Play, Pause, X, RotateCcw, Maximize2, SlidersHorizontal } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MobileControlsSheet } from './MobileControlsSheet';

type SidebarWidth = 'standard' | 'compact';
type AsideWidth = 'compact' | 'narrow';
type AsideSide = 'left' | 'right';

interface EmbedContext {
  isEmbed: boolean;
  panelsVisible: boolean;
  togglePanels: () => void;
  isMobile: boolean;
  mobileSheetOpen: boolean;
  setMobileSheetOpen: (open: boolean) => void;
}

const EmbedCtx = createContext<EmbedContext>({
  isEmbed: false,
  panelsVisible: true,
  togglePanels: () => {},
  isMobile: false,
  mobileSheetOpen: false,
  setMobileSheetOpen: () => {},
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
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  return (
    <EmbedCtx.Provider value={{
      isEmbed,
      panelsVisible,
      togglePanels: () => setPanelsVisible((v) => !v),
      isMobile,
      mobileSheetOpen,
      setMobileSheetOpen,
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
  const { isEmbed, panelsVisible, isMobile, mobileSheetOpen, setMobileSheetOpen } = useEmbedContext();

  // Embed: hide entirely when collapsed
  if (isEmbed && !panelsVisible) return null;
  if (isEmbed) {
    return (
      <div className={`demo-sidebar demo-sidebar--${width} demo-sidebar--embed`}>
        {children}
      </div>
    );
  }

  // Mobile: render inside a bottom sheet
  if (isMobile) {
    return (
      <MobileControlsSheet
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        title="Controls"
      >
        {children}
      </MobileControlsSheet>
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
  const { isEmbed, panelsVisible, togglePanels, isMobile, setMobileSheetOpen } = useEmbedContext();

  return (
    <div className="demo-canvas-area">
      {children}
      {/* Floating settings toggle — main view only, matches canvas toolbar style */}
      {!isEmbed && !isMobile && (
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
      {/* Mobile floating controls button */}
      {!isEmbed && isMobile && (
        <div className="demo-mobile-controls-trigger">
          <button
            type="button"
            className="demo-mobile-controls-btn"
            onClick={() => setMobileSheetOpen(true)}
            aria-label="Open controls"
          >
            <SlidersHorizontal size={16} />
            <span>Controls</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function DemoAside({ children, side = 'right', width = 'compact' }: DemoAsideProps) {
  const { isEmbed, panelsVisible, isMobile } = useEmbedContext();
  if (isEmbed && !panelsVisible) return null;
  // Hide aside on mobile — content is secondary
  if (isMobile) return null;

  return (
    <div className={`demo-aside demo-aside--${side} demo-aside--${width}${isEmbed ? ' demo-aside--embed' : ''}`}>
      {children}
    </div>
  );
}
