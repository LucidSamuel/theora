import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { CURATED_WALKTHROUGHS, getCuratedWalkthrough } from './curated';
import { ResearchHero } from './ResearchHero';
import { WalkthroughGallery } from './WalkthroughGallery';
import { WalkthroughViewer } from './WalkthroughViewer';
import { PaperUpload } from './PaperUpload';
import type { Walkthrough } from './types';
import './ResearchPage.css';

export function ResearchPage() {
  const { theme, toggle } = useTheme();
  const [activeWalkthrough, setActiveWalkthrough] = useState<Walkthrough | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  // Read ?paper= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paperId = params.get('paper');
    if (paperId) {
      const w = getCuratedWalkthrough(paperId);
      if (w) setActiveWalkthrough(w);
    }
  }, []);

  // Sync ?paper= to URL when walkthrough changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeWalkthrough?.generatedBy === 'curated') {
      params.set('paper', activeWalkthrough.id);
    } else {
      params.delete('paper');
    }
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [activeWalkthrough]);

  const scrollToGallery = useCallback(() => {
    galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToUpload = useCallback(() => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSelectWalkthrough = useCallback((id: string) => {
    const w = getCuratedWalkthrough(id);
    if (w) {
      setActiveWalkthrough(w);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleBack = useCallback(() => {
    setActiveWalkthrough(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAiWalkthrough = useCallback((w: Walkthrough) => {
    setActiveWalkthrough(w);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="research-page">
      {/* Header */}
      <header className="research-header">
        <div className="research-header__left">
          <a href="/" className="research-header__link" style={{ fontWeight: 600, fontSize: 14 }}>
            theora
          </a>
        </div>
        <div className="research-header__right">
          <a href="/app" className="research-header__link">
            Back to Demos
          </a>
          <button
            onClick={toggle}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 8px',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {/* Content */}
      {activeWalkthrough ? (
        <WalkthroughViewer walkthrough={activeWalkthrough} onBack={handleBack} />
      ) : (
        <>
          <ResearchHero onScrollToGallery={scrollToGallery} onScrollToUpload={scrollToUpload} />

          <div ref={galleryRef}>
            <WalkthroughGallery
              walkthroughs={CURATED_WALKTHROUGHS}
              onSelect={handleSelectWalkthrough}
            />
          </div>

          <div ref={uploadRef}>
            <PaperUpload onWalkthroughGenerated={handleAiWalkthrough} />
          </div>
        </>
      )}

      {/* Footer */}
      <footer className="research-footer">
        <a href="https://github.com/LucidSamuel/theora" target="_blank" rel="noopener noreferrer">GitHub</a>
        · MIT License
      </footer>
    </div>
  );
}
