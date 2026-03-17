import type { CanvasCamera } from '@/hooks/useCanvasCamera';

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface FitOptions {
  paddingRatio?: number;
  durationMs?: number;
  maxZoom?: number;
}

const activeFits = new WeakMap<CanvasCamera, number>();

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function getCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    width: rect.width || canvas.width / dpr || 800,
    height: rect.height || canvas.height / dpr || 600,
  };
}

export function fitCameraToBounds(
  camera: CanvasCamera,
  canvas: HTMLCanvasElement,
  bounds: CameraBounds,
  options: FitOptions = {}
): void {
  const paddingRatio = options.paddingRatio ?? 0.1;
  const durationMs = options.durationMs ?? 260;
  const maxZoom = options.maxZoom ?? 4;

  const widthSpan = Math.max(bounds.maxX - bounds.minX, 1);
  const heightSpan = Math.max(bounds.maxY - bounds.minY, 1);
  const paddedWidth = widthSpan * (1 + paddingRatio * 2);
  const paddedHeight = heightSpan * (1 + paddingRatio * 2);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const canvasSize = getCanvasSize(canvas);
  const targetZoom = Math.min(canvasSize.width / paddedWidth, canvasSize.height / paddedHeight, maxZoom);
  const targetPanX = canvasSize.width / 2 - centerX * targetZoom;
  const targetPanY = canvasSize.height / 2 - centerY * targetZoom;

  const previousFrame = activeFits.get(camera);
  if (previousFrame) {
    cancelAnimationFrame(previousFrame);
  }

  const startPanX = camera.panX;
  const startPanY = camera.panY;
  const startZoom = camera.zoom;

  if (durationMs <= 0) {
    camera.setPanZoom(targetPanX, targetPanY, targetZoom);
    return;
  }

  const startTime = performance.now();

  const step = (now: number) => {
    const progress = Math.min((now - startTime) / durationMs, 1);
    const eased = easeOutCubic(progress);
    camera.setPanZoom(
      startPanX + (targetPanX - startPanX) * eased,
      startPanY + (targetPanY - startPanY) * eased,
      startZoom + (targetZoom - startZoom) * eased
    );

    if (progress < 1) {
      activeFits.set(camera, requestAnimationFrame(step));
    } else {
      activeFits.delete(camera);
    }
  };

  activeFits.set(camera, requestAnimationFrame(step));
}
