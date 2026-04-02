import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { ApiKeyModal } from '@/components/shared/ApiKeyModal';
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

  const [apiKeyOpen, setApiKeyOpen] = useState(false);

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
            onClick={() => setApiKeyOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 8px',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
            aria-label="API key settings"
            title="API key settings"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.05 3.05l.7.7M10.25 10.25l.7.7M10.95 3.05l-.7.7M3.75 10.25l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
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
      <ApiKeyModal isOpen={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />

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
