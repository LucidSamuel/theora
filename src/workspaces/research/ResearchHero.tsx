interface ResearchHeroProps {
  onScrollToGallery: () => void;
  onScrollToUpload: () => void;
}

export function ResearchHero({ onScrollToGallery, onScrollToUpload }: ResearchHeroProps) {
  return (
    <section
      style={{
        padding: '80px 24px 64px',
        textAlign: 'center',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1
        className="font-display"
        style={{
          fontSize: 32,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 12px',
          letterSpacing: '-0.02em',
        }}
      >
        Research
      </h1>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-muted)',
          margin: '0 0 36px',
          lineHeight: 1.6,
        }}
      >
        Read papers. Interact with the math.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={onScrollToGallery} style={heroBtnPrimary}>
          Explore curated walkthroughs
        </button>
        <button onClick={onScrollToUpload} style={heroBtnSecondary}>
          Analyze a paper
        </button>
      </div>
    </section>
  );
}

const heroBtnBase: React.CSSProperties = {
  height: 42,
  padding: '0 24px',
  borderRadius: 10,
  fontSize: 14,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const heroBtnPrimary: React.CSSProperties = {
  ...heroBtnBase,
  background: 'var(--text-primary)',
  color: 'var(--bg-primary)',
};

const heroBtnSecondary: React.CSSProperties = {
  ...heroBtnBase,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
};
