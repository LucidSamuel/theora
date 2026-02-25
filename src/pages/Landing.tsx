import { useState, useEffect } from 'react';
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
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % PRIMITIVES.length);
        setFade(true);
      }, 250);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative block h-[1.2em] overflow-hidden">
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
      className="landing-page min-h-screen w-full overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-primary) 78%, transparent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="landing-container h-16 flex items-center justify-between">
          <span className="text-base font-display font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
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
            <button onClick={() => navigate('/app')} className="landing-btn-primary">
              Launch App
            </button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-36 pb-24 sm:pt-44 sm:pb-32 lg:pt-48 lg:pb-40">
        <HeroAnimation />
        <div className="absolute inset-0 z-[1] landing-hero-glow" aria-hidden="true" />

        <div className="landing-container relative z-10">
          <div className="max-w-[860px] mx-auto text-center flex flex-col items-center">
            <span className="landing-pill">Built for developers, researchers, and educators</span>

            <h1
              className="mt-8 text-[clamp(2.4rem,6.7vw,5.2rem)] font-display font-semibold tracking-[-0.04em] leading-[1.02]"
              style={{ color: 'var(--text-primary)' }}
            >
              Cryptography,
              <br />
              made explorable through
              <CyclingText />
            </h1>

            <p
              className="mt-8 text-[15px] sm:text-[17px] leading-relaxed max-w-[700px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              A unified visual lab for Merkle trees, polynomial commitments, RSA accumulators, and recursive proof
              composition. Interactive canvas demos, step-through verification, and shareable state links.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mt-14">
              <button onClick={() => navigate('/app')} className="landing-btn-primary">
                Explore Demos
              </button>
              <a
                href="https://github.com/LucidSamuel/theora"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-secondary no-underline"
              >
                View Source
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full mt-20 sm:mt-24">
              {[
                { label: 'Core primitives', value: '4 interactive demos' },
                { label: 'Rendering model', value: 'Hand-drawn canvas' },
                { label: 'Sharing', value: 'URL-serialized state' },
                { label: 'Use case', value: 'Teaching and research' },
              ].map((stat) => (
                <div key={stat.label} className="landing-stat-card">
                  <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                    {stat.label}
                  </p>
                  <p className="mt-2 text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="landing-container"><hr className="landing-divider" /></div>

      <section className="pt-20 sm:pt-28 pb-20 sm:pb-28">
        <div className="landing-container">
          <div className="max-w-[760px] mb-14 sm:mb-16">
            <p className="landing-kicker">Demo suite</p>
            <h2 className="landing-section-title mt-4">Four primitives, one consistent interaction model</h2>
            <p className="mt-6 text-[15px] sm:text-[16px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Each module combines intuitive controls, animated state transitions, and concrete verification steps so you
              can move from theory to intuition quickly.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            {DEMOS.map((demo) => {
              const accent = DEMO_ACCENTS[demo.id] ?? '#888';
              return (
                <button
                  key={demo.id}
                  onClick={() => navigate(`/app#${demo.id}`)}
                  className="landing-card text-left h-full"
                >
                  <div className="flex items-center gap-3.5 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${accent}18`, border: `1px solid ${accent}30` }}
                    >
                      <DemoIcon id={demo.id} size={18} color={accent} />
                    </div>
                    <h3 className="text-[17px] font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
                      {demo.title}
                    </h3>
                  </div>

                  <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {demo.subtitle}
                  </p>

                  <div className="mt-6 space-y-2.5">
                    {(DEMO_HIGHLIGHTS[demo.id] ?? []).map((item) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <span
                          className="mt-[7px] w-1 h-1 rounded-full shrink-0"
                          style={{ backgroundColor: accent, opacity: 0.7 }}
                        />
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="landing-container"><hr className="landing-divider" /></div>

      <section className="pt-20 sm:pt-28 pb-24 sm:pb-32">
        <div className="landing-container">
          <div className="max-w-[760px] mb-14 sm:mb-16">
            <p className="landing-kicker">Platform capabilities</p>
            <h2 className="landing-section-title mt-4">Built as tooling, not just a static showcase</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                title: 'State sharing and embedding',
                desc: 'Every demo serializes into the URL, and each primitive can be embedded in docs, blogs, and workshop material.',
                icon: '\u2197',
              },
              {
                title: 'Step-through verification',
                desc: 'Walk proof logic incrementally to see exactly how values evolve across each verification stage.',
                icon: '\u25B6',
              },
              {
                title: 'High-fidelity canvas rendering',
                desc: 'All diagrams are rendered on HTML5 canvas with spring-driven motion and HiDPI scaling for sharp output.',
                icon: '\u25C7',
              },
              {
                title: 'Research-ready presentation',
                desc: 'Useful for conference demos, onboarding sessions, security reviews, and explanatory screenshots.',
                icon: '\u2234',
              },
              {
                title: 'Dark and light themes',
                desc: 'System-aware theming with persistent user preference and coherent contrast across all controls.',
                icon: '\u25D1',
              },
              {
                title: 'Composable architecture',
                desc: 'A clean logic + renderer + React pattern across demos makes it straightforward to add new primitives.',
                icon: '\u2302',
              },
            ].map((item) => (
              <div key={item.title} className="landing-feature-card">
                <div className="flex items-center gap-3.5 mb-4">
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[14px]"
                    style={{ backgroundColor: 'var(--button-bg-strong)', color: 'var(--text-muted)' }}
                  >
                    {item.icon}
                  </span>
                  <h3 className="text-[16px] font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-28 sm:pb-36">
        <div className="landing-container">
          <div className="landing-cta-panel text-center">
            <p className="landing-kicker">Start exploring</p>
            <h2 className="landing-section-title mt-4">Open the visual lab and test cryptographic intuition</h2>
            <p className="mt-6 text-[15px] sm:text-[16px] leading-relaxed max-w-[620px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
              No installation, no account, and no setup ceremony. Launch the app, manipulate real inputs, and share the
              exact state with your team.
            </p>
            <div className="mt-10">
              <button onClick={() => navigate('/app')} className="landing-btn-primary">
                Launch Theora
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="landing-container py-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ opacity: 0.4 }}>∴</span> theora — open source cryptography visual tooling
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/LucidSamuel/theora"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] no-underline landing-link"
              style={{ color: 'var(--text-muted)' }}
            >
              GitHub
            </a>
            <a
              href="https://x.com/lucidzk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] no-underline landing-link"
              style={{ color: 'var(--text-muted)' }}
            >
              @lucidzk
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
