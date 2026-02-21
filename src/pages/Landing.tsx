import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { DEMOS } from '@/types';
import { DemoIcon } from '@/components/shared/DemoIcon';
import { HeroAnimation } from '@/components/landing/HeroAnimation';

const PRIMITIVES = ['Merkle Trees', 'Polynomial Commitments', 'Accumulators', 'Recursive Proofs'];

function CyclingText() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % PRIMITIVES.length);
        setFade(true);
      }, 250);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative block h-[1.15em] overflow-hidden">
      {/* Invisible sizer — widest string keeps consistent width */}
      <span className="invisible block" aria-hidden="true">Polynomial Commitments</span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        {PRIMITIVES[index]}
      </span>
    </span>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="landing-container h-14 flex items-center justify-between">
          <span className="text-sm font-display font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <span style={{ opacity: 0.4 }}>∴</span> theora
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/LucidSamuel/theora"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-[13px] no-underline landing-link"
              style={{ color: 'var(--text-muted)' }}
            >
              GitHub
            </a>
            <button
              onClick={toggle}
              className="landing-icon-btn"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '\u2600' : '\u263E'}
            </button>
            <button
              onClick={() => navigate('/app')}
              className="landing-btn-primary"
            >
              Open App
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20 sm:py-24">
        <HeroAnimation />
        <div className="landing-container relative z-10 text-center flex flex-col items-center">
          <h1
            className="text-4xl sm:text-5xl md:text-[64px] font-display font-bold tracking-tight leading-[1.1] max-w-[760px] mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Visualize
            <CyclingText />
          </h1>
          <p
            className="mt-8 text-[13px] md:text-[15px] max-w-[440px] mx-auto leading-relaxed text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            Interactive, animated explorations of cryptographic primitives. Built for developers and researchers.
          </p>
          <div className="flex justify-center gap-3 mt-12">
            <button
              onClick={() => navigate('/app')}
              className="landing-btn-primary"
            >
              Launch App
            </button>
            <a
              href="https://github.com/LucidSamuel/theora"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn-secondary no-underline"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Demos */}
      <section>
        <div className="landing-container py-28 sm:py-32">
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {DEMOS.map((demo) => (
              <button
                key={demo.id}
                onClick={() => navigate(`/app#${demo.id}`)}
                className="landing-card text-left"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--button-bg-strong)' }}
                  >
                    <DemoIcon id={demo.id} size={16} color="var(--text-muted)" />
                  </div>
                  <h3
                    className="text-[13px] font-semibold font-display"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {demo.title}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed pl-11" style={{ color: 'var(--text-muted)' }}>
                  {demo.subtitle}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="landing-container pt-24 pb-20 sm:pt-28 sm:pb-24">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-y-14 sm:gap-y-16 gap-x-10 sm:gap-x-12">
            {[
              { title: 'Canvas rendered', desc: 'All visuals drawn on HTML5 canvas at device resolution.' },
              { title: 'Spring physics', desc: '60fps animations driven by spring dynamics.' },
              { title: 'Shareable states', desc: 'Every state serializes to a URL. Share or embed.' },
              { title: 'Step-through', desc: 'Walk through proof verification one step at a time.' },
              { title: 'Dark & light', desc: 'System-aware theming. Zero flash on load.' },
              { title: 'Embeddable', desc: 'Drop any demo into an iframe with one query param.' },
            ].map((f) => (
              <div key={f.title}>
                <h3
                  className="text-[13px] font-semibold mb-1 font-display"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="landing-container pt-24 pb-20 sm:pt-28 sm:pb-24 text-center">
          <h2
            className="text-2xl md:text-3xl font-display font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Start exploring
          </h2>
          <p
            className="mt-5 text-[13px]"
            style={{ color: 'var(--text-muted)' }}
          >
            No install. No signup. Open and learn.
          </p>
          <div className="mt-10">
            <button
              onClick={() => navigate('/app')}
              className="landing-btn-primary"
            >
              Launch App
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="landing-container py-9 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ opacity: 0.4 }}>∴</span> theora
          </span>
          <a
            href="https://x.com/lucidzk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] no-underline landing-link"
            style={{ color: 'var(--text-muted)' }}
          >
            Lucid Samuel
          </a>
        </div>
      </footer>
    </div>
  );
}
