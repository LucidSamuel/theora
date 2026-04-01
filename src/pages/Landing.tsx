import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeroAnimation } from "@/components/landing/HeroAnimation";
import { DemoIcon } from "@/components/shared/DemoIcon";
import { DEMO_GROUPS } from "@/content/demoGroups";
import { useTheme } from "@/hooks/useTheme";
import { DEMOS, type DemoId } from "@/types";

const GITHUB_URL = "https://github.com/LucidSamuel/theora";
const TWITTER_URL = "https://x.com/lucidzk";

const TICKER_ITEMS = [
  "MERKLE TREES",
  "KZG COMMITMENTS",
  "RSA ACCUMULATORS",
  "RECURSIVE PROOFS",
  "SPLIT ACCUMULATION",
  "ELLIPTIC CURVES",
  "FIAT-SHAMIR",
  "R1CS CIRCUITS",
  "LOOKUP ARGUMENTS",
  "PEDERSEN COMMITMENTS",
  "GROTH16",
  "PLONK",
  "PROOF PIPELINE",
];

const DEMO_BY_ID = DEMOS.reduce<Record<DemoId, (typeof DEMOS)[number]>>(
  (acc, demo) => {
    acc[demo.id] = demo;
    return acc;
  },
  {} as Record<DemoId, (typeof DEMOS)[number]>,
);

