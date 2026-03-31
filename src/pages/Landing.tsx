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
  "PROOF RERANDOMIZATION",
  "OBLIVIOUS SYNC",
  "ELLIPTIC CURVES",
  "FIAT-SHAMIR",
  "R1CS CIRCUITS",
  "LOOKUP ARGUMENTS",
  "PEDERSEN COMMITMENTS",
  "HASH COST COMPARISON",
  "GROTH16",
  "PLONK",
  "PROOF PIPELINE",
];

const AUDIENCES: {
  tag: string;
  title: string;
  body: string;
  featured?: boolean;
}[] = [
  {
    tag: "Audit",
    title: "Security Auditors",
    body: "Inject a bad witness into a Groth16 proof and watch it fail at the pairing check. Corrupt a Fiat-Shamir transcript and see the challenge become predictable. Break a copy constraint in PLONK and trace exactly which gate equation goes non-zero. Every failure mode is interactive, shareable, and reproducible via URL.",
    featured: true,
  },
  {
    tag: "Build",
    title: "ZK Engineers",
    body: "Step through the full proof pipeline — witness generation, R1CS, polynomial interpolation, KZG commitment, Fiat-Shamir challenge, opening, verification — with real computed values at every stage. Drill into any primitive from the pipeline with exact state handoff.",
  },
  {
    tag: "Research",
    title: "Researchers",
    body: "Compare Groth16 vs PLONK arithmetization, IVC folding vs split accumulation, KZG vs Pedersen commitments. Every demo is parameterized — change the circuit, the field, the tree depth and see what shifts.",
  },
  {
    tag: "Teach",
    title: "Educators",
    body: "Every demo state is a stable URL. Embed a Merkle proof mid-verification into lecture slides. Link a broken Fiat-Shamir transcript in a problem set. Students interact with the actual primitive, not a diagram of one.",
  },
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
  const demoCount = DEMOS.length;
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
                {DEMO_GROUPS.map((group) => (
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
              Build real intuition for cryptography, not by reading papers,
              but by interacting with the actual primitives. Drag, click, break
              things, watch math happen.
            </p>

            <div className="flex flex-wrap gap-3 mt-10 sm:mt-12">
              <button
                onClick={() => navigate(appHref)}
                className="lp-btn-primary lp-btn-lg"
              >
                Explore Demos →
              </button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn-ghost lp-btn-lg"
              >
                Source ↗
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
                title="Theora demo preview"
                className="lp-teaser-iframe"
                loading="lazy"
                tabIndex={-1}
              />
            </div>
            <p className="lp-teaser-caption">
              One of {demoCount} interactive demos. Each state is a shareable
              URL.
            </p>
          </div>
        </div>
      </section>

      {/* ── BODY SECTIONS (new layout) ── */}
      <main>
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
              {DEMO_GROUPS.map((group, groupIdx) => {
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

        <section className="lp-section lp-section--gap">
          <div className="lp-shell">
            <div className="lp-problem-frame">
              <p className="lp-overline">Why Theora</p>
              <h2 className="lp-section-title">
                The ZK visualization landscape is thin.
              </h2>
              <p className="lp-problem-body">
                There is no tool that lets you <em>see</em> a polynomial
                commitment form, <em>break</em> a Fiat-Shamir transcript, or{" "}
                <em>watch</em> a pairing check reject a corrupted proof — in the
                browser, with real math, at 60fps. Theora fills that gap across{" "}
                {demoCount} primitives.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-shell">
            <div className="lp-section-head">
              <div>
                <p className="lp-overline">Built for</p>
                <h2 className="lp-section-title">
                  People who already know the math and want to see it move.
                </h2>
              </div>
            </div>

            {/* Featured persona (Security Auditors) — always expanded */}
            {AUDIENCES.filter((a) => a.featured).map((audience) => (
              <article key={audience.title} className="lp-audience-featured">
                <span className="lp-audience-tag">{audience.tag}</span>
                <h3 className="lp-audience-featured-title">{audience.title}</h3>
                <p className="lp-audience-featured-body">{audience.body}</p>
              </article>
            ))}

            {/* Remaining personas — collapsible */}
            <div className="lp-audience-grid">
              {AUDIENCES.filter((a) => !a.featured).map((audience) => (
                <details
                  key={audience.title}
                  className="lp-audience-card lp-audience-collapse"
                >
                  <summary className="lp-audience-summary">
                    <span className="lp-audience-tag">{audience.tag}</span>
                    <h3 className="lp-audience-title">{audience.title}</h3>
                    <span className="lp-audience-chevron" aria-hidden="true" />
                  </summary>
                  <p className="lp-audience-body">{audience.body}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

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
              Open-source cryptography visual tooling
            </p>
          </div>
          <div className="lp-footer-links">
            <a href={appHref} className="lp-nav-link">
              Launch App
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
          <p className="lp-footer-legal">MIT License</p>
        </div>
      </footer>
    </div>
  );
}
