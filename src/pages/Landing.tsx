import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeroAnimation } from "@/components/landing/HeroAnimation";
import { DemoIcon } from "@/components/shared/DemoIcon";
import { DEMO_GROUPS } from "@/content/demoGroups";
import { useTheme } from "@/hooks/useTheme";
import { DEMOS, type DemoId } from "@/types";
import { trackLandingCta } from "@/lib/analytics";

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

/* ── Mode illustrations ── */

function ExploreIllustration() {
  return (
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true">
      {/* Grid */}
      <line x1="40" y1="20" x2="40" y2="140" stroke="currentColor" opacity="0.04" />
      <line x1="110" y1="20" x2="110" y2="140" stroke="currentColor" opacity="0.04" />
      <line x1="180" y1="20" x2="180" y2="140" stroke="currentColor" opacity="0.04" />
      <line x1="250" y1="20" x2="250" y2="140" stroke="currentColor" opacity="0.04" />
      <line x1="24" y1="50" x2="296" y2="50" stroke="currentColor" opacity="0.04" />
      <line x1="24" y1="90" x2="296" y2="90" stroke="currentColor" opacity="0.04" />
      <line x1="24" y1="130" x2="296" y2="130" stroke="currentColor" opacity="0.04" />
      {/* Ghost curve (parameter variation) */}
      <path d="M 24 95 C 70 50, 120 110, 160 70 C 200 30, 250 85, 296 50"
            stroke="currentColor" strokeWidth="1" opacity="0.06" />
      {/* Primary curve */}
      <path d="M 24 100 C 65 25, 115 105, 160 55 C 205 5, 240 80, 296 35"
            stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      {/* Control points */}
      <circle cx="24" cy="100" r="4" fill="currentColor" opacity="0.3" />
      <circle cx="100" cy="78" r="6" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="none" />
      <circle cx="100" cy="78" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="160" cy="55" r="4" fill="currentColor" opacity="0.3" />
      <circle cx="230" cy="58" r="6" stroke="currentColor" strokeWidth="1" opacity="0.2" fill="none" />
      <circle cx="230" cy="58" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="296" cy="35" r="4" fill="currentColor" opacity="0.3" />
      {/* Slider tracks */}
      <line x1="24" y1="156" x2="296" y2="156" stroke="currentColor" opacity="0.08" />
      <circle cx="180" cy="156" r="5" stroke="currentColor" strokeWidth="1" opacity="0.15" fill="none" />
      <circle cx="180" cy="156" r="2" fill="currentColor" opacity="0.2" />
      <line x1="24" y1="172" x2="296" y2="172" stroke="currentColor" opacity="0.08" />
      <circle cx="110" cy="172" r="5" stroke="currentColor" strokeWidth="1" opacity="0.15" fill="none" />
      <circle cx="110" cy="172" r="2" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function PredictIllustration() {
  return (
    <svg viewBox="0 0 260 100" fill="none" aria-hidden="true">
      {/* Input box */}
      <rect x="8" y="20" width="56" height="32" rx="4" stroke="currentColor" opacity="0.12" />
      <text x="36" y="40" textAnchor="middle" fill="currentColor" opacity="0.2" fontSize="11" fontFamily="monospace">f(3)</text>
      {/* Arrow */}
      <line x1="72" y1="36" x2="88" y2="36" stroke="currentColor" opacity="0.1" />
      <path d="M 88 32 L 96 36 L 88 40" stroke="currentColor" opacity="0.1" fill="none" />
      {/* Hidden step */}
      <rect x="104" y="16" width="60" height="40" rx="4" stroke="currentColor" opacity="0.2" strokeDasharray="4 3" />
      <text x="134" y="42" textAnchor="middle" fill="currentColor" opacity="0.3" fontSize="18" fontFamily="serif">?</text>
      {/* Arrow */}
      <line x1="172" y1="36" x2="188" y2="36" stroke="currentColor" opacity="0.1" />
      <path d="M 188 32 L 196 36 L 188 40" stroke="currentColor" opacity="0.1" fill="none" />
      {/* Verify box */}
      <rect x="204" y="20" width="48" height="32" rx="4" stroke="currentColor" opacity="0.12" />
      <path d="M 220 36 L 228 44 L 244 28" stroke="currentColor" opacity="0.2" strokeWidth="1.5" fill="none" />
      {/* Labels */}
      <text x="36" y="72" textAnchor="middle" fill="currentColor" opacity="0.1" fontSize="7" fontFamily="monospace" letterSpacing="0.1em">INPUT</text>
      <text x="134" y="72" textAnchor="middle" fill="currentColor" opacity="0.1" fontSize="7" fontFamily="monospace" letterSpacing="0.1em">PREDICT</text>
      <text x="228" y="72" textAnchor="middle" fill="currentColor" opacity="0.1" fontSize="7" fontFamily="monospace" letterSpacing="0.1em">VERIFY</text>
    </svg>
  );
}

function AttackIllustration() {
  return (
    <svg viewBox="0 0 260 100" fill="none" aria-hidden="true">
      {/* Valid nodes */}
      <circle cx="28" cy="40" r="12" stroke="currentColor" opacity="0.12" />
      <circle cx="28" cy="40" r="3" fill="currentColor" opacity="0.15" />
      <line x1="40" y1="40" x2="64" y2="40" stroke="currentColor" opacity="0.08" />
      <circle cx="76" cy="40" r="12" stroke="currentColor" opacity="0.12" />
      <circle cx="76" cy="40" r="3" fill="currentColor" opacity="0.15" />
      <line x1="88" y1="40" x2="112" y2="40" stroke="currentColor" opacity="0.08" />
      {/* Broken node */}
      <circle cx="130" cy="40" r="14" stroke="currentColor" opacity="0.3" strokeDasharray="3 2" />
      <line x1="122" y1="32" x2="138" y2="48" stroke="currentColor" opacity="0.25" strokeWidth="1.5" />
      <line x1="138" y1="32" x2="122" y2="48" stroke="currentColor" opacity="0.25" strokeWidth="1.5" />
      {/* Broken downstream */}
      <line x1="146" y1="40" x2="170" y2="40" stroke="currentColor" opacity="0.05" strokeDasharray="4 3" />
      <circle cx="184" cy="40" r="12" stroke="currentColor" opacity="0.06" />
      <circle cx="184" cy="40" r="3" fill="currentColor" opacity="0.05" />
      <line x1="196" y1="40" x2="220" y2="40" stroke="currentColor" opacity="0.04" strokeDasharray="4 3" />
      <circle cx="232" cy="40" r="12" stroke="currentColor" opacity="0.04" />
      <circle cx="232" cy="40" r="3" fill="currentColor" opacity="0.04" />
      {/* Label */}
      <text x="130" y="76" textAnchor="middle" fill="currentColor" opacity="0.1" fontSize="7" fontFamily="monospace" letterSpacing="0.1em">SOUNDNESS BREAK</text>
    </svg>
  );
}

/* ── Lazy-mount hook ── */

function useInView(rootMargin = "200px") {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return [ref, visible] as const;
}

/* ── Carousel card ── */

function CarouselCard({
  demoId,
  origin,
  mounted,
}: {
  demoId: DemoId;
  origin: string;
  mounted: boolean;
}) {
  const demo = DEMOS.find((d) => d.id === demoId)!;
  return (
    <a href={`/app#${demo.id}`} className="lp-carousel-card">
      {mounted ? (
        <div className="lp-carousel-card-viewport">
          <iframe
            src={`${origin}/app?embed=${demo.id}`}
            title={`${demo.title} preview`}
            loading="lazy"
            tabIndex={-1}
          />
        </div>
      ) : (
        <div className="lp-carousel-card-skeleton" />
      )}
      <div className="lp-carousel-card-info">
        <span className="lp-carousel-card-category">/{demo.id}</span>
        <span className="lp-carousel-card-name">{demo.title}</span>
        <span className="lp-carousel-card-desc">{demo.subtitle}</span>
      </div>
    </a>
  );
}

/* ── Landing page ── */

export function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const scrollY = useScrollY();
  const navScrolled = scrollY > 40;
  const publicGroups = DEMO_GROUPS.filter(g => g.title !== 'Privacy Primitives');
  const proofSystems = useMemo(() => publicGroups.find(g => g.title === 'Proof Systems'), [publicGroups]);
  const commitmentSchemes = useMemo(() => publicGroups.find(g => g.title === 'Commitment Schemes'), [publicGroups]);
  const protocolPrimitives = useMemo(() => publicGroups.find(g => g.title === 'Protocol Primitives'), [publicGroups]);

  const appHref = "/app";
  const origin = typeof window !== 'undefined' ? window.location.origin : "https://www.theora.dev";
  const shareOrigin = "https://www.theora.dev";
  const embedSnippet = `<iframe src="${shareOrigin}/app?embed=merkle" width="960" height="540" style="border:0"></iframe>`;

  const teaserFrameRef = useRef<HTMLDivElement>(null);
  const handleTeaserLoad = useCallback(() => {
    teaserFrameRef.current?.classList.add("is-loaded");
  }, []);

  // Carousel state
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselSectionRef, carouselVisible] = useInView("200px");
  const scrollCarousel = useCallback((direction: number) => {
    carouselRef.current?.scrollBy({ left: direction * 340, behavior: "smooth" });
  }, []);

  // Split panel state
  const [selectedCommitment, setSelectedCommitment] = useState<DemoId>("polynomial");
  const [splitSectionRef, splitVisible] = useInView("200px");

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
              className="lp-nav-link lp-nav-link--desktop"
            >
              Research
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-nav-link lp-nav-link--desktop"
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
              onClick={() => { trackLandingCta('launch_app_nav'); navigate(appHref); }}
              className="lp-btn-primary"
            >
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <HeroAnimation />

        <div
          className="lp-hero-overlay lp-grid-bg"
          style={{ zIndex: 1 }}
        />

        <div
          className="lp-hero-overlay"
          style={{
            zIndex: 2,
            background:
              "radial-gradient(ellipse 90% 60% at 50% 100%, var(--bg-primary) 0%, transparent 60%)",
          }}
        />

        <div className="lp-ticker" style={{ zIndex: 10 }}>
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
          className="lp-shell lp-hero-split"
          style={{ zIndex: 10 }}
        >
          <div className="lp-hero-copy">
            <div className="lp-hero-spacer">
              <span className="lp-mono-label">
                ∴ UNDERSTAND ZK, NOT JUST READ ABOUT IT
              </span>
            </div>

            <h1 className="lp-hero-title lp-hero-spacer">
              Cryptography,
              <br />
              <span className="lp-hero-title-sub">made visible.</span>
            </h1>

            <p className="lp-hero-sub">
              Interactive demos. Multiple modes of interaction. Upload a
              paper, get interactive diagrams. Build real intuition for
              cryptographic primitives by breaking things
              and watching math happen.
            </p>

            <div className="lp-hero-ctas">
              <button
                onClick={() => { trackLandingCta('explore_demos'); navigate("/app#pipeline"); }}
                className="lp-btn-primary lp-btn-lg"
              >
                Explore Demos →
              </button>
              <a
                href="/research"
                className="lp-btn-ghost lp-btn-lg"
                onClick={() => trackLandingCta('explore_paper')}
              >
                Explore a paper →
              </a>
            </div>
          </div>

          <div className="lp-hero-teaser">
            <div className="lp-teaser-frame" ref={teaserFrameRef}>
              <div className="lp-teaser-bar">
                <span className="lp-teaser-dot" />
                <span className="lp-teaser-dot" />
                <span className="lp-teaser-dot" />
                <span className="lp-teaser-label">
                  Live Preview — Recursive Proofs
                </span>
              </div>
              <div className="lp-teaser-shimmer" />
              <iframe
                src={`${origin}/app?embed=recursive&r=eyJtb2RlIjoidHJlZSIsImRlcHRoIjo0LCJzaG93UGFzdGEiOnRydWUsInNob3dQcm9vZlNpemUiOnRydWV9`}
                title="theora demo preview"
                className="lp-teaser-iframe"
                loading="lazy"
                onLoad={handleTeaserLoad}
              />
            </div>
            <p className="lp-teaser-caption">
              Every demo state is a shareable URL.
            </p>
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <main>
        {/* Demo Gallery */}
        <section id="demo-gallery" className="lp-section">
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
          </div>

          <div className="lp-gallery-sections">
            {/* ── Proof Systems — flat cards (unchanged) ── */}
            {proofSystems && (
              <div className="lp-shell">
                <section className="lp-demo-group">
                  <div className="lp-demo-group-head">
                    <div>
                      <p className="lp-overline">{proofSystems.title}</p>
                      <h3 className="lp-group-title">{proofSystems.description}</h3>
                    </div>
                  </div>
                  <div
                    className="lp-demo-grid"
                    style={{ "--col-count": 3 } as React.CSSProperties}
                  >
                    {proofSystems.demos.map((demoId) => {
                      const demo = DEMO_BY_ID[demoId];
                      return (
                        <a
                          key={demo.id}
                          href={`/app#${demo.id}`}
                          className="lp-demo-card lp-demo-card--compact"
                        >
                          <div className="lp-demo-card-content">
                            <div className="lp-demo-card-top">
                              <span className="lp-demo-route">/{demo.id}</span>
                              <span className="lp-demo-open">open →</span>
                            </div>
                            <div className="lp-demo-card-title">
                              <DemoIcon id={demo.id} size={16} color={demo.accent} />
                              <h4>{demo.title}</h4>
                            </div>
                            <p className="lp-demo-card-body">{demo.subtitle}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* ── Commitment Schemes — split panel ── */}
            {commitmentSchemes && (
              <div className="lp-shell" ref={splitSectionRef}>
                <section className="lp-demo-group">
                  <div className="lp-demo-group-head">
                    <div>
                      <p className="lp-overline">{commitmentSchemes.title}</p>
                      <h3 className="lp-group-title">
                        Commit to values, not screenshots.
                      </h3>
                    </div>
                  </div>
                  <div className="lp-split-layout">
                    <div className="lp-split-list">
                      {commitmentSchemes.demos.map((demoId) => {
                        const demo = DEMO_BY_ID[demoId];
                        return (
                          <button
                            key={demo.id}
                            type="button"
                            className={`lp-split-list-item${selectedCommitment === demo.id ? " is-active" : ""}`}
                            onClick={() => setSelectedCommitment(demo.id)}
                          >
                            <span className="lp-split-icon">
                              <DemoIcon id={demo.id} size={16} color={demo.accent} />
                            </span>
                            <span>
                              <span className="lp-split-item-name">{demo.title}</span>
                              <span className="lp-split-item-desc">{demo.subtitle}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="lp-split-preview">
                      {splitVisible ? (
                        <iframe
                          key={selectedCommitment}
                          src={`${origin}/app?embed=${selectedCommitment}`}
                          title={`${DEMO_BY_ID[selectedCommitment].title} preview`}
                          loading="lazy"
                          tabIndex={-1}
                        />
                      ) : (
                        <div className="lp-split-preview-skeleton" />
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ── Protocol Primitives — carousel ── */}
            {protocolPrimitives && (
              <div className="lp-carousel-section" ref={carouselSectionRef}>
                <div className="lp-shell">
                  <div className="lp-carousel-header">
                    <div>
                      <p className="lp-overline">{protocolPrimitives.title}</p>
                      <h3 className="lp-group-title">
                        Interact with the math, live.
                      </h3>
                    </div>
                    <p className="lp-carousel-subtitle">
                      Each primitive below is a running instance, not a screenshot.
                    </p>
                  </div>
                </div>
                <div className="lp-carousel-wrap">
                  <div className="lp-carousel-fade lp-carousel-fade--left" />
                  <div className="lp-carousel-fade lp-carousel-fade--right" />
                  <div className="lp-carousel-track" ref={carouselRef}>
                    {protocolPrimitives.demos.map((demoId) => (
                      <CarouselCard
                        key={demoId}
                        demoId={demoId}
                        origin={origin}
                        mounted={carouselVisible}
                      />
                    ))}
                  </div>
                </div>
                <div className="lp-shell lp-carousel-controls">
                  <button
                    type="button"
                    className="lp-carousel-arrow"
                    aria-label="Scroll left"
                    onClick={() => scrollCarousel(-1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="lp-carousel-arrow"
                    aria-label="Scroll right"
                    onClick={() => scrollCarousel(1)}
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Why theora — statement */}
        <div className="lp-statement">
          <div className="lp-shell">
            <p className="lp-statement-text">
              Reading a proof and understanding it are different things.
              Understanding starts when you break one — corrupt a witness,
              forge a transcript, trace where soundness fails. theora makes
              every primitive something you operate, not something you read.
            </p>
          </div>
        </div>

        {/* How You Interact — Modes */}
        <section className="lp-section">
          <div className="lp-shell">
            <div className="lp-section-head lp-section-head--stack">
              <p className="lp-overline">How you interact</p>
              <h2 className="lp-section-title">
                Three ways to learn the same primitive.
              </h2>
            </div>

            <div className="lp-mode-bento">
              <a href="/app#pipeline" className="lp-mode-card">
                <span className="lp-audience-tag">Explore</span>
                <h3 className="lp-audience-title">Full control</h3>
                <p className="lp-audience-body">
                  Drag sliders, inject faults, break things, watch math happen.
                  Every parameter is exposed. Every state is shareable.
                </p>
                <div className="lp-mode-card-visual">
                  <ExploreIllustration />
                </div>
              </a>
              <a href="/app?mode=predict#pipeline" className="lp-mode-card">
                <span className="lp-audience-tag">Predict</span>
                <h3 className="lp-audience-title">Test your intuition</h3>
                <p className="lp-audience-body">
                  Guess what happens next, then watch the math play out.
                  Randomized parameters mean you can't memorize — you have to
                  understand.
                </p>
                <div className="lp-mode-card-visual">
                  <PredictIllustration />
                </div>
              </a>
              <a href="/app?mode=attack#fiat-shamir" className="lp-mode-card">
                <span className="lp-audience-tag">Attack</span>
                <h3 className="lp-audience-title">Think like an adversary</h3>
                <p className="lp-audience-body">
                  Forge proofs, exploit missing constraints, break Fiat-Shamir
                  transcripts. Guided scenarios across multiple demos.
                </p>
                <div className="lp-mode-card-visual">
                  <AttackIllustration />
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Research Callout */}
        <section className="lp-section">
          <div className="lp-shell">
            <div className="lp-callout">
              <p className="lp-overline">Research workspace</p>
              <h2 className="lp-callout-title">
                Upload a paper, get interactive diagrams.
              </h2>
              <p className="lp-callout-body">
                Upload a cryptography paper and get an interactive walkthrough
                with live demos mapped to each section. 5 curated walkthroughs
                included.
              </p>
              <div className="lp-callout-cta">
                <a href="/research" className="lp-btn-primary lp-btn-lg" onClick={() => trackLandingCta('research_workspace')}>
                  Open Research Workspace →
                </a>
              </div>
              <p className="lp-callout-footnote">
                Coming next: Audit Notebook · Composition Playground
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

            <div className="lp-audience-grid-4">
              <div className="lp-mode-card">
                <span className="lp-audience-tag">Build</span>
                <h3 className="lp-audience-title">ZK Engineers</h3>
                <p className="lp-audience-body">
                  Debug circuits visually, trace constraint failures, find
                  underconstrained wires before auditors do.
                </p>
              </div>
              <div className="lp-mode-card">
                <span className="lp-audience-tag">Audit</span>
                <h3 className="lp-audience-title">Security Auditors</h3>
                <p className="lp-audience-body">
                  Inject faults, play the adversary, see exactly where soundness
                  breaks in 5 guided attack scenarios.
                </p>
              </div>
              <div className="lp-mode-card">
                <span className="lp-audience-tag">Research</span>
                <h3 className="lp-audience-title">Researchers</h3>
                <p className="lp-audience-body">
                  Upload papers and get interactive diagrams. Compare
                  constructions side-by-side. Cite shareable demo states.
                </p>
              </div>
              <div className="lp-mode-card">
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
                Every state is a URL.
              </h2>
              <p className="lp-section-copy">
                Embed demos in docs, posts, or slides. Strip the UI, keep the
                demo. Share a living demo, not a frozen image.
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
          </div>
          <p className="lp-footer-legal">MIT License · By <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>LucidSamuel</a></p>
        </div>
      </footer>
    </div>
  );
}
