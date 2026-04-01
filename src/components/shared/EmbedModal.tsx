import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedUrl: string;
  demoName: string;
}

export function EmbedModal({ isOpen, onClose, embedUrl, demoName }: EmbedModalProps) {
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('640');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="${width}"\n  height="${height}"\n  style="border:0;border-radius:16px;overflow:hidden;"\n  title="${demoName} — theora"\n  loading="lazy"\n  allow="clipboard-write"\n></iframe>`;

  const handleCopy = () => {
    copyToClipboard(iframeCode);
    setCopied(true);
    showToast('Embed code copied', 'Paste into any HTML page to embed this visualization');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreview = () => {
    window.open(embedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="github-import-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="github-import-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, 100%)', borderRadius: 16 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[14px] font-semibold font-display" style={{ color: 'var(--text-primary)' }}>
              Embed this demo
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Paste this iframe into any HTML page to embed a live, interactive version of {demoName}.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 8px',
              borderRadius: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Width</span>
            <input
              type="text"
              value={width}
              onChange={e => setWidth(e.target.value)}
              className="github-import-modal__input"
              style={{ marginTop: 0, height: 36, fontSize: 12, fontFamily: 'var(--font-mono)' }}
            />
          </label>
          <label className="flex flex-col gap-1" style={{ width: 90 }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Height (px)</span>
            <input
              type="text"
              value={height}
              onChange={e => setHeight(e.target.value)}
              className="github-import-modal__input"
              style={{ marginTop: 0, height: 36, fontSize: 12, fontFamily: 'var(--font-mono)' }}
            />
          </label>
        </div>

        <div
          className="rounded-xl mb-4 overflow-x-auto"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '14px 16px',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre',
              userSelect: 'all',
            }}
          >
            {iframeCode}
          </pre>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="app-btn-primary flex-1"
            style={{ height: 40, fontSize: 13 }}
          >
            {copied ? '✓ Copied!' : 'Copy code'}
          </button>
          <button
            onClick={handlePreview}
            className="app-btn-secondary"
            style={{ height: 40, fontSize: 13, padding: '0 16px' }}
          >
            Preview ↗
          </button>
        </div>

        <p className="text-[11px] mt-4" style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
          The embed URL encodes the current state — your exact tree, proof, or configuration is preserved.
          Viewers interact live but cannot modify the original.
        </p>
      </div>
    </div>
  );
}