function useScrollY() {
  const [y, setY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return y;
}

export function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const scrollY = useScrollY();
  const navScrolled = scrollY > 40;
  const publicGroups = DEMO_GROUPS.filter(g => g.title !== 'Privacy Primitives');
  const appHref = "/app";
  const origin = "https://www.theora.dev";
  const embedSnippet = `<iframe src="${origin}/app?embed=merkle" width="960" height="540" style="border:0"></iframe>`;

  return (
    <div
      className="lp"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ── NAV ── */}
      <nav
        className="lp-nav"
        style={{
          borderBottom: navScrolled
            ? "1px solid var(--border)"
            : "1px solid transparent",
          background: navScrolled
            ? "color-mix(in srgb, var(--bg-primary) 92%, transparent)"
            : "transparent",
          backdropFilter: navScrolled ? "blur(18px)" : "none",
        }}
      >
        <div className="lp-shell lp-nav-inner">
          <a href="/" className="lp-brand no-underline">
            <span className="lp-brand-mark">∴</span>
            <span>theora</span>
          </a>
          <div className="lp-nav-actions">
            {/* Demos megamenu dropdown */}
            <div className="lp-nav-dropdown">
              <button
                className="lp-nav-link lp-nav-dropdown-trigger"
                type="button"
              >
                Demos <span className="lp-nav-caret" aria-hidden="true" />
              </button>
              <div className="lp-nav-dropdown-panel">
                {publicGroups.map((group) => (
                  <div key={group.title} className="lp-nav-dropdown-group">
                    <span className="lp-nav-dropdown-label">{group.title}</span>
                    {group.demos.map((demoId) => {
                      const demo = DEMO_BY_ID[demoId];
                      return (
                        <a
                          key={demo.id}
                          href={`/app#${demo.id}`}
                          className="lp-nav-dropdown-item"
                        >
                          <DemoIcon
                            id={demo.id}
                            size={12}
                            color={demo.accent}
                          />
                          <span>{demo.title}</span>
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <a
              href="/research"
              className="lp-nav-link hidden sm:flex"
            >
              Research
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-nav-link hidden sm:flex"
            >
              GitHub ↗
            </a>
            <button
              onClick={toggle}
              className="lp-icon-btn"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button
              onClick={() => navigate(appHref)}
              className="lp-btn-primary"
            >
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero relative overflow-hidden">
        <HeroAnimation />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 lp-grid-bg pointer-events-none"
          style={{ zIndex: 1 }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 2,
            background:
              "radial-gradient(ellipse 90% 60% at 50% 100%, var(--bg-primary) 0%, transparent 60%)",
          }}
        />

        {/* Ticker pinned to bottom of hero */}
        <div
          className="absolute bottom-0 left-0 right-0 lp-ticker"
          style={{ zIndex: 10 }}
        >
          <div className="lp-ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="lp-ticker-item">
                {item}
                <span className="lp-ticker-dot">·</span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="lp-shell lp-hero-split relative h-full py-12 sm:py-16 pb-16 sm:pb-20"
          style={{ zIndex: 10 }}
        >
          {/* Left column — copy + CTAs */}
          <div className="lp-hero-copy">
            <div className="mb-10 sm:mb-12">
              <span className="lp-mono-label">
                ∴ UNDERSTAND ZK, NOT JUST READ ABOUT IT
              </span>
            </div>

            <h1 className="lp-hero-title mb-10 sm:mb-12">
              Cryptography,
              <br />
              <span className="lp-hero-title-sub">made visible.</span>
            </h1>

            <p className="lp-hero-sub sm:max-w-[520px]">
              Interactive demos. Multiple modes of interaction. Upload a
              paper, get interactive diagrams. Build real intuition for
              cryptographic primitives — not by reading, but by breaking things
              and watching math happen.
            </p>

            <div className="flex flex-wrap gap-3 mt-10 sm:mt-12">
              <button
                onClick={() => navigate("/app#pipeline")}
                className="lp-btn-primary lp-btn-lg"
              >
                Explore Demos →
              </button>
              <a
                href="/research"
                className="lp-btn-ghost lp-btn-lg"
              >
                Explore a paper →
              </a>
            </div>
          </div>

          {/* Right column — live demo teaser */}
          <div className="lp-hero-teaser">
            <div className="lp-teaser-frame">
              <div className="lp-teaser-bar">
                <span className="lp-teaser-dot" />
                <span className="lp-teaser-dot" />
                <span className="lp-teaser-dot" />
                <span className="lp-teaser-label">
                  Live Preview — Proof Pipeline
                </span>
              </div>
              <iframe
                src={`${origin}/app?embed=pipeline`}
                title="theora demo preview"
                className="lp-teaser-iframe"
                loading="lazy"
                tabIndex={-1}
              />
            </div>
            <p className="lp-teaser-caption">
              Every demo state is a shareable URL.
            </p>
          </div>
        </div>
      </section>

      {/* ── BODY SECTIONS ── */}
      <main>
        {/* Demo Gallery */}
        <section id="demo-gallery" className="lp-section lp-section--tight">
          <div className="lp-shell">
            <div className="lp-section-head">
              <div>
                <p className="lp-overline">Demo gallery</p>
                <h2 className="lp-section-title">
                  Explore interactive primitives.
                </h2>
              </div>
            </div>

            <p className="lp-mobile-note-section">
              Interactive demos are best experienced on desktop.
            </p>

            <div className="lp-demo-groups">
              {publicGroups.map((group, groupIdx) => {
                const showPreview = groupIdx > 0;
                return (
                  <section key={group.title} className="lp-demo-group">
                    <div className="lp-demo-group-head">
                      <div>
                        <p className="lp-overline">{group.title}</p>
                        <h3 className="lp-group-title">{group.description}</h3>
                      </div>
                    </div>
                    <div
                      className="lp-demo-grid"
                      style={
                        {
                          "--col-count":
                            group.demos.length % 3 === 0
                              ? 3
                              : group.demos.length % 2 === 0
                                ? 2
                                : 3,
                        } as React.CSSProperties
                      }
                    >
                      {group.demos.map((demoId) => {
                        const demo = DEMO_BY_ID[demoId];

                        return (
                          <a
                            key={demo.id}
                            href={`/app#${demo.id}`}
                            className={`lp-demo-card${showPreview ? "" : " lp-demo-card--compact"}`}
                          >
                            {showPreview && (
                              <div className="lp-demo-card-preview">
                                <iframe
                                  src={`${origin}/app?embed=${demo.id}`}
                                  title={`${demo.title} preview`}
                                  className="lp-demo-card-iframe"
                                  loading="lazy"
                                  tabIndex={-1}
                                />
                              </div>
                            )}
                            <div className="lp-demo-card-content">
                              <div className="lp-demo-card-top">
                                <span className="lp-demo-route">
                                  /{demo.id}
                                </span>
                                <span className="lp-demo-open">open →</span>
                              </div>
                              <div className="lp-demo-card-title">
                                <DemoIcon
                                  id={demo.id}
                                  size={16}
                                  color={demo.accent}
                                />
                                <h4>{demo.title}</h4>
                              </div>
                              <p className="lp-demo-card-body">
                                {demo.subtitle}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>

        {/* How You Interact — Modes */}
        <section className="lp-section">
          <div className="lp-shell">
            <div className="lp-section-head lp-section-head--stack">
              <p className="lp-overline">How you interact</p>
              <h2 className="lp-section-title">
                Three ways to learn the same primitive.
              </h2>
            </div>

            <div className="lp-audience-grid" style={{ marginTop: 32 }}>
              <a href="/app#pipeline" className="lp-mode-card" style={modeCardStyle}>
                <span className="lp-audience-tag">Explore</span>
                <h3 className="lp-audience-title">Full control</h3>
                <p className="lp-audience-body">
                  Drag sliders, inject faults, break things, watch math happen.
                </p>
              </a>
              <a href="/app?mode=predict#pipeline" className="lp-mode-card" style={modeCardStyle}>
                <span className="lp-audience-tag">Predict</span>
                <h3 className="lp-audience-title">Test your intuition</h3>
                <p className="lp-audience-body">
                  Guess what happens next, then watch the math play out.
                  Randomized parameters mean you can't memorize — you have to
                  understand.
                </p>
              </a>
              <a href="/app?mode=attack#fiat-shamir" className="lp-mode-card" style={modeCardStyle}>
                <span className="lp-audience-tag">Attack</span>
                <h3 className="lp-audience-title">Think like an adversary</h3>
                <p className="lp-audience-body">
                  Forge proofs, exploit missing constraints, break Fiat-Shamir
                  transcripts. Guided scenarios across multiple demos.
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* Beyond the Sandbox — Workspaces */}
        <section className="lp-section lp-section--gap">
          <div className="lp-shell">
            <div className="lp-section-head lp-section-head--stack">
              <p className="lp-overline">Beyond the sandbox</p>
              <h2 className="lp-section-title">
                From demos to workflows.
              </h2>
            </div>

            <div className="lp-audience-grid" style={{ marginTop: 32 }}>
              <a href="/research" className="lp-mode-card" style={modeCardStyle}>
                <span className="lp-audience-tag">Research</span>
                <h3 className="lp-audience-title">Paper-to-Proof</h3>
                <p className="lp-audience-body">
                  Upload a cryptography paper. Get an interactive walkthrough
                  with live demos mapped to each section. 5 curated walkthroughs
                  included.
                </p>
              </a>
              <div className="lp-mode-card" style={{ ...modeCardStyle, opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="lp-audience-tag">Audit</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coming soon</span>
                </div>
                <h3 className="lp-audience-title">Protocol Reviews</h3>
                <p className="lp-audience-body">
                  Document protocol reviews with live proof states. Write notes
                  alongside interactive demos.
                </p>
              </div>
              <div className="lp-mode-card" style={{ ...modeCardStyle, opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="lp-audience-tag">Compose</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coming soon</span>
                </div>
                <h3 className="lp-audience-title">Build Your Own</h3>
                <p className="lp-audience-body">
                  Combine primitives into custom proof systems. Pick your
                  commitment scheme, constraint system, and hash function.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why theora */}
        <section className="lp-section lp-section--gap">
          <div className="lp-shell">
            <div className="lp-problem-frame">
              <p className="lp-overline">Why theora</p>
              <h2 className="lp-section-title">
                The ZK visualization landscape is thin.
              </h2>
              <p className="lp-problem-body">
                There is no tool that lets you <em>see</em> a polynomial
                commitment form, <em>break</em> a Fiat-Shamir transcript, or{" "}
                <em>watch</em> a pairing check reject a corrupted proof — in the
                browser, with real math, at 60fps. theora fills that gap across{" "}
                every primitive we cover.
              </p>
            </div>
          </div>
        </section>

        {/* Who Is This For */}
        <section className="lp-section">
          <div className="lp-shell">
            <div className="lp-section-head lp-section-head--stack">
              <p className="lp-overline">Who is this for</p>
              <h2 className="lp-section-title">
                People who already know the math and want to see it move.
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 32 }}>
              <div style={audienceCardStyle}>
                <span className="lp-audience-tag">Build</span>
                <h3 className="lp-audience-title">ZK Engineers</h3>
                <p className="lp-audience-body">
                  Debug circuits visually, trace constraint failures, find
                  underconstrained wires before auditors do.
                </p>
              </div>
              <div style={audienceCardStyle}>
                <span className="lp-audience-tag">Audit</span>
                <h3 className="lp-audience-title">Security Auditors</h3>
                <p className="lp-audience-body">
                  Inject faults, play the adversary, see exactly where soundness
                  breaks in 5 guided attack scenarios.
                </p>
              </div>
              <div style={audienceCardStyle}>
                <span className="lp-audience-tag">Research</span>
                <h3 className="lp-audience-title">Researchers</h3>
                <p className="lp-audience-body">
                  Upload papers and get interactive diagrams. Compare
                  constructions side-by-side. Cite shareable demo states.
                </p>
              </div>
              <div style={audienceCardStyle}>
                <span className="lp-audience-tag">Teach</span>
                <h3 className="lp-audience-title">Educators</h3>
                <p className="lp-audience-body">
                  Embed interactive demos in slides, blog posts, and course
                  materials. Every state is a URL.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Embeddability */}
        <section className="lp-section">
          <div className="lp-shell lp-embed-grid">
            <div>
              <p className="lp-overline">Embeddability</p>
              <h2 className="lp-section-title">
                Every state is a URL. Embed it in docs, posts, or slides.
              </h2>
              <p className="lp-section-copy">
                Strip the UI, keep the demo. Share a living demo, not a frozen
                image.
              </p>
              <div className="lp-code-block">
                <code>{embedSnippet}</code>
              </div>
            </div>

            <div className="lp-embed-preview">
              <div className="lp-embed-browser">
                <div className="lp-embed-browser-bar">
                  <span />
                  <span />
                  <span />
                  <code>
                    {origin.replace(/^https?:\/\//, "")}/app?embed=merkle
                  </code>
                </div>
                <div className="lp-embed-browser-body">
                  <div className="lp-embed-node-strip">
                    <span className="is-strong" />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="lp-embed-proof-path">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p className="lp-embed-caption">
                    Embeddable state stays aligned with the shared URL.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
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
            <a href={appHref} className="lp-nav-link">
              Launch App
            </a>
            <a href="/research" className="lp-nav-link">
              Research
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-nav-link"
            >
              GitHub ↗
            </a>
            <a
              href={TWITTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-nav-link"
            >
              @lucidzk ↗
            </a>
          </div>
          <p className="lp-footer-legal">v1.0.0 · MIT License · By LucidSamuel</p>
        </div>
      </footer>
    </div>
  );
}

const modeCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '20px 18px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-element)',
  textDecoration: 'none',
  color: 'inherit',
};

const audienceCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '20px 18px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-element)',
};
