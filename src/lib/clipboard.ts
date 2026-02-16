/**
 * Copy text to clipboard with fallback for restricted contexts.
 * Fire-and-forget — never throws.
 */
export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // Silently fail
    }
  });
}
