import type { Walkthrough } from './types';

interface WalkthroughGalleryProps {
  walkthroughs: Walkthrough[];
  onSelect: (id: string) => void;
}

export function WalkthroughGallery({ walkthroughs, onSelect }: WalkthroughGalleryProps) {
  return (
    <section style={{ padding: '0 24px 64px', maxWidth: 960, margin: '0 auto' }}>
      <h2
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
        }}
      >
        Curated Walkthroughs
      </h2>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          margin: '0 0 28px',
          lineHeight: 1.5,
        }}
      >
        Hand-written mappings of landmark cryptography papers to interactive Theora demos.
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
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-element)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {walkthrough.paper.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          marginBottom: 10,
        }}
      >
        {walkthrough.paper.authors} ({walkthrough.paper.year})
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: 14,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {walkthrough.paper.abstractSummary}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            padding: '3px 8px',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {walkthrough.sections.length} sections
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            padding: '3px 8px',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {demoCount} demos
        </span>
      </div>
    </button>
  );
}
