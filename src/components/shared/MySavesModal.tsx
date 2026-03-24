import { useCallback, useEffect, useRef, useState } from 'react';
import { useGitHub } from '@/hooks/useGitHub';
import { DEMOS, type DemoId } from '@/types';
import { DemoIcon } from '@/components/shared/DemoIcon';
import { listTheoraGists, deleteGist, fetchGistEnvelope, applyImportedState, type TheoraSave } from '@/lib/githubImport';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';

export function MySavesModal() {
  const { status, getToken, savesOpen, setSavesOpen } = useGitHub();
  const [saves, setSaves] = useState<TheoraSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load gists when modal opens
  useEffect(() => {
    if (!savesOpen || status !== 'connected') return;
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    listTheoraGists(token)
      .then(setSaves)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load saves'))
      .finally(() => setLoading(false));
  }, [savesOpen, status, getToken]);

  // Close on Escape
  useEffect(() => {
    if (!savesOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSavesOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [savesOpen, setSavesOpen]);

  // Focus trap
  const handleKeyDownTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  if (!savesOpen) return null;

  const handleLoad = async (save: TheoraSave) => {
    const token = getToken();
    if (!token) return;
    setLoadingId(save.id);
    try {
      const envelope = await fetchGistEnvelope(token, save.id);
      applyImportedState(envelope);
      setSavesOpen(false);
      showToast('Save loaded', `Restored ${demoTitle(save.demo)} state`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load save', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (save: TheoraSave) => {
    const token = getToken();
    if (!token) return;
    setDeletingId(save.id);
    try {
      await deleteGist(token, save.id);
      setSaves((prev) => prev.filter((s) => s.id !== save.id));
      showToast('Save deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShare = (save: TheoraSave) => {
    copyToClipboard(save.html_url);
    showToast('Gist URL copied');
  };

  const handleRefresh = () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    listTheoraGists(token)
      .then(setSaves)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load saves'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="github-import-modal-backdrop" onClick={() => setSavesOpen(false)}>
      <div
        ref={modalRef}
        className="github-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="My Saves"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownTrap}
        style={{ width: 'min(520px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div className="font-display font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
              My Saves
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your Theora demo states saved as GitHub Gists.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 16 }}>
            <button
              onClick={handleRefresh}
              aria-label="Refresh"
              disabled={loading}
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--button-bg)',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: loading ? 0.4 : 1,
              }}
            >
              &#8635;
            </button>
            <button
              onClick={() => setSavesOpen(false)}
              aria-label="Close"
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--button-bg)',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {error && (
            <div
              style={{
                marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {loading && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading saves...
            </div>
          )}

          {!loading && !error && saves.length === 0 && (
            <div
              style={{
                padding: '32px 16px', textAlign: 'center',
                borderRadius: 12, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                No saves yet
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Use "Save to GitHub" in any demo's Share section to create your first save.
              </div>
            </div>
          )}

          {!loading && saves.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {saves.map((save) => (
                <div
                  key={save.id}
                  style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <DemoIcon id={save.demo} size={16} color="var(--text-secondary)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {save.description}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {demoTitle(save.demo)} &middot; {formatDate(save.updated_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="app-btn-primary rounded-lg"
                      onClick={() => handleLoad(save)}
                      disabled={loadingId === save.id}
                      style={{ height: 30, padding: '0 12px', fontSize: 11, flex: '1 1 auto', opacity: loadingId === save.id ? 0.4 : 1 }}
                    >
                      {loadingId === save.id ? 'Loading...' : 'Load'}
                    </button>
                    <button
                      className="app-btn-secondary rounded-lg"
                      onClick={() => handleShare(save)}
                      style={{ height: 30, padding: '0 10px', fontSize: 11 }}
                    >
                      Share
                    </button>
                    <button
                      className="app-btn-secondary rounded-lg"
                      onClick={() => handleDelete(save)}
                      disabled={deletingId === save.id}
                      style={{ height: 30, padding: '0 10px', fontSize: 11, opacity: deletingId === save.id ? 0.4 : 1 }}
                    >
                      {deletingId === save.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, flexShrink: 0 }}>
          <button
            className="app-btn-secondary rounded-lg"
            onClick={() => setSavesOpen(false)}
            style={{ height: 34, padding: '0 16px', fontSize: 12 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function demoTitle(id: DemoId): string {
  return DEMOS.find((d) => d.id === id)?.title ?? id;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}
