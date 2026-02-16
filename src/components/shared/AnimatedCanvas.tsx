import { useRef, useEffect, useCallback } from 'react';

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
}

const DEFAULT_CAMERA: CameraState = { panX: 0, panY: 0, zoom: 1 };

export function AnimatedCanvas({
  draw, className, camera, onCanvas,
  onWheel, onMouseMove, onMouseDown, onMouseUp, onMouseLeave, onClick,
  onTouchStart, onTouchMove, onTouchEnd,
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
      aria-label="Interactive cryptographic visualization"
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
}
