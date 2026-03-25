import { useRef, useCallback, useState, type WheelEvent as ReactWheelEvent, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';

export interface CanvasCamera {
  panX: number;
  panY: number;
  zoom: number;
  mode: 'inspect' | 'pan';
  cursor: string;
  /** Convert screen-space CSS coords to world-space coords */
  toWorld: (screenX: number, screenY: number) => { x: number; y: number };
  /** Reset camera to default */
  reset: () => void;
  panBy: (dx: number, dy: number) => void;
  zoomBy: (factor: number) => void;
  /** Directly set camera position and zoom (for programmatic animation) */
  setPanZoom: (panX: number, panY: number, zoom: number) => void;
  setMode: (mode: 'inspect' | 'pan') => void;
  shouldHandleClick: () => boolean;
  handlers: {
    onWheel: (e: ReactWheelEvent<HTMLCanvasElement>) => void;
    onMouseDown: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onTouchMove: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onTouchEnd: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLCanvasElement>) => void;
  };
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function useCanvasCamera(): CanvasCamera {
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const zoomRef = useRef(1);
  const modeRef = useRef<'inspect' | 'pan'>('inspect');
  const isPanningRef = useRef(false);
  const suppressClickRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  // Trigger re-render when mode changes so toolbar active state + cursor update
  const [, setModeVersion] = useState(0);

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

  const panBy = useCallback((dx: number, dy: number) => {
    panXRef.current += dx;
    panYRef.current += dy;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor));
  }, []);

  const setPanZoom = useCallback((px: number, py: number, z: number) => {
    panXRef.current = px;
    panYRef.current = py;
    zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }, []);

  const setMode = useCallback((mode: 'inspect' | 'pan') => {
    modeRef.current = mode;
    isPanningRef.current = false;
    suppressClickRef.current = false;
    setModeVersion((v) => v + 1);
  }, []);

  const shouldHandleClick = useCallback(() => !suppressClickRef.current && modeRef.current !== 'pan', []);

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
    suppressClickRef.current = false;
    const panIntent = e.button === 1 || (e.button === 0 && (e.altKey || modeRef.current === 'pan'));
    if (panIntent) {
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
    if (Math.abs(x - panStartRef.current.x) > 2 || Math.abs(y - panStartRef.current.y) > 2) {
      suppressClickRef.current = true;
    }
    panXRef.current = panOriginRef.current.x + (x - panStartRef.current.x);
    panYRef.current = panOriginRef.current.y + (y - panStartRef.current.y);
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
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
    isPanningRef.current = false;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const key = e.key.toLowerCase();
    if (key === '+' || key === '=') {
      e.preventDefault();
      e.stopPropagation();
      zoomBy(1.1);
      return;
    }
    if (key === '-' || key === '_') {
      e.preventDefault();
      e.stopPropagation();
      zoomBy(0.9);
      return;
    }
    if (key === '0') {
      e.preventDefault();
      e.stopPropagation();
      reset();
      return;
    }
    // Mode shortcuts — V for inspect (select), H for pan (hand)
    if (key === 'v') {
      e.preventDefault();
      e.stopPropagation();
      setMode('inspect');
      return;
    }
    if (key === 'h') {
      e.preventDefault();
      e.stopPropagation();
      setMode('pan');
      return;
    }
    // Arrow keys for panning — stopPropagation to prevent demo navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      panBy(0, 24);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      panBy(0, -24);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      panBy(24, 0);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      panBy(-24, 0);
    }
  }, [panBy, reset, setMode, zoomBy]);

  const cameraRef = useRef<CanvasCamera | null>(null);
  if (!cameraRef.current) {
    cameraRef.current = {
      get panX() { return panXRef.current; },
      get panY() { return panYRef.current; },
      get zoom() { return zoomRef.current; },
      get mode() { return modeRef.current; },
      get cursor() {
        if (modeRef.current === 'pan') {
          return isPanningRef.current ? 'grabbing' : 'grab';
        }
        return 'default';
      },
      toWorld,
      reset,
      panBy,
      zoomBy,
      setPanZoom,
      setMode,
      shouldHandleClick,
      handlers: {
        onWheel: handleWheel,
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseLeave,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onKeyDown: handleKeyDown,
      },
    };
  }

  // Keep handlers up to date
  cameraRef.current.handlers = {
    onWheel: handleWheel,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onKeyDown: handleKeyDown,
  };

  return cameraRef.current;
}
