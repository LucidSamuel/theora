import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { ApiKeyStore } from '@/modes/predict/ai/apiKeyStore';
import type { KeyStoragePreference } from '@/modes/predict/types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState('');
  const [pref, setPref] = useState<KeyStoragePreference>('memory');
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);

  const close = useCallback(() => onClose(), [onClose]);
  const { handleKeyDownTrap } = useModalA11y(modalRef, isOpen, close);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasKey(ApiKeyStore.has());
      setPref(ApiKeyStore.getPreference());
      setKey('');
      setError(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    // If key field is empty but we already have a key, just save the preference change
    if (!key && hasKey) {
      ApiKeyStore.setPreference(pref);
      onClose();
      return;
    }
    if (!ApiKeyStore.validate(key)) {
      setError('Invalid key format. Anthropic API keys start with sk-ant-');
      return;
    }
    ApiKeyStore.setPreference(pref);
    ApiKeyStore.set(key);
    setKey('');
    setError(null);
    setHasKey(true);
    onClose();
  };

  const handleClear = () => {
    ApiKeyStore.clear();
    setKey('');
    setError(null);
    setHasKey(false);
  };

  if (!isOpen) return null;

  const prefLabel: Record<KeyStoragePreference, string> = {
    memory: 'This tab only (safest)',
    session: 'Until tab closes',
    local: 'Remember across sessions',
  };

  return (
    <div
      className="github-import-modal-backdrop"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="github-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="API Key Settings"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownTrap}
        style={{ width: 'min(420px, 100%)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div
              className="font-display font-semibold"
              style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}
            >
              API Key
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your Anthropic API key powers AI-generated challenges in Predict mode and paper analysis in Research.
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
            &times;
          </button>
        </div>

        {/* Current key status */}
        {hasKey && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--status-success-bg)',
              border: '1px solid var(--status-success)',
              marginBottom: 16,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--status-success)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Connected
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Storage: {prefLabel[pref]}
              </div>
            </div>
          </div>
        )}

        {/* Key input */}
        <div style={{ marginBottom: 4 }}>
          <label
            htmlFor="api-key-input"
            style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}
          >
            {hasKey ? 'Replace key' : 'API Key'}
          </label>
          <input
            id="api-key-input"
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(null); }}
            placeholder="sk-ant-..."
            autoComplete="off"
            style={{
              width: '100%',
              height: 38,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--button-bg)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              padding: '0 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Storage preference */}
        <div style={{ marginTop: 14, marginBottom: 14 }}>
          <div
            style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}
          >
            Storage
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['memory', 'session', 'local'] as const).map((p) => (
              <label
                key={p}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: pref === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="api-key-storage-modal"
                  checked={pref === p}
                  onChange={() => setPref(p)}
                  style={{ margin: 0, flexShrink: 0, accentColor: 'var(--text-primary)' }}
                />
                {prefLabel[p]}
              </label>
            ))}
          </div>
        </div>

        {/* Security note */}
        <div className="control-note" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Key is sent only to api.anthropic.com. It is never stored on Theora servers.
          </span>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 12,
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

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={!key && !hasKey}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 8,
              border: 'none',
              background: (key || hasKey) ? 'var(--text-primary)' : 'var(--border)',
              color: (key || hasKey) ? 'var(--bg-primary)' : 'var(--text-muted)',
              cursor: (key || hasKey) ? 'pointer' : 'not-allowed',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
            }}
          >
            Save
          </button>
          {hasKey && (
            <button
              onClick={handleClear}
              style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
        </div>

        {/* Console link */}
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Get an API key at console.anthropic.com →
          </a>
        </div>
      </div>
    </div>
  );
}
