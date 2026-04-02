import { type ReactNode } from 'react';

/**
 * Parses a plain-text string with backtick-delimited inline code spans
 * and returns React elements with `<code>` styling.
 *
 * Example: "The polynomial `f(x) = x² + x + 5` encodes..."
 *   → ["The polynomial ", <code>f(x) = x² + x + 5</code>, " encodes..."]
 *
 * Works in any walkthrough summary, keyInsight, caption, or hint text.
 */
export function formatInlineCode(text: string): ReactNode {
  if (!text.includes('`')) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const open = text.indexOf('`', cursor);
    if (open === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    const close = text.indexOf('`', open + 1);
    if (close === -1) {
      parts.push(text.slice(cursor));
      break;
    }

    if (open > cursor) {
      parts.push(text.slice(cursor, open));
    }
    parts.push(
      <code
        key={key++}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9em',
          padding: '1px 5px',
          borderRadius: 4,
          background: 'var(--surface-element)',
          border: '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}
      >
        {text.slice(open + 1, close)}
      </code>,
    );
    cursor = close + 1;
  }

  return <>{parts}</>;
}
