import { useCallback, useEffect, useRef, useState } from 'react';
import { useGitHub } from '@/hooks/useGitHub';

export function GitHubConnectModal() {
  const { status, user, error, oauthAvailable, connect, startOAuth, disconnect, connectOpen, setConnectOpen } = useGitHub();
  const [token, setToken] = useState('');
  const [persist, setPersist] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPat, setShowPat] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (connectOpen) {
      setToken('');
      setLocalError(null);
      setIsSubmitting(false);
    }
  }, [connectOpen]);

  // Close on Escape
  useEffect(() => {
    if (!connectOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConnectOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [connectOpen, setConnectOpen]);

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

  if (!connectOpen) return null;

  const isConnected = status === 'connected' && user;
  const displayError = localError || error;

  const handleConnect = async () => {
    if (!token.trim()) return;
    setIsSubmitting(true);
    setLocalError(null);
    try {
      await connect(token.trim(), persist);
      setConnectOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnectOpen(false);
  };

  return (
    <div className="github-import-modal-backdrop" onClick={() => setConnectOpen(false)}>
      <div
        ref={modalRef}
        className="github-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Connect GitHub"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownTrap}
        style={{ width: 'min(440px, 100%)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="font-display font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>
              {isConnected ? 'GitHub Connected' : 'Connect GitHub'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {isConnected
                ? 'Your demo states are saved as public GitHub Gists.'
                : 'Save and load demo states as GitHub Gists.'}
            </div>
          </div>
          <button
            onClick={() => setConnectOpen(false)}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--button-bg)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: 16,
            }}
          >
            &times;
          </button>
        </div>

        {isConnected ? (
          <div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                marginBottom: 16,
              }}
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.login}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Connected with gist scope
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="app-btn-secondary rounded-lg flex-1"
                onClick={handleDisconnect}
                style={{ height: 36, fontSize: 12 }}
              >
                Disconnect
              </button>
              <button
                className="app-btn-secondary rounded-lg flex-1"
                onClick={() => setConnectOpen(false)}
                style={{ height: 36, fontSize: 12 }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div>
            {displayError && (
              <div
                style={{
                  marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                  background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 12,
                }}
              >
                {displayError}
              </div>
            )}

            {/* OAuth — primary action */}
            {oauthAvailable && (
              <button
                className="app-btn-primary rounded-lg"
                onClick={startOAuth}
                style={{
                  width: '100%', height: 42, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 16,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M7 1C3.686 1 1 3.686 1 7c0 2.654 1.721 4.904 4.107 5.698.3.055.41-.13.41-.29 0-.142-.005-.519-.008-1.018-1.67.363-2.022-.804-2.022-.804-.273-.694-.666-.879-.666-.879-.545-.373.041-.365.041-.365.602.042.919.618.919.618.535.916 1.403.652 1.745.498.054-.387.209-.652.38-.802-1.332-.152-2.733-.666-2.733-2.963 0-.655.234-1.19.618-1.61-.062-.151-.268-.76.058-1.585 0 0 .504-.161 1.65.615A5.75 5.75 0 0 1 7 4.836c.51.002 1.023.069 1.502.202 1.145-.776 1.648-.615 1.648-.615.327.825.121 1.434.06 1.585.385.42.617.955.617 1.61 0 2.304-1.403 2.81-2.739 2.958.215.186.407.552.407 1.113 0 .804-.007 1.452-.007 1.65 0 .16.108.348.413.289C11.28 11.902 13 9.653 13 7c0-3.314-2.686-6-6-6z"/>
                </svg>
                Sign in with GitHub
              </button>
            )}

            {/* PAT fallback — collapsible when OAuth is available */}
            {oauthAvailable && (
              <button
                onClick={() => setShowPat((v) => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-muted)', padding: 0,
                  display: 'flex', alignItems: 'center', gap: 4, marginBottom: showPat ? 12 : 0,
                }}
              >
                <span style={{ fontSize: 9, transition: 'transform 150ms', transform: showPat ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                Use a personal access token instead
              </button>
            )}

            {(showPat || !oauthAvailable) && (
              <div
                style={{
                  padding: '16px', borderRadius: 12,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                }}
              >
                <div
                  className="text-[10px] font-bold uppercase"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 10 }}
                >
                  Personal Access Token
                </div>
                <input
                  type="password"
                  className="github-import-modal__input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && token.trim()) handleConnect(); }}
                  placeholder="ghp_... (gist scope)"
                  autoComplete="off"
                  autoFocus={!oauthAvailable}
                  style={{ marginTop: 0, marginBottom: 10 }}
                />
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 12, fontSize: 11, color: 'var(--text-muted)',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={persist}
                    onChange={(e) => setPersist(e.target.checked)}
                    style={{ accentColor: 'var(--text-muted)' }}
                  />
                  Remember on this device
                </label>

                <button
                  className="app-btn-primary rounded-lg"
                  onClick={handleConnect}
                  disabled={isSubmitting || !token.trim()}
                  style={{ width: '100%', height: 36, fontSize: 12, opacity: (isSubmitting || !token.trim()) ? 0.4 : 1 }}
                >
                  {isSubmitting ? 'Connecting...' : 'Connect with token'}
                </button>

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Create a token at{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=gist&description=Theora"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
                  >
                    github.com/settings/tokens
                  </a>
                  {' '}with <code className="font-mono" style={{ fontSize: 10 }}>gist</code> scope only.
                  {!persist && ' Token is used for this session only.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
