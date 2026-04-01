import { useState } from 'react';
import { Link, Hash, Code, Image, FileJson, Github } from 'lucide-react';
import { useGitHub } from '@/hooks/useGitHub';
import { createGitHubSave, GitHubSessionError } from '@/lib/githubApi';
import { getCurrentExportEnvelope } from '@/lib/githubImport';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';
import type { DemoId } from '@/types';

interface ShareSaveDropdownProps {
  demoId: DemoId;
  onCopyShareUrl: () => void;
  onCopyHashUrl: () => void;
  onCopyEmbed: () => void;
  onExportPng: () => void;
  onCopyAudit?: () => void;
}

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ActionRow({ icon, label, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: 6,
        backgroundColor: 'transparent',
        border: 'none',
        transition: 'background-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
        const label = e.currentTarget.querySelector('.action-row-label') as HTMLElement | null;
        if (label) label.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        const label = e.currentTarget.querySelector('.action-row-label') as HTMLElement | null;
        if (label) label.style.color = 'var(--text-secondary)';
      }}
    >
      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span
        className="action-row-label"
        style={{ fontSize: 12, color: 'var(--text-secondary)', transition: 'color 120ms ease' }}
      >
        {label}
      </span>
    </button>
  );
}

export function ShareSaveDropdown({
  demoId,
  onCopyShareUrl,
  onCopyHashUrl,
  onCopyEmbed,
  onExportPng,
  onCopyAudit,
}: ShareSaveDropdownProps) {
  const [open, setOpen] = useState(false);
  const { status, handleSessionExpired, setConnectOpen } = useGitHub();
  const [saveName, setSaveName] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return `${demoId}-${today}`;
  });
  const [saving, setSaving] = useState(false);

  const wrap = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  const handleSave = async () => {
    if (status !== 'connected') {
      setConnectOpen(true);
      return;
    }

    const envelope = getCurrentExportEnvelope(demoId);
    if (!envelope) {
      showToast('No state to save', 'error');
      return;
    }

    setSaving(true);
    try {
      const trimmedName = saveName.trim();
      const result = await createGitHubSave(envelope, trimmedName || undefined);
      copyToClipboard(result.url);
      showToast('Saved to GitHub', `${trimmedName || 'Unlisted Gist'} created and URL copied`);
    } catch (err) {
      if (err instanceof GitHubSessionError) {
        await handleSessionExpired('GitHub session expired — reconnect to save again');
      } else {
        showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const isConnected = status === 'connected';

  return (
    <div className="flex flex-col">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg"
        style={{
          height: 38,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          backgroundColor: 'var(--button-bg)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'background-color 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--button-bg-strong)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--button-bg)';
        }}
        aria-expanded={open}
        aria-controls={`share-save-panel-${demoId}`}
      >
        <span>Share &amp; Save</span>
        <span
          style={{
            fontSize: 10,
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            color: 'var(--text-muted)',
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div
          id={`share-save-panel-${demoId}`}
          style={{
            marginTop: 6,
            borderRadius: 8,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-secondary)',
            overflow: 'hidden',
          }}
        >
          {/* Action rows */}
          <div style={{ padding: '4px 0' }}>
            <ActionRow
              icon={<Link size={14} />}
              label="Copy Link"
              onClick={wrap(onCopyShareUrl)}
            />
            <ActionRow
              icon={<Hash size={14} />}
              label="Hash URL"
              onClick={wrap(onCopyHashUrl)}
            />
            <ActionRow
              icon={<Code size={14} />}
              label="Embed Code"
              onClick={wrap(onCopyEmbed)}
            />
            <ActionRow
              icon={<Image size={14} />}
              label="Export PNG"
              onClick={wrap(onExportPng)}
            />
            {onCopyAudit && (
              <ActionRow
                icon={<FileJson size={14} />}
                label="Audit JSON"
                onClick={wrap(onCopyAudit)}
              />
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '0 0' }} />

          {/* Save to GitHub section */}
          <div style={{ padding: '10px 12px 12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
              }}
            >
              <Github size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {isConnected ? 'Save to GitHub' : 'GitHub (not connected)'}
              </span>
            </div>
            {isConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Save name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !saving) void handleSave();
                  }}
                  aria-label="Save name"
                  className="w-full rounded-lg text-[12px] outline-none"
                  style={{
                    height: 32,
                    padding: '0 10px',
                    backgroundColor: 'var(--button-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                  }}
                />
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  disabled={saving}
                  className="w-full rounded-lg disabled:opacity-30 disabled:cursor-not-allowed app-btn-secondary"
                  style={{ height: 32, fontSize: 12 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="w-full rounded-lg app-btn-secondary"
                style={{ height: 32, fontSize: 12 }}
              >
                Connect GitHub
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
