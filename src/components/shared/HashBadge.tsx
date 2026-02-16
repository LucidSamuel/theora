import { useState, useCallback } from 'react';
import { copyToClipboard } from '@/lib/clipboard';

interface HashBadgeProps {
  hash: string;
  truncate?: number;
  color?: string;
  className?: string;
}

export function HashBadge({ hash, truncate = 8, color = 'var(--text-muted)', className = '' }: HashBadgeProps) {
  const [copied, setCopied] = useState(false);

  const display = hash.length > truncate ? `${hash.slice(0, truncate / 2)}...${hash.slice(-truncate / 2)}` : hash;

  const handleCopy = useCallback(() => {
    copyToClipboard(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [hash]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition-all cursor-pointer hover:opacity-80 ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color: color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
      title={`Click to copy: ${hash}`}
    >
      <span>{copied ? 'Copied!' : display}</span>
    </button>
  );
}
