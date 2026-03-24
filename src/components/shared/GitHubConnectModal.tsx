import { useCallback, useEffect, useRef, useState } from 'react';
import { useGitHub } from '@/hooks/useGitHub';
import { useModalA11y } from '@/hooks/useModalA11y';

export function GitHubConnectModal() {
  const { status, user, error, oauthAvailable, startOAuth, disconnect, refreshSession, connectOpen, setConnectOpen } = useGitHub();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isRefreshingAvailability, setIsRefreshingAvailability] = useState(false);
  const close = useCallback(() => setConnectOpen(false), [setConnectOpen]);
  const { handleKeyDownTrap } = useModalA11y(modalRef, connectOpen, close);

  useEffect(() => {
    if (!connectOpen) return;
    let active = true;
    setIsRefreshingAvailability(true);
    void refreshSession({ preserveError: true })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setIsRefreshingAvailability(false);
        }
      });
    return () => {
      active = false;
      setIsRefreshingAvailability(false);
    };
  }, [connectOpen, refreshSession]);

  if (!connectOpen) return null;

  const isConnected = status === 'connected' && user !== null;
  const isLoading = status === 'connecting' || isRefreshingAvailability;

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
                ? 'Your saves use unlisted GitHub Gists managed through a server-side session.'
                : 'Save and load demo states.'}
            </div>
          </div>
          <button
            onClick={() => setConnectOpen(false)}
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

        {isConnected ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                marginBottom: 12,
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
                  Connected with gist access
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: 11,
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Saves are unlisted, not fully private. They do not appear on your public profile, but anyone with the link can still view them.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="app-btn-secondary rounded-lg flex-1"
                onClick={() => { void disconnect(); setConnectOpen(false); }}
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

            {isLoading ? (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  lineHeight: 1.6,
                }}
              >
                Checking GitHub sign-in availability...
              </div>
            ) : oauthAvailable ? (
              <>
                <button
                  className="app-btn-primary rounded-lg"
                  onClick={startOAuth}
                  style={{
                    width: '100%',
                    height: 42,
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 1C3.686 1 1 3.686 1 7c0 2.654 1.721 4.904 4.107 5.698.3.055.41-.13.41-.29 0-.142-.005-.519-.008-1.018-1.67.363-2.022-.804-2.022-.804-.273-.694-.666-.879-.666-.879-.545-.373.041-.365.041-.365.602.042.919.618.919.618.535.916 1.403.652 1.745.498.054-.387.209-.652.38-.802-1.332-.152-2.733-.666-2.733-2.963 0-.655.234-1.19.618-1.61-.062-.151-.268-.76.058-1.585 0 0 .504-.161 1.65.615A5.75 5.75 0 0 1 7 4.836c.51.002 1.023.069 1.502.202 1.145-.776 1.648-.615 1.648-.615.327.825.121 1.434.06 1.585.385.42.617.955.617 1.61 0 2.304-1.403 2.81-2.739 2.958.215.186.407.552.407 1.113 0 .804-.007 1.452-.007 1.65 0 .16.108.348.413.289C11.28 11.902 13 9.653 13 7c0-3.314-2.686-6-6-6z" />
                  </svg>
                  Sign in with GitHub
                </button>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                >
                  Theora only requests <code className="font-mono" style={{ fontSize: 10 }}>gist</code> access. For sensitive data, prefer Download JSON instead of saving to GitHub.
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  lineHeight: 1.6,
                }}
              >
                GitHub save/load is unavailable on this deployment. Configure the server-side GitHub OAuth session environment before using this feature.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
