interface ResearchHeroProps {
  onScrollToGallery: () => void;
  onScrollToUpload: () => void;
}

export function ResearchHero({ onScrollToGallery, onScrollToUpload }: ResearchHeroProps) {
  return (
    <section className="lp-shell" style={{ padding: '80px 24px 64px', textAlign: 'center', maxWidth: 720 }}>
      <p className="lp-overline" style={{ marginBottom: 16 }}>Research workspace</p>
      <h1
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          margin: '0 0 16px',
        }}
      >
        Read papers. Interact with the math.
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 15,
          color: 'var(--text-secondary)',
          margin: '0 0 36px',
          lineHeight: 1.7,
          maxWidth: 520,
          marginInline: 'auto',
        }}
      >
        Upload a cryptography paper or explore curated walkthroughs with live interactive demos mapped to each section.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={onScrollToGallery} className="lp-btn-primary lp-btn-lg">
          Explore walkthroughs
        </button>
        <button type="button" onClick={onScrollToUpload} className="lp-btn-ghost lp-btn-lg">
          Analyze a paper
        </button>
      </div>
    </section>
  );
}
