import type { WalkthroughSection } from './types';

interface WalkthroughTOCProps {
  sections: WalkthroughSection[];
}

export function WalkthroughTOC({ sections }: WalkthroughTOCProps) {
  return (
    <nav
      style={{
        position: 'sticky',
        top: 80,
        alignSelf: 'start',
        minWidth: 200,
        maxWidth: 240,
        padding: '16px 0',
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Contents
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {sections.map((section, i) => (
          <li key={section.id} style={{ marginBottom: 6 }}>
            <a
              href={`#section-${section.id}`}
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                lineHeight: 1.4,
                display: 'block',
                padding: '3px 0',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              {i + 1}. {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
