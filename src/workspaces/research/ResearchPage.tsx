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

const GITHUB_URL = "https://github.com/LucidSamuel/theora";

export function ResearchPage() {
  const { theme, toggle } = useTheme();
  const [activeWalkthrough, setActiveWalkthrough] = useState<Walkthrough | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <div className="lp" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ── NAV (matches landing page) ── */}
      <nav
        className="lp-nav"
        style={{
          borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
          background: scrolled
            ? 'color-mix(in srgb, var(--bg-primary) 92%, transparent)'
            : 'var(--bg-primary)',
          backdropFilter: scrolled ? 'blur(18px)' : 'none',
        }}
      >
        <div className="lp-shell lp-nav-inner">
          <a href="/" className="lp-brand no-underline">
            <span className="lp-brand-mark">∴</span>
            <span>theora</span>
          </a>
          <div className="lp-nav-actions">
            <a href="/app" className="lp-nav-link lp-nav-link--desktop">
              Demos
            </a>
            <span className="lp-nav-link lp-nav-link--desktop lp-nav-link--active">
              Research
            </span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-nav-link lp-nav-link--desktop"
            >
              GitHub ↗
            </a>
            <button
              type="button"
              onClick={() => setApiKeyOpen(true)}
              className="lp-icon-btn"
              aria-label="API key settings"
              title="API key settings"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.05 3.05l.7.7M10.25 10.25l.7.7M10.95 3.05l-.7.7M3.75 10.25l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={toggle}
              className="lp-icon-btn"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <a href="/app" className="lp-btn-primary">
              Launch App
            </a>
          </div>
        </div>
      </nav>
      <ApiKeyModal isOpen={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />

      {/* ── CONTENT ── */}
      <main>
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
      </main>

      {/* ── FOOTER (matches landing page) ── */}
      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <div className="lp-footer-left">
            <a href="/" className="lp-brand no-underline">
              <span className="lp-brand-mark">∴</span>
              <span>theora</span>
            </a>
            <p className="lp-footer-tagline">
              Interactive zero-knowledge proof visualizer.
            </p>
          </div>
          <div className="lp-footer-links">
            <a href="/app" className="lp-nav-link">Launch App</a>
            <a href="/research" className="lp-nav-link">Research</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="lp-nav-link">
              GitHub ↗
            </a>
          </div>
          <p className="lp-footer-legal">MIT License</p>
        </div>
      </footer>
    </div>
  );
}
