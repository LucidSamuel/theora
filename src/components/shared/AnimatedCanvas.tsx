import { useRef, useEffect, useCallback, useState } from 'react';

export interface CameraState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface FrameInfo {
  time: number;
  delta: number;
  frameCount: number;
  width: number;
  height: number;
  camera: CameraState;
}

interface AnimatedCanvasProps {
  draw: (ctx: CanvasRenderingContext2D, frame: FrameInfo) => void;
  className?: string;
  camera?: CameraState;
  onCanvas?: (canvas: HTMLCanvasElement) => void;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave?: () => void;
  onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove?: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLCanvasElement>) => void;
}

const DEFAULT_CAMERA: CameraState = { panX: 0, panY: 0, zoom: 1 };

export function AnimatedCanvas({
  draw, className, camera, onCanvas,
  onWheel, onMouseMove, onMouseDown, onMouseUp, onMouseLeave, onClick,
  onTouchStart, onTouchMove, onTouchEnd, onKeyDown,
}: AnimatedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const cameraRef = useRef(camera ?? DEFAULT_CAMERA);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef = useRef(window.devicePixelRatio || 1);

  drawRef.current = draw;
  cameraRef.current = camera ?? DEFAULT_CAMERA;

  // Attach wheel handler natively with { passive: false } so e.preventDefault()
  // actually works. React 18 registers onWheel as passive, making preventDefault()
  // a no-op — this causes scroll pass-through in iframes instead of canvas zoom.
  const wheelRef = useRef(onWheel);
  wheelRef.current = onWheel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      // Safe cast: handlers only use preventDefault(), deltaY, clientX, clientY, currentTarget
      wheelRef.current?.(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    resize();

    const canvas = canvasRef.current;
    if (!canvas) return;

    ctxRef.current = canvas.getContext('2d');
    onCanvas?.(canvas);
    const parent = canvas.parentElement;

    const ro = new ResizeObserver(() => resize());
    if (parent) ro.observe(parent);

    const animate = (time: number) => {
      const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = time;
      frameRef.current++;

      const ctx = ctxRef.current;
      if (ctx) {
        const dpr = dprRef.current;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const cam = cameraRef.current;

        ctx.save();
        // Reset transform each frame so draw callbacks can't permanently lose DPR scale
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // ── Infinite background (screen space, before camera transform) ──
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        ctx.fillStyle = isDark ? '#0a0a0a' : '#f9f9f9';
        ctx.fillRect(0, 0, w, h);

        // Dot grid that scrolls with the camera to create infinite-canvas feel
        const dotSpacing = 28;
        const dotRadius = isDark ? 0.85 : 1;
        const ox = ((cam.panX % dotSpacing) + dotSpacing) % dotSpacing;
        const oy = ((cam.panY % dotSpacing) + dotSpacing) % dotSpacing;
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.09)';
        for (let x = ox - dotSpacing; x <= w + dotSpacing; x += dotSpacing) {
          for (let y = oy - dotSpacing; y <= h + dotSpacing; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, 6.2832);
            ctx.fill();
          }
        }
        // ── end infinite background ──

        // Apply camera transform: translate then scale
        ctx.translate(cam.panX, cam.panY);
        ctx.scale(cam.zoom, cam.zoom);

        drawRef.current(ctx, {
          time: time / 1000,
          delta: Math.min(delta, 0.1),
          frameCount: frameRef.current,
          width: w,
          height: h,
          camera: { panX: cam.panX, panY: cam.panY, zoom: cam.zoom },
        });
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [resize]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      tabIndex={0}
      aria-label="Interactive cryptographic visualization"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        cursor: camera && 'cursor' in camera ? String(camera.cursor) : 'default',
      }}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    />
  );
}
