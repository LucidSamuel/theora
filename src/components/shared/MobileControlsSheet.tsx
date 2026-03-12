import { useEffect, type ReactNode } from 'react';

interface MobileControlsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A slide-up sheet rendered on mobile for demo controls.
 * On desktop (>= md) this renders nothing — the controls live in the
 * regular `.demo-sidebar` panel instead.
 */
export function MobileControlsSheet({ isOpen, onClose, title, children }: MobileControlsSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`mobile-sheet-backdrop${isOpen ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`mobile-sheet${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-label={title}
        aria-modal="true"
      >
        <div className="mobile-sheet-handle" onClick={onClose} aria-hidden="true">
          <div className="mobile-sheet-handle-bar" />
        </div>
        <div className="mobile-sheet-header">
          <span className="mobile-sheet-title">{title}</span>
          <button className="mobile-sheet-close" onClick={onClose} aria-label="Close controls">
            &#x2715;
          </button>
        </div>
        <div className="mobile-sheet-content">
          {children}
        </div>
      </div>
    </>
  );
}
