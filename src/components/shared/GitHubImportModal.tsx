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
        aria-label="Import from GitHub"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="github-import-modal__header">
          <div>
            <div className="github-import-modal__title">Import From GitHub</div>
            <div className="github-import-modal__subtitle">
              Supports public raw GitHub files, GitHub blob URLs, and public Gists with `theora.json`.
            </div>
          </div>
          <button className="github-import-modal__close" onClick={onClose} aria-label="Close import dialog">
            ×
          </button>
        </div>

        <label className="github-import-modal__label">
          Public source URL
          <input
            className="github-import-modal__input"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://github.com/.../blob/.../theora.json"
            autoFocus
          />
        </label>

        <div className="github-import-modal__help">
          Required JSON shape: <span className="font-mono">{'{"demo":"merkle","state":{...}}'}</span>
        </div>

        <div className="github-import-modal__divider" />

        <div className="github-import-modal__export">
          <div className="github-import-modal__title-sm">Export Current Demo</div>
          {exportEnvelope ? (
            <>
              <div className="github-import-modal__help">
                Ready to export <span className="font-mono">{exportEnvelope.demo}</span> as `theora.json`.
              </div>
              <div className="github-import-modal__actions github-import-modal__actions--stack">
                <button className="app-btn-secondary rounded-lg h-9 px-4 text-xs font-medium" onClick={handleCopyExport}>
                  Copy JSON
                </button>
                <button className="app-btn-secondary rounded-lg h-9 px-4 text-xs font-medium" onClick={handleDownloadExport}>
                  Download theora.json
                </button>
                <button className="app-btn-primary rounded-lg h-9 px-4 text-xs font-medium" onClick={handleOpenGist}>
                  Copy JSON + Open Gist
                </button>
              </div>
            </>
          ) : (
            <div className="github-import-modal__help">
              Export is currently available for `merkle`, `polynomial`, `accumulator`, and `recursive`.
            </div>
          )}
        </div>

        {error && <div className="github-import-modal__error">{error}</div>}

        <div className="github-import-modal__actions">
          <button className="app-btn-secondary rounded-lg h-9 px-4 text-xs font-medium" onClick={onClose}>
            Cancel
          </button>
          <button
            className="app-btn-primary rounded-lg h-9 px-4 text-xs font-medium"
            onClick={handleImport}
            disabled={isLoading || sourceUrl.trim().length === 0}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
