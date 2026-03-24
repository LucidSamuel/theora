import { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import type { DemoId } from '@/types';
import { applyImportedState, fetchTheoraImport, getCurrentExportEnvelope, serializeTheoraImport } from '@/lib/githubImport';
import { createGitHubSave, GitHubSessionError } from '@/lib/githubApi';
import { useGitHub } from '@/hooks/useGitHub';
import { useModalA11y } from '@/hooks/useModalA11y';

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDemo: DemoId;
}

export function GitHubImportModal({ isOpen, onClose, activeDemo }: GitHubImportModalProps) {
  const { status, user, setConnectOpen, handleSessionExpired } = useGitHub();
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gistUrl, setGistUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const exportEnvelope = useMemo(() => getCurrentExportEnvelope(activeDemo), [activeDemo]);
  const exportJson = exportEnvelope ? serializeTheoraImport(exportEnvelope) : '';
  const modalRef = useRef<HTMLDivElement>(null);
  const isConnected = status === 'connected' && user !== null;
  const { handleKeyDownTrap } = useModalA11y(modalRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setImportError(null);
    setSaveError(null);
    setCopied(false);
    setGistUrl(null);
    setIsPublishing(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = async () => {
    setIsLoading(true);
    setImportError(null);
    try {
      const payload = await fetchTheoraImport(sourceUrl.trim());
      applyImportedState(payload);
      onClose();
      setSourceUrl('');
      setGistUrl(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
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

  const handleSaveToGitHub = async () => {
    if (!exportEnvelope) return;
    if (!isConnected) {
      setConnectOpen(true);
      return;
    }

    setSaveError(null);
    setIsPublishing(true);
    try {
      const result = await createGitHubSave(exportEnvelope);
      setGistUrl(result.url);
      copyToClipboard(result.url);
    } catch (err) {
      if (err instanceof GitHubSessionError) {
        await handleSessionExpired('GitHub session expired — reconnect to save again');
      } else {
        setSaveError(err instanceof Error ? err.message : 'GitHub save failed');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="github-import-modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="github-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import / Export"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownTrap}
        style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      >
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
            onKeyDown={(e) => { if (e.key === 'Enter' && sourceUrl.trim()) void handleImport(); }}
            placeholder="github.com/.../blob/.../theora.json"
            autoFocus
            style={{ marginTop: 0, marginBottom: 8 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Accepts raw GitHub files, blob URLs, or public and unlisted Gists containing{' '}
            <code className="font-mono" style={{ fontSize: 10 }}>{'{"demo":"…","state":{…}}'}</code>
          </div>

          {importError && (
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
              {importError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              className="app-btn-primary rounded-lg"
              onClick={() => { void handleImport(); }}
              disabled={isLoading || sourceUrl.trim().length === 0}
              style={{ height: 34, padding: '0 16px', fontSize: 12, opacity: (isLoading || !sourceUrl.trim()) ? 0.4 : 1 }}
            >
              {isLoading ? 'Importing…' : 'Import →'}
            </button>
          </div>
        </div>

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
              <div style={{ marginTop: 14 }}>
                {isConnected ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--status-success-bg)',
                      color: 'var(--status-success)',
                      fontSize: 12,
                    }}
                  >
                    Saving with your connected GitHub account as <strong>{user.login}</strong>.
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                    Connect GitHub to save this export as an unlisted Gist. Anyone with the link can still view it.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="app-btn-primary rounded-lg"
                    onClick={() => { void handleSaveToGitHub(); }}
                    disabled={isPublishing || status === 'connecting'}
                    style={{ height: 34, padding: '0 14px', fontSize: 12, flex: '1 1 auto', opacity: (isPublishing || status === 'connecting') ? 0.4 : 1 }}
                  >
                    {isPublishing ? 'Saving…' : isConnected ? 'Save to GitHub' : 'Connect GitHub to Save'}
                  </button>
                </div>
                {saveError && (
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
                    {saveError}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  For sensitive state, Download keeps the file local to your device. GitHub saves are unlisted rather than fully private.
                </div>
                {gistUrl && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--status-success-bg)', color: 'var(--status-success)', fontSize: 12 }}>
                    Unlisted Gist created and URL copied:{' '}
                    <a href={gistUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {gistUrl}
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Export becomes available once this demo has shareable state. All 12 demos support import/export.
            </div>
          )}
        </div>

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
