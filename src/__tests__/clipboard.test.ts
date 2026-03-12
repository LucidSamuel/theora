import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '@/lib/clipboard';

describe('copyToClipboard', () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
  });

  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    copyToClipboard('hello');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to document.execCommand when clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const textarea = { value: '', style: {}, select: vi.fn() };
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const execCommand = vi.fn();

    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn(() => textarea),
        body: { appendChild, removeChild },
        execCommand,
      },
      configurable: true,
    });

    copyToClipboard('fallback');
    await Promise.resolve();
    await Promise.resolve();

    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(textarea.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(removeChild).toHaveBeenCalledWith(textarea);
  });
});
