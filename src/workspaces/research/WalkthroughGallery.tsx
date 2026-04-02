import type { Walkthrough } from './types';

interface WalkthroughGalleryProps {
  walkthroughs: Walkthrough[];
  onSelect: (id: string) => void;
}

export function WalkthroughGallery({ walkthroughs, onSelect }: WalkthroughGalleryProps) {
  return (
    <section className="lp-shell" style={{ paddingBottom: 64, maxWidth: 960 }}>
      <p className="lp-overline" style={{ marginBottom: 8 }}>Curated walkthroughs</p>
      <h2
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(20px, 3vw, 28px)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
        }}
      >
        Landmark papers, mapped to demos.
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--text-muted)',
          margin: '0 0 28px',
          lineHeight: 1.7,
        }}
      >
        Hand-written mappings of cryptography papers to interactive theora demos.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {walkthroughs.map((w) => (
          <WalkthroughCard key={w.id} walkthrough={w} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function WalkthroughCard({
  walkthrough,
  onSelect,
}: {
  walkthrough: Walkthrough;
  onSelect: (id: string) => void;
}) {
  const demoCount = walkthrough.sections.filter((s) => s.demo).length;

  return (
    <button
      onClick={() => onSelect(walkthrough.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        padding: '20px 18px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface-element)',
        cursor: 'pointer',
        transition: 'border-color 160ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--focus-ring)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          marginBottom: 4,
          lineHeight: 1.45,
        }}
      >
        {walkthrough.paper.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          marginBottom: 10,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {walkthrough.paper.authors} ({walkthrough.paper.year})
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
          marginBottom: 14,
          fontFamily: 'var(--font-mono)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {walkthrough.paper.abstractSummary}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={badgeStyle}>
          {walkthrough.sections.length} sections
        </span>
        <span style={badgeStyle}>
          {demoCount} demos
        </span>
      </div>
    </button>
  );
}

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
  padding: '3px 8px',
  borderRadius: 6,
  background: 'var(--bg-secondary)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};
