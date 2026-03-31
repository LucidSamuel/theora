import type { CSSProperties } from 'react';
import { DemoIcon } from '@/components/shared/DemoIcon';
import { DEMOS, type DemoId } from '@/types';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';
import { DEMO_CATEGORY_BY_ID } from '@/content/demoGroups';
import { DEFAULT_NEXT_STEPS, EXTRA_INFO } from './InfoPanel';

interface MobileDemoFallbackProps {
  activeDemo: DemoId;
}

function StaticPreview({ activeDemo, accent }: { activeDemo: DemoId; accent: string }) {
  const nextSteps = DEFAULT_NEXT_STEPS[activeDemo].slice(0, 3);

  return (
    <div className="demo-mobile-preview-surface" style={{ '--demo-accent': accent } as CSSProperties}>
      <div className="demo-mobile-preview-grid" aria-hidden="true" />
      <div className="demo-mobile-preview-header">
        <div className="demo-mobile-preview-pill">
          <DemoIcon id={activeDemo} size={14} color={accent} />
          <span>static preview</span>
        </div>
        <span className="demo-mobile-preview-state">desktop interaction required</span>
      </div>
      <div className="demo-mobile-preview-stage">
        {nextSteps.map((step, index) => (
          <div key={step} className="demo-mobile-preview-step">
            <span className="demo-mobile-preview-step-index">{String(index + 1).padStart(2, '0')}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      <div className="demo-mobile-preview-bars" aria-hidden="true">
        <span className="demo-mobile-preview-bar demo-mobile-preview-bar--lg" />
        <span className="demo-mobile-preview-bar demo-mobile-preview-bar--md" />
        <span className="demo-mobile-preview-bar demo-mobile-preview-bar--sm" />
      </div>
    </div>
  );
}

export function MobileDemoFallback({ activeDemo }: MobileDemoFallbackProps) {
  const demo = DEMOS.find((entry) => entry.id === activeDemo)!;
  const extra = EXTRA_INFO[activeDemo];
  const nextSteps = DEFAULT_NEXT_STEPS[activeDemo];
  const category = DEMO_CATEGORY_BY_ID[activeDemo];

  const handleCopyLink = () => {
    const origin = window.location.origin;
    const href = `${origin}/app#${activeDemo}`;
    copyToClipboard(href);
    showToast('Desktop link copied', href.replace(origin, ''));
  };

  return (
    <div className="demo-mobile-fallback">
      <section className="demo-mobile-card">
        <p className="demo-mobile-kicker">Desktop recommended</p>
        <div className="demo-mobile-title-row">
          <span className="demo-mobile-icon-shell">
            <DemoIcon id={activeDemo} size={18} color={demo.accent} />
          </span>
          <div className="min-w-0">
            <p className="demo-mobile-category">{category}</p>
            <h1 className="demo-mobile-title">{demo.title}</h1>
          </div>
        </div>
        <p className="demo-mobile-summary">Interactive demos are best experienced on desktop. Copy this URL and reopen it where pan, zoom, hover, and step-through controls are available.</p>
        <button type="button" className="demo-mobile-copy-btn" onClick={handleCopyLink}>
          Copy desktop link
        </button>
      </section>

      <section className="demo-mobile-card">
        <div className="demo-mobile-section-head">
          <div>
            <p className="demo-mobile-kicker">Preview</p>
            <h2 className="demo-mobile-section-title">Static mobile view</h2>
          </div>
        </div>
        <StaticPreview activeDemo={activeDemo} accent={demo.accent} />
      </section>

      <section className="demo-mobile-card">
        <div className="demo-mobile-section-head">
          <div>
            <p className="demo-mobile-kicker">About</p>
            <h2 className="demo-mobile-section-title">{demo.subtitle}</h2>
          </div>
        </div>
        <p className="demo-mobile-body">{demo.description}</p>
      </section>

      <section className="demo-mobile-card">
        <div className="demo-mobile-section-head">
          <div>
            <p className="demo-mobile-kicker">Key concepts</p>
            <h2 className="demo-mobile-section-title">Core ideas from the info panel</h2>
          </div>
        </div>
        <ul className="demo-mobile-list">
          {extra.concepts.map((concept) => (
            <li key={concept}>{concept}</li>
          ))}
        </ul>
      </section>

      <section className="demo-mobile-card">
        <div className="demo-mobile-section-head">
          <div>
            <p className="demo-mobile-kicker">On desktop</p>
            <h2 className="demo-mobile-section-title">What to try next</h2>
          </div>
        </div>
        <ul className="demo-mobile-list">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
