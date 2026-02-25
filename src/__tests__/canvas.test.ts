import { describe, it, expect } from 'vitest';
import { hexToRgba } from '@/lib/canvas';

describe('hexToRgba', () => {
  it('converts hex with # prefix', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255,0,0,1)');
  });

  it('converts hex without # prefix', () => {
    expect(hexToRgba('00ff00', 0.5)).toBe('rgba(0,255,0,0.5)');
  });

  it('handles white', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)');
  });

  it('handles black', () => {
    expect(hexToRgba('#000000', 0)).toBe('rgba(0,0,0,0)');
  });

  it('handles mixed colors', () => {
    expect(hexToRgba('#1a2b3c', 0.75)).toBe('rgba(26,43,60,0.75)');
  });
});
