import { describe, it, expect, vi, afterEach } from 'vitest';
import { hexToRgba, prepareLandscapeExportCanvas } from '@/lib/canvas';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('temporarily resizes the canvas to a landscape export surface and restores it', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });

    const canvas = {
      width: 300,
      height: 200,
      style: {
        width: '100%',
        height: '100%',
      },
    } as HTMLCanvasElement;

    const surface = prepareLandscapeExportCanvas(canvas);

    expect(surface.width).toBe(800);
    expect(surface.height).toBe(450);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('450px');

    surface.restore();

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(200);
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });
});
