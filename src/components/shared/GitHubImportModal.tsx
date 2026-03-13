import { useMemo, useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import type { DemoId } from '@/types';
import { applyImportedState, fetchTheoraImport, getCurrentExportEnvelope, serializeTheoraImport } from '@/lib/githubImport';

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDemo: DemoId;
}

export function GitHubImportModal({ isOpen, onClose, activeDemo }: GitHubImportModalProps) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const exportEnvelope = useMemo(() => getCurrentExportEnvelope(activeDemo), [activeDemo]);
  const exportJson = exportEnvelope ? serializeTheoraImport(exportEnvelope) : '';

  if (!isOpen) return null;

  const handleImport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchTheoraImport(sourceUrl.trim());
      applyImportedState(payload);
      onClose();
      setSourceUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyExport = () => {
    if (!exportEnvelope) return;
    copyToClipboard(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadExport = () => {
    if (!exportEnvelope) return;
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `theora-${exportEnvelope.demo}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenGist = () => {
    if (!exportEnvelope) return;
    copyToClipboard(exportJson);
    window.open('https://gist.github.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="github-import-modal-backdrop" onClick={onClose}>
      <div
        className="github-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import / Export"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div
              className="font-display font-semibold"
              style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}
            >
              Import / Export
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Load a saved demo from a GitHub URL, or export your current state.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--button-bg)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginLeft: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Import section */}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '16px',
            marginBottom: 12,
            background: 'var(--bg-secondary)',
          }}
        >
          <div
            className="text-[10px] font-bold uppercase"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10 }}
          >
            Import from URL
          </div>
          <input
            className="github-import-modal__input"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && sourceUrl.trim()) handleImport(); }}
            placeholder="github.com/.../blob/.../theora.json"
            autoFocus
            style={{ marginTop: 0, marginBottom: 8 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Accepts raw GitHub files, blob URLs, or public Gists containing{' '}
            <code className="font-mono" style={{ fontSize: 10 }}>{'{"demo":"…","state":{…}}'}</code>
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--status-error-bg)',
                color: 'var(--status-error)',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              className="app-btn-primary rounded-lg"
              onClick={handleImport}
              disabled={isLoading || sourceUrl.trim().length === 0}
              style={{ height: 34, padding: '0 16px', fontSize: 12, opacity: (isLoading || !sourceUrl.trim()) ? 0.4 : 1 }}
            >
              {isLoading ? 'Importing…' : 'Import →'}
            </button>
          </div>
        </div>

        {/* Export section */}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '16px',
            background: 'var(--bg-secondary)',
          }}
        >
          <div
            className="text-[10px] font-bold uppercase"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10 }}
          >
            Export current demo
          </div>

          {exportEnvelope ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Ready to export{' '}
                <code className="font-mono" style={{ fontSize: 11 }}>{exportEnvelope.demo}</code>{' '}
                as <code className="font-mono" style={{ fontSize: 11 }}>theora.json</code>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="app-btn-secondary rounded-lg"
                  onClick={handleCopyExport}
                  style={{ height: 34, padding: '0 14px', fontSize: 12, flex: '1 1 auto' }}
                >
                  {copied ? '✓ Copied' : 'Copy JSON'}
                </button>
                <button
                  className="app-btn-secondary rounded-lg"
                  onClick={handleDownloadExport}
                  style={{ height: 34, padding: '0 14px', fontSize: 12, flex: '1 1 auto' }}
                >
                  Download
                </button>
                <button
                  className="app-btn-primary rounded-lg"
                  onClick={handleOpenGist}
                  style={{ height: 34, padding: '0 14px', fontSize: 12, flex: '1 1 auto' }}
                >
                  Copy + Open Gist ↗
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Export is available for merkle, polynomial, accumulator, and recursive demos.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            className="app-btn-secondary rounded-lg"
            onClick={onClose}
            style={{ height: 34, padding: '0 16px', fontSize: 12 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
