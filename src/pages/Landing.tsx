import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { HeroAnimation } from '@/components/landing/HeroAnimation';

const DEMO_DATA = [
  {
    id: 'merkle',
    num: '01',
    title: 'Merkle Tree',
    tag: 'HASH TREES · MEMBERSHIP PROOFS',
    body: 'Build a binary hash tree from arbitrary data. Generate inclusion proofs, step through verification one hash at a time, and watch the exact path of changed hashes cascade to the root.',
    features: [
      'SHA-256 and FNV-1a hash functions',
      'Step-through proof verification',
      'Spring-physics canvas animation',
      'Proof export as JSON or audit summary',
    ],
  },
  {
    id: 'polynomial',
    num: '02',
    title: 'KZG Commitments',
    tag: 'POLYNOMIAL EVALUATION · ELLIPTIC CURVES',
    body: 'Commit to a polynomial, pick a challenge point, reveal a value, and verify the full 4-step KZG flow animated. Drag coefficients to reshape the curve in real time.',
    features: [
      'Lagrange interpolation by clicking the canvas',
      'Polynomial comparison via Schwartz-Zippel',
      'KZG commit → challenge → prove → verify',
      'Synthetic division for quotient polynomial',
    ],
  },
  {
    id: 'accumulator',
    num: '03',
    title: 'RSA Accumulator',
    tag: 'SET MEMBERSHIP · MODULAR EXPONENTIATION',
    body: 'Add prime numbers to a cryptographic accumulator and prove membership or non-membership without revealing the entire set. Witness computation via extended GCD.',
    features: [
      'Membership and non-membership proofs',
      'Batch add with comma-separated primes',
      'Orbital visualization with spring physics',
      'Full operation history with before/after',
    ],
  },
  {
    id: 'recursive',
    num: '04',
    title: 'Recursive Proofs',
    tag: 'IVC · PASTA CURVES · PROOF COMPOSITION',
    body: 'Proof trees where each node verifies its children, built on Pallas/Vesta curve cycling. Inject a bad proof at any node and watch soundness failures propagate upward.',
    features: [
      'Binary proof tree (depth 2–5)',
      'IVC chain with fold-by-fold stepping',
      'Pasta curve cycle at each depth',
      'Constant-size proofs (~288 bytes regardless of depth)',
    ],
  },
  {
    id: 'split-accumulation',
    num: '05',
    title: 'Split Accumulation',
    tag: 'HALO RECURSION · MSM DEFERRAL · FOLDING',
    body: 'Compare naive recursion against Halo-style accumulation side by side. Step through recursive claims, watch the accumulator absorb each fold, and see a single final MSM settle the whole chain.',
    features: [
      'Naive vs accumulated verifier panels',
      'Step-by-step fold progression with autoplay',
      'Live cost ratio and deferred-work tracking',
      'Final settlement MSM highlight',
    ],
  },
  {
    id: 'rerandomization',
    num: '06',
    title: 'Proof Rerandomization',
    tag: 'UNLINKABILITY · BLINDING · BYTE-LEVEL TRANSCRIPTS',
    body: 'Watch an original proof and its rerandomized twin side by side. Every byte changes, yet the verifier still accepts the same statement. Then try to match shuffled rerandomized proofs back to their originals.',
    features: [
      'Byte-level proof component comparison',
      'Repeated rerandomization of one statement',
      'Live changed-byte counter',
      'Matching game for unlinkability intuition',
    ],
  },
  {
    id: 'oblivious-sync',
    num: '07',
    title: 'Oblivious Sync',
    tag: 'WALLET PRIVACY · BLINDED NULLIFIERS · DISJOINTNESS PROOFS',
    body: 'Step through a wallet syncing against a remote spent-note service. The wallet blinds its nullifiers, the service proves disjointness, and both sides learn only the minimum necessary to complete sync.',
    features: [
      'Five protocol rounds with stepping',
      'Wallet vs service knowledge tracking',
      'Injectable spent-note collision',
      'Blinded nullifier transcript view',
    ],
  },
  {
    id: 'elliptic',
    num: '08',
    title: 'Elliptic Curves',
    tag: 'POINT ADDITION · DOUBLE-AND-ADD · PASTA CYCLE',
    body: 'Plot discrete curve points over a finite field, pick two points to add, and step through scalar multiplication. The side panel bridges from toy arithmetic to the Pallas/Vesta cycle used in modern proof systems.',
    features: [
      'Finite-field point enumeration',
      'Point addition and point doubling',
      'Double-and-add scalar trace',
      'Pasta cycle summary for recursion intuition',
    ],
  },
  {
    id: 'fiat-shamir',
    num: '09',
    title: 'Fiat-Shamir',
    tag: 'TRANSCRIPTS · CHALLENGES · FORGERIES',
    body: 'Compare a live interactive proof against correct and broken Fiat-Shamir transcript hashing. Watch challenge derivation change, then see a forged proof succeed only when the commitment is omitted from the hash.',
    features: [
      'Interactive vs hashed challenges',
      'Correct vs broken transcript mode',
      'Predictable-challenge forgery demo',
      'Stepwise transcript visualization',
    ],
  },
  {
    id: 'circuit',
    num: '10',
    title: 'R1CS Circuits',
    tag: 'ARITHMETIC GATES · WITNESSES · UNDERCONSTRAINTS',
    body: 'Inspect a small arithmetic circuit for x² + y = z, compare the witness against the active constraints, and toggle a broken version where the output relation silently disappears.',
    features: [
      'Witness sliders for x, y, z',
      'Constraint satisfaction panel',
      'Exploit witness in broken mode',
      'R1CS row preview for each relation',
    ],
  },
  {
    id: 'lookup',
    num: '11',
    title: 'Lookup Arguments',
    tag: 'TABLES · MULTISETS · PERMUTATION CHECKS',
    body: 'Edit a lookup table and queried wire values, then compare the sorted multisets to see when a lookup passes, when values are missing, and when multiplicities overflow the table.',
    features: [
      'Editable table and wire lists',
      'Sorted multiset comparison',
      'Missing-value detection',
      'Multiplicity clash detection',
    ],
  },
  {
    id: 'pedersen',
    num: '12',
    title: 'Pedersen Commitments',
    tag: 'HIDING · BINDING · HOMOMORPHIC ADDITION',
    body: 'Compute C = g^v · h^r mod p over a small prime field. Toggle the blinding factor, then verify that the product of two commitments equals a direct commitment to their sum.',
    features: [
      'Single commitment with blinding toggle',
      'Homomorphic addition verification',
      'Flow-diagram canvas visualization',
      'Small field (p=97) for full inspection',
    ],
  },
  {
    id: 'constraint-counter',
    num: '13',
    title: 'Pedersen vs Poseidon',
    tag: 'MERKLE COSTS · R1CS · BOOTLE16',
    body: 'Quantify why Poseidon replaced Pedersen for Merkle-heavy zk circuits. Compare one hash, a full authentication path, and even a whole tree build under both R1CS and Bootle16 cost models.',
    features: [
      'Per-hash Pedersen vs Poseidon counts',
      'Depth-adjustable Merkle path comparison',
      'Full-tree amplification with large counts',
      'R1CS and Bootle16 side by side',
    ],
  },
  {
    id: 'groth16',
    num: '14',
    title: 'Groth16 zkSNARK',
    tag: 'R1CS · QAP · PAIRING VERIFICATION',
    body: 'Walk through the full Groth16 pipeline: R1CS encoding, QAP conversion, trusted setup, proof generation, and pairing-based verification for f(x) = x² + x + 5 over GF(101).',
    features: [
      '5-phase pipeline with auto-run',
      'Trusted setup with toxic waste toggle',
      'Fault injection on A, B, or C proof elements',
      'Simulated pairing check with LHS/RHS display',
    ],
  },
  {
    id: 'plonk',
    num: '15',
    title: 'PLONK Arithmetization',
    tag: 'GATE EQUATIONS · COPY CONSTRAINTS · SELECTORS',
    body: 'Explore PLONK gate equations and copy constraints with a 3-gate arithmetic circuit. Edit wire values, break a copy constraint, and see exactly which equations fail.',
    features: [
      'Per-gate selector and wire display',
      'Copy constraint bezier arrows',
      'One-click constraint breaking',
      'Gate satisfaction status per equation',
    ],
  },
  {
    id: 'pipeline',
    num: '16',
    title: 'Proof Pipeline',
    tag: 'END-TO-END · FAULT INJECTION · LINKED STATE',
    body: 'End-to-end walkthrough from witness to verification: R1CS encoding, Lagrange interpolation, simulated KZG, Fiat-Shamir challenge. Inject faults and watch corruption propagate through the pipeline.',
    features: [
      '7-stage proof system flow',
      '4 attack modes with fault propagation',
      'Cross-demo linked state handoff',
      'Auto-play with speed control',
    ],
  },
];

