import { useCallback, useEffect, useRef, type ReactNode } from 'react';

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
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus trap
  const handleKeyDownTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusable = sheet.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

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
        ref={sheetRef}
        className={`mobile-sheet${isOpen ? ' open' : ''}`}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        onKeyDown={handleKeyDownTrap}
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
