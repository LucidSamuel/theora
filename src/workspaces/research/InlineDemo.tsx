import { useMemo } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { WalkthroughDemo } from './types';
import { buildWalkthroughDemoUrl } from './urls';
import { formatInlineCode } from './formatText';

interface InlineDemoProps {
  demo: WalkthroughDemo;
  height?: number;
}

export function InlineDemo({ demo, height = 500 }: InlineDemoProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  const openFullUrl = useMemo(() => buildWalkthroughDemoUrl(demo), [demo]);
  const embedUrl = useMemo(() => buildWalkthroughDemoUrl(demo, { embed: true }), [demo]);

  // On mobile, show a placeholder instead of the full interactive demo
  if (isMobile) {
    return (
      <div
        style={{
          padding: '32px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-element)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {demo.caption}
        </div>
        <a
          href={openFullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'inline-block',
          }}
        >
          Open full demo on desktop
        </a>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Demo embed container */}
      <div
        style={{
          height,
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--bg-primary)',
        }}
      >
        <iframe
          title={`${demo.demoId} interactive demo`}
          src={embedUrl}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: 'var(--bg-primary)',
          }}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {/* Caption */}
      {demo.caption && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '10px 0 0',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          {formatInlineCode(demo.caption)}
        </p>
      )}

      {/* Interaction hints */}
      {demo.interactionHints.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
          >
            Interaction hints
          </summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {demo.interactionHints.map((hint, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                {formatInlineCode(hint)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Open full demo link */}
      <div style={{ marginTop: 10 }}>
        <a
          href={openFullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Open full demo →
        </a>
      </div>
    </div>
  );
}
