import { useRef, useCallback, type WheelEvent as ReactWheelEvent, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';

export interface CanvasCamera {
  panX: number;
  panY: number;
  zoom: number;
  /** Convert screen-space CSS coords to world-space coords */
  toWorld: (screenX: number, screenY: number) => { x: number; y: number };
  /** Reset camera to default */
  reset: () => void;
  handlers: {
    onWheel: (e: ReactWheelEvent<HTMLCanvasElement>) => void;
    onMouseDown: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onTouchStart: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onTouchMove: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onTouchEnd: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
  };
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function useCanvasCamera(): CanvasCamera {
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const zoomRef = useRef(1);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  // Pinch-zoom tracking
  const lastPinchDistRef = useRef(0);

  const toWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - panXRef.current) / zoomRef.current,
      y: (screenY - panYRef.current) / zoomRef.current,
    };
  }, []);

  const reset = useCallback(() => {
    panXRef.current = 0;
    panYRef.current = 0;
    zoomRef.current = 1;
  }, []);

  // Zoom centered on cursor
  const handleWheel = useCallback((e: ReactWheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const oldZoom = zoomRef.current;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * zoomFactor));

    // Adjust pan so zoom is centered on cursor
    panXRef.current = cursorX - (cursorX - panXRef.current) * (newZoom / oldZoom);
    panYRef.current = cursorY - (cursorY - panYRef.current) * (newZoom / oldZoom);
    zoomRef.current = newZoom;
  }, []);

  // Pan with middle mouse or Alt+left click
  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanningRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      panStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      panOriginRef.current = { x: panXRef.current, y: panYRef.current };
    }
  }, []);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!isPanningRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    panXRef.current = panOriginRef.current.x + (x - panStartRef.current.x);
    panYRef.current = panOriginRef.current.y + (y - panStartRef.current.y);
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Two-finger pinch zoom for touch
  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      lastPinchDistRef.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

      if (lastPinchDistRef.current > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const centerY = (t0.clientY + t1.clientY) / 2 - rect.top;

        const oldZoom = zoomRef.current;
        const scale = dist / lastPinchDistRef.current;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * scale));

        panXRef.current = centerX - (centerX - panXRef.current) * (newZoom / oldZoom);
        panYRef.current = centerY - (centerY - panYRef.current) * (newZoom / oldZoom);
        zoomRef.current = newZoom;
      }

      lastPinchDistRef.current = dist;
    }
  }, []);

  const handleTouchEnd = useCallback((_e: ReactTouchEvent<HTMLCanvasElement>) => {
    lastPinchDistRef.current = 0;
  }, []);

  const cameraRef = useRef<CanvasCamera | null>(null);
  if (!cameraRef.current) {
    cameraRef.current = {
      get panX() { return panXRef.current; },
      get panY() { return panYRef.current; },
      get zoom() { return zoomRef.current; },
      toWorld,
      reset,
      handlers: {
        onWheel: handleWheel,
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      },
    };
  }

  // Keep handlers up to date
  cameraRef.current.handlers = {
    onWheel: handleWheel,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return cameraRef.current;
}
