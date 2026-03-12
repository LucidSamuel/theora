import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { DEMOS } from '@/types';
import { DemoIcon } from '@/components/shared/DemoIcon';
import { HeroAnimation } from '@/components/landing/HeroAnimation';

const PRIMITIVES = ['Merkle Trees', 'Polynomial Commitments', 'RSA Accumulators', 'Recursive Proofs'];

const DEMO_HIGHLIGHTS: Record<string, string[]> = {
  merkle: ['Generate inclusion proofs', 'Step through verification', 'Copy/download proof JSON'],
  polynomial: ['Reshape curves in real time', 'Run the 4-step KZG flow', 'Compare polynomials and intersections'],
  accumulator: ['Membership + non-membership proofs', 'Batch add primes', 'Witness verification workflow'],
  recursive: ['Proof trees and IVC chains', 'Inject bad proofs and trace failures', 'Pasta cycle visualization'],
};

const DEMO_ACCENTS: Record<string, string> = {
  merkle: '#b8733a',
  polynomial: '#5f7ea0',
  accumulator: '#c8824a',
  recursive: '#8a6b5b',
};

function CyclingText() {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<'visible' | 'exit' | 'enter'>('visible');

  useEffect(() => {
    const interval = setInterval(() => {
      setState('exit');
      setTimeout(() => {
        setIndex((i) => (i + 1) % PRIMITIVES.length);
        setState('enter');
        setTimeout(() => setState('visible'), 350);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const transforms: Record<string, string> = {
    visible: 'translateY(0) skewY(0deg)',
    exit: 'translateY(-28px) skewY(-2deg)',
    enter: 'translateY(28px) skewY(2deg)',
  };

  const opacities: Record<string, number> = {
    visible: 1,
    exit: 0,
    enter: 0,
  };

  return (
    <span className="relative block overflow-hidden" style={{ height: '1.15em' }}>
      <span className="invisible block" aria-hidden="true">Polynomial Commitments</span>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: opacities[state],
          transform: transforms[state],
          transition: state === 'visible'
            ? 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'opacity 280ms ease, transform 280ms ease',
          background: 'linear-gradient(135deg, var(--text-primary) 0%, color-mix(in srgb, var(--text-primary) 75%, transparent) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {PRIMITIVES[index]}
      </span>
    </span>
  );
}

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const scrolled = useScrolled();
  const demoSectionRef = useInView(0.08);
  const featureSectionRef = useInView(0.08);

  return (
    <div
      className="landing-page min-h-screen w-full overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* ── Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled
            ? 'color-mix(in srgb, var(--bg-primary) 88%, transparent)'
            : 'color-mix(in srgb, var(--bg-primary) 40%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        }}
      >
        <div className="landing-container h-16 flex items-center justify-between">
          <span className="text-base font-display font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <span style={{ opacity: 0.35 }}>∴</span> theora
          </span>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/LucidSamuel/theora"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-[13px] no-underline landing-link px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              GitHub
            </a>
            <button
              onClick={toggle}
              className="landing-icon-btn"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button onClick={() => navigate('/app')} className="landing-btn-primary">
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', paddingTop: '80px' }}
      >
        <HeroAnimation />

        {/* Radial glow at top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--text-primary) 12%, transparent) 0%, transparent 70%)',
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: '200px',
            background: 'linear-gradient(to top, var(--bg-primary), transparent)',
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        <div className="landing-container relative w-full" style={{ zIndex: 10 }}>
          <div className="max-w-[920px] mx-auto text-center flex flex-col items-center py-20 lg:py-28">

            {/* Pill badge */}
            <div className="landing-fade-up" style={{ animationDelay: '0ms' }}>
              <span className="landing-pill">
                <span style={{ opacity: 0.5, marginRight: '6px' }}>✦</span>
                Built for developers, researchers, and educators
              </span>
            </div>

            {/* Main heading */}
            <div className="landing-fade-up mt-9" style={{ animationDelay: '80ms' }}>
              <h1
                style={{
                  fontSize: 'clamp(2.6rem, 7vw, 5.6rem)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.0,
                  color: 'var(--text-primary)',
                }}
              >
                Cryptography,
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>made explorable</span>
                <br />
                <span style={{ display: 'block', marginTop: '0.05em' }}>
                  through <CyclingText />
                </span>
              </h1>
            </div>

            {/* Subheading */}
            <div className="landing-fade-up mt-9" style={{ animationDelay: '160ms' }}>
              <p
                style={{
                  fontSize: 'clamp(15px, 1.6vw, 18px)',
                  lineHeight: 1.75,
                  maxWidth: '640px',
                  color: 'var(--text-secondary)',
                }}
              >
                A unified visual lab for Merkle trees, polynomial commitments, RSA accumulators,
                and recursive proof composition. Interactive canvas demos, step-through verification,
                and shareable state links.
              </p>
            </div>

            {/* CTA buttons */}
            <div className="landing-fade-up flex flex-wrap justify-center gap-3 mt-11" style={{ animationDelay: '240ms' }}>
              <button onClick={() => navigate('/app')} className="landing-btn-primary landing-btn-lg">
                Explore Demos
              </button>
              <a
                href="https://github.com/LucidSamuel/theora"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-secondary landing-btn-lg no-underline"
              >
                View Source ↗
              </a>
            </div>

            {/* Stat cards */}
            <div className="landing-fade-up w-full mt-20 lg:mt-24" style={{ animationDelay: '340ms' }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: 'Core primitives', value: '4 interactive demos', icon: '◈' },
                  { label: 'Rendering model', value: 'Hand-drawn canvas', icon: '◇' },
                  { label: 'Sharing', value: 'URL-serialized state', icon: '⊕' },
                  { label: 'Use case', value: 'Teaching & research', icon: '∴' },
                ].map((stat) => (
                  <div key={stat.label} className="landing-stat-card">
                    <span className="landing-stat-icon">{stat.icon}</span>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                      {stat.label}
                    </p>
                    <p className="mt-1.5 text-[14px] font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="landing-container">
        <div className="landing-divider" />
      </div>

      {/* ── Demo cards section ── */}
      <section
        ref={demoSectionRef.ref as React.RefObject<HTMLElement>}
        className={`pt-24 sm:pt-32 pb-24 sm:pb-32 section-reveal ${demoSectionRef.inView ? 'in-view' : ''}`}
      >
        <div className="landing-container">
          <div className="mb-16 sm:mb-20">
            <p className="landing-kicker">Demo suite</p>
            <h2 className="landing-section-title mt-5 max-w-[600px]">
              Four primitives, one consistent interaction model
            </h2>
            <p className="mt-5 max-w-[560px]" style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
              Each module combines intuitive controls, animated state transitions, and concrete
              verification steps so you can move from theory to intuition quickly.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {DEMOS.map((demo, i) => {
              const accent = DEMO_ACCENTS[demo.id] ?? '#888';
              return (
                <button
                  key={demo.id}
                  onClick={() => navigate(`/app#${demo.id}`)}
                  className="landing-card text-left"
                  style={{ animationDelay: demoSectionRef.inView ? `${i * 60}ms` : '0ms' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${accent}15`,
                        border: `1px solid ${accent}28`,
                        boxShadow: `0 0 16px ${accent}12`,
                      }}
                    >
                      <DemoIcon id={demo.id} size={19} color={accent} />
                    </div>
                    <span className="landing-card-arrow">↗</span>
                  </div>

                  <h3 className="text-[18px] font-semibold font-display mb-3" style={{ color: 'var(--text-primary)' }}>
                    {demo.title}
                  </h3>

                  <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                    {demo.subtitle}
                  </p>

                  <div className="space-y-2">
                    {(DEMO_HIGHLIGHTS[demo.id] ?? []).map((item) => (
                      <div key={item} className="flex items-center gap-2.5">
                        <span
                          className="w-1 h-1 rounded-full shrink-0"
                          style={{ backgroundColor: accent, opacity: 0.65 }}
                        />
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div
                    className="mt-6 h-px"
                    style={{ background: `linear-gradient(to right, ${accent}30, transparent)` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="landing-container">
        <div className="landing-divider" />
      </div>

      {/* ── Features section ── */}
      <section
        ref={featureSectionRef.ref as React.RefObject<HTMLElement>}
        className={`pt-24 sm:pt-32 pb-24 sm:pb-32 section-reveal ${featureSectionRef.inView ? 'in-view' : ''}`}
      >
        <div className="landing-container">
          <div className="mb-16 sm:mb-20">
            <p className="landing-kicker">Platform capabilities</p>
            <h2 className="landing-section-title mt-5 max-w-[560px]">
              Built as tooling, not just a static showcase
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                title: 'State sharing & embedding',
                desc: 'Every demo serializes into the URL. Each primitive can be embedded in docs, blogs, and workshop material.',
                icon: '⊕',
              },
              {
                title: 'Step-through verification',
                desc: 'Walk proof logic incrementally to see exactly how values evolve across each verification stage.',
                icon: '▶',
              },
              {
                title: 'High-fidelity canvas rendering',
                desc: 'All diagrams are rendered on HTML5 canvas with spring-driven motion and HiDPI scaling.',
                icon: '◇',
              },
              {
                title: 'Research-ready presentation',
                desc: 'Useful for conference demos, onboarding sessions, security reviews, and explanatory screenshots.',
                icon: '∴',
              },
              {
                title: 'Dark and light themes',
                desc: 'System-aware theming with persistent user preference and coherent contrast across all controls.',
                icon: '◑',
              },
              {
                title: 'Composable architecture',
                desc: 'A clean logic + renderer + React pattern across demos makes it easy to add new primitives.',
                icon: '⬡',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="landing-feature-card"
                style={{ animationDelay: featureSectionRef.inView ? `${i * 55}ms` : '0ms' }}
              >
                <span className="landing-feature-icon">{item.icon}</span>
                <h3 className="mt-4 text-[16px] font-semibold font-display mb-2.5" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pb-28 sm:pb-36">
        <div className="landing-container">
          <div className="landing-cta-panel text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-7"
              style={{
                background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
                border: '1px solid var(--border)',
                fontSize: '22px',
              }}
            >
              ∴
            </div>
            <p className="landing-kicker">Start exploring</p>
            <h2 className="landing-section-title mt-5 max-w-[540px] mx-auto">
              Open the visual lab and test cryptographic intuition
            </h2>
            <p
              className="mt-6 max-w-[500px] mx-auto"
              style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)' }}
            >
              No installation, no account, no setup. Launch the app, manipulate real inputs,
              and share the exact state with your team.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <button onClick={() => navigate('/app')} className="landing-btn-primary landing-btn-lg">
                Launch Theora
              </button>
              <a
                href="https://github.com/LucidSamuel/theora"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-secondary landing-btn-lg no-underline"
              >
                View Source ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="landing-container py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ opacity: 0.35 }}>∴</span> theora — open source cryptography visual tooling
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/LucidSamuel/theora"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline landing-link"
              style={{ fontSize: '12px', color: 'var(--text-muted)' }}
            >
              GitHub
            </a>
            <a
              href="https://x.com/lucidzk"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline landing-link"
              style={{ fontSize: '12px', color: 'var(--text-muted)' }}
            >
              @lucidzk
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