const DEMO_COUNT_LABEL = String(DEMO_DATA.length).padStart(2, '0');

const TICKER_ITEMS = [
  'MERKLE TREES', 'KZG COMMITMENTS', 'RSA ACCUMULATORS', 'RECURSIVE PROOFS',
  'SPLIT ACCUMULATION', 'PROOF RERANDOMIZATION', 'OBLIVIOUS SYNC', 'ELLIPTIC CURVES', 'FIAT-SHAMIR', 'R1CS', 'LOOKUP ARGUMENTS',
  'PEDERSEN COMMITMENTS', 'POSEIDON HASHING', 'GROTH16', 'PLONK', 'PROOF PIPELINE',
  'HALO RECURSION', 'MSM DEFERRAL', 'PASTA CURVES', 'IVC CHAINS', 'PROOF COMPOSITION', 'ZERO KNOWLEDGE',
  'SPRING PHYSICS', 'SHAREABLE STATE', 'STEP-THROUGH VERIFICATION', 'CANVAS RENDERING',
];

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const fn = () => setY(window.scrollY);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return y;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const scrollY = useScrollY();
  const navScrolled = scrollY > 40;
  const aboutRef = useInView(0.05);
  const demosRef = useInView(0.02);
  const featuresRef = useInView(0.05);

  return (
    <div className="lp min-h-screen w-full overflow-x-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── NAV ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          borderBottom: navScrolled ? '1px solid var(--border)' : '1px solid transparent',
          background: navScrolled ? 'color-mix(in srgb, var(--bg-primary) 90%, transparent)' : 'transparent',
          backdropFilter: navScrolled ? 'blur(20px)' : 'none',
          transition: 'border-color 300ms, background 300ms, backdrop-filter 300ms',
        }}
      >
        <div className="lp-container h-16 flex items-center justify-between">
          <span className="lp-wordmark">
            <span className="lp-wordmark-sym">∴</span> theora
          </span>
          <div className="flex items-center gap-3">
            <a href="https://github.com/LucidSamuel/theora" target="_blank" rel="noopener noreferrer"
              className="lp-nav-link hidden sm:flex">
              GitHub ↗
            </a>
            <button onClick={toggle} className="lp-icon-btn" aria-label="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button onClick={() => navigate('/app')} className="lp-btn-primary">
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero relative overflow-hidden">
        <HeroAnimation />

        {/* Grid overlay */}
        <div className="absolute inset-0 lp-grid-bg pointer-events-none" style={{ zIndex: 1 }} />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse 90% 60% at 50% 100%, var(--bg-primary) 0%, transparent 60%)',
        }} />

        {/* Ticker pinned to bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 lp-ticker" style={{ zIndex: 10 }}>
          <div className="lp-ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="lp-ticker-item">
                {item}
                <span className="lp-ticker-dot">·</span>
              </span>
            ))}
          </div>
        </div>

        <div className="lp-container relative flex flex-col justify-center h-full py-16 sm:py-20 pb-24 sm:pb-28" style={{ zIndex: 10 }}>

          {/* Top label row */}
          <div className="flex items-center justify-between mb-8 sm:mb-10">
            <span className="lp-mono-label">∴ cryptographic primitive visualizer</span>
            <span className="lp-mono-label hidden sm:block">EST. 2025 · MIT LICENSE</span>
          </div>

          {/* Full-width heading */}
          <h1 className="lp-hero-title mb-8 sm:mb-10">
            Cryptography,<br />
            <span className="lp-hero-title-dim">made</span>{' '}
            <span className="lp-hero-title-accent">visible.</span>
          </h1>

          {/* Description + buttons row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-16">
            <p className="lp-hero-sub sm:max-w-[480px]">
              A unified visual lab for Merkle trees, KZG commitments, RSA accumulators, recursive proofs, elliptic curves, transcript hashing, circuit constraints, and lookup arguments.
            </p>
            <div className="flex flex-wrap gap-3 flex-shrink-0">
              <button onClick={() => navigate('/app')} className="lp-btn-primary lp-btn-lg">
                Explore Demos →
              </button>
              <a href="https://github.com/LucidSamuel/theora" target="_blank" rel="noopener noreferrer"
                className="lp-btn-ghost lp-btn-lg no-underline">
                Source ↗
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="lp-stats-row mt-8">
            {[
              [DEMO_COUNT_LABEL, 'Interactive Demos'],
              ['∞', 'Shareable States'],
              ['0', 'Dependencies'],
              ['60', 'FPS Canvas'],
            ].map(([v, l]) => (
              <div key={l} className="lp-stat">
                <span className="lp-stat-val">{v}</span>
                <span className="lp-stat-label">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT STRIP ── */}
      <div
        ref={aboutRef.ref}
        className={`lp-section-reveal ${aboutRef.inView ? 'is-visible' : ''}`}
      >
        <div className="lp-container py-20 sm:py-28">
          <div className="lp-about-grid">
            <div>
              <p className="lp-section-num">§ 00</p>
              <h2 className="lp-section-heading mt-4">
                The ZK visualization<br />
                <span className="lp-dim">landscape is thin.</span>
              </h2>
            </div>
            <div className="lp-about-body">
              <p className="mt-4">Theora is a unified, interactive, animated tool that lets you poke at the actual cryptographic primitives and build intuition before you write a line of code.</p>
              <div className="lp-audience-grid mt-8">
                {['Engineers building ZK systems', 'Cryptographers & researchers', 'Security auditors', 'Educators & DevRel'].map((a) => (
                  <div key={a} className="lp-audience-item">
                    <span className="lp-audience-dot" />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DEMOS ── */}
      <div
        ref={demosRef.ref}
        className={`lp-section-reveal ${demosRef.inView ? 'is-visible' : ''}`}
      >
        <div className="lp-container">
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
            <p className="lp-section-num">{`§ 01 – ${DEMO_COUNT_LABEL} · DEMO SUITE`}</p>
          </div>

          {DEMO_DATA.map((demo, i) => (
            <button
              key={demo.id}
              onClick={() => navigate(`/app#${demo.id}`)}
              className="lp-demo-row"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="lp-demo-left">
                <span className="lp-demo-num">{demo.num}</span>
                <h3 className="lp-demo-title">{demo.title}</h3>
                <span className="lp-demo-tag">{demo.tag}</span>
              </div>

              <div className="lp-demo-right">
                <p className="lp-demo-body">{demo.body}</p>
                <ul className="lp-demo-features">
                  {demo.features.map((f, j) => (
                    <li key={j} className="lp-demo-feature-item">
                      <span className="lp-demo-feature-num">{String(j + 1).padStart(2, '0')}</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lp-demo-cta">
                <span className="lp-demo-arrow">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div
        ref={featuresRef.ref}
        className={`lp-section-reveal ${featuresRef.inView ? 'is-visible' : ''}`}
      >
        <div className="lp-container py-20 sm:py-28">
          <div style={{ borderTop: '1px solid var(--border)', paddingBottom: '3rem', paddingTop: '2rem' }}>
            <p className="lp-section-num">§ 05 · PLATFORM</p>
            <h2 className="lp-section-heading mt-4">
              Tooling, not a showcase.
            </h2>
          </div>

          <div className="lp-features-grid">
            {[
              {
                num: '01',
                title: 'State sharing & embedding',
                body: 'Every demo serializes into the URL. Share a link, embed an iframe in docs, Notion and the recipient sees exactly what you see.',
              },
              {
                num: '02',
                title: 'Step-through verification',
                body: 'Walk proof logic incrementally. Watch hashes, witnesses, and evaluations evolve at each verification stage.',
              },
              {
                num: '03',
                title: 'High-fidelity canvas rendering',
                body: 'All diagrams on HTML5 canvas. Spring-physics node positioning, 60fps animation, HiDPI scaling, zero SVG or charting libraries.',
              },
              {
                num: '04',
                title: 'Dark & light themes',
                body: 'System-aware with localStorage persistence. Every element responds via CSS custom properties, no dark: class overrides.',
              },
              {
                num: '05',
                title: 'Fault injection',
                body: 'Inject bad proofs, wrong witnesses, and invalid inputs to watch verification fail in real time and trace the exact failure path.',
              },
              {
                num: '06',
                title: 'Composable architecture',
                body: 'Clean logic + renderer + React pattern across all demos. Adding a new primitive is a matter of implementing one interface.',
              },
            ].map((f) => (
              <div key={f.num} className="lp-feature-item">
                <span className="lp-feature-num">{f.num}</span>
                <h4 className="lp-feature-title">{f.title}</h4>
                <p className="lp-feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="lp-container pb-40 sm:pb-56">
        <div className="lp-cta-block">
          <div className="lp-cta-inner">
            <p className="lp-mono-label mb-5">§ 06 · START</p>
            <h2 className="lp-cta-title">
              Open the lab.<br />
              Test your intuition.
            </h2>
            <p className="lp-cta-sub">
              No installation. No account. No ceremony.<br />
              Manipulate real cryptographic primitives in your browser.
            </p>
            <div className="flex flex-wrap gap-3 mt-10">
              <button onClick={() => navigate('/app')} className="lp-btn-primary lp-btn-lg">
                Launch Theora →
              </button>
              <a href="https://github.com/LucidSamuel/theora" target="_blank" rel="noopener noreferrer"
                className="lp-btn-ghost lp-btn-lg no-underline">
                View Source ↗
              </a>
            </div>
          </div>
          <div className="lp-cta-mark" aria-hidden="true">∴</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="lp-container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="lp-mono-label">∴ theora — open source cryptography visual tooling · MIT</span>
          <div className="flex gap-6">
            <a href="https://github.com/LucidSamuel/theora" target="_blank" rel="noopener noreferrer"
              className="lp-footer-link no-underline">GitHub</a>
            <a href="https://x.com/lucidzk" target="_blank" rel="noopener noreferrer"
              className="lp-footer-link no-underline">@lucidzk</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
