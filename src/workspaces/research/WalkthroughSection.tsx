import type { WalkthroughSection as SectionType } from './types';
import type { WalkthroughReference } from './types';
import { InlineDemo } from './InlineDemo';
import { formatInlineCode } from './formatText';

interface WalkthroughSectionProps {
  section: SectionType;
  index: number;
  references?: WalkthroughReference[];
}

export function WalkthroughSection({ section, index, references }: WalkthroughSectionProps) {
  const cited = section.citations?.length
    ? section.citations
        .map((id) => {
          const refIdx = references?.findIndex((r) => r.id === id) ?? -1;
          return refIdx >= 0 ? { idx: refIdx, ref: references![refIdx] } : null;
        })
        .filter(Boolean) as { idx: number; ref: WalkthroughReference }[]
    : null;

  return (
    <section
      id={`section-${section.id}`}
      style={{
        padding: '32px 0',
        borderTop: index > 0 ? '1px solid var(--border)' : undefined,
      }}
    >
      {/* Section ref */}
      {section.sectionRef && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 6,
            letterSpacing: '0.02em',
          }}
        >
          {section.sectionRef}
        </div>
      )}

      {/* Title */}
      <h3
        className="font-display"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 12px',
        }}
      >
        {index + 1}. {section.title}
      </h3>

      {/* Summary */}
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          margin: '0 0 12px',
        }}
      >
        {formatInlineCode(section.summary)}
      </p>

      {/* Key insight */}
      {section.keyInsight && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            borderLeft: '3px solid var(--text-muted)',
            background: 'var(--surface-element)',
            fontSize: 13,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            marginBottom: 16,
            fontStyle: 'italic',
          }}
        >
          {formatInlineCode(section.keyInsight)}
        </div>
      )}

      {/* Section citations */}
      {cited && cited.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          {cited.map(({ idx, ref }, i) => (
            <span key={ref.id}>
              {i > 0 && ', '}
              <a
                href={`#ref-${ref.id}`}
                style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                [{idx + 1}]
              </a>
            </span>
          ))}
        </div>
      )}

      {/* Interactive demo */}
      {section.demo && <InlineDemo demo={section.demo} />}
    </section>
  );
}
