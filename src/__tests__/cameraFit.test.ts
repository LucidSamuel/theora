import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitCameraToBounds } from '@/lib/cameraFit';
import type { CanvasCamera } from '@/hooks/useCanvasCamera';

function createCamera(initial: { panX?: number; panY?: number; zoom?: number } = {}): CanvasCamera {
  const state = {
    panX: initial.panX ?? 0,
    panY: initial.panY ?? 0,
    zoom: initial.zoom ?? 1,
  };

  const setPanZoom = vi.fn((panX: number, panY: number, zoom: number) => {
    state.panX = panX;
    state.panY = panY;
    state.zoom = zoom;
  });

  return {
    get panX() { return state.panX; },
    get panY() { return state.panY; },
    get zoom() { return state.zoom; },
    mode: 'inspect',
    cursor: 'default',
    toWorld: () => ({ x: 0, y: 0 }),
    reset: vi.fn(),
    panBy: vi.fn(),
    zoomBy: vi.fn(),
    setPanZoom,
    setMode: vi.fn(),
    shouldHandleClick: () => true,
    handlers: {
      onWheel: vi.fn(),
      onMouseDown: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
      onMouseLeave: vi.fn(),
      onTouchStart: vi.fn(),
      onTouchMove: vi.fn(),
      onTouchEnd: vi.fn(),
      onKeyDown: vi.fn(),
    },
  };
}

function createCanvas(rectWidth: number, rectHeight: number, width = 800, height = 600): HTMLCanvasElement {
  return {
    width,
    height,
    getBoundingClientRect: () =>
      ({
        width: rectWidth,
        height: rectHeight,
      }) as DOMRect,
  } as HTMLCanvasElement;
}

describe('fitCameraToBounds', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fits immediately to the supplied bounds', () => {
    const camera = createCamera();
    const canvas = createCanvas(200, 100);

    fitCameraToBounds(
      camera,
      canvas,
      { minX: 0, minY: 0, maxX: 100, maxY: 50 },
      { durationMs: 0 }
    );

    expect(camera.setPanZoom).toHaveBeenCalledOnce();
    const [panX, panY, zoom] = vi.mocked(camera.setPanZoom).mock.calls[0]!;
    expect(panX).toBeCloseTo(16.66667, 4);
    expect(panY).toBeCloseTo(8.33333, 4);
    expect(zoom).toBeCloseTo(1.66667, 4);
  });

  it('falls back to the intrinsic canvas size when layout size is unavailable', () => {
    const camera = createCamera();
    const canvas = createCanvas(0, 0, 300, 200);

    fitCameraToBounds(
      camera,
      canvas,
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      { durationMs: 0, paddingRatio: 0 }
    );

    const [panX, panY, zoom] = vi.mocked(camera.setPanZoom).mock.calls[0]!;
    expect(panX).toBeCloseTo(25, 4);
    expect(panY).toBeCloseTo(0, 4);
    expect(zoom).toBeCloseTo(1, 4);
  });

  it('animates toward the target fit across animation frames', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      const id = ++nextId;
      callbacks.set(id, cb);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(100);

    const camera = createCamera();
    const canvas = createCanvas(300, 200);

    fitCameraToBounds(
      camera,
      canvas,
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      { durationMs: 100, paddingRatio: 0 }
    );

    callbacks.get(1)?.(150);

    expect(camera.setPanZoom).toHaveBeenCalledTimes(1);
    let [panX, panY, zoom] = vi.mocked(camera.setPanZoom).mock.calls[0]!;
    expect(panX).toBeCloseTo(43.75, 4);
    expect(panY).toBeCloseTo(0, 4);
    expect(zoom).toBeCloseTo(1.875, 4);

    callbacks.get(2)?.(200);

    expect(camera.setPanZoom).toHaveBeenCalledTimes(2);
    [panX, panY, zoom] = vi.mocked(camera.setPanZoom).mock.calls[1]!;
    expect(panX).toBeCloseTo(50, 4);
    expect(panY).toBeCloseTo(0, 4);
    expect(zoom).toBeCloseTo(2, 4);
  });

  it('cancels an active fit before starting a new one', () => {
    let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => ++nextId));
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    vi.spyOn(performance, 'now').mockReturnValue(100);

    const camera = createCamera();
    const canvas = createCanvas(200, 100);

    fitCameraToBounds(camera, canvas, { minX: 0, minY: 0, maxX: 100, maxY: 50 }, { durationMs: 100 });
    fitCameraToBounds(camera, canvas, { minX: 0, minY: 0, maxX: 80, maxY: 40 }, { durationMs: 100 });

    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
