import { useRef, useEffect, useCallback } from 'react';

export interface FrameInfo {
  time: number;
  delta: number;
  frameCount: number;
  width: number;
  height: number;
}

interface AnimatedCanvasProps {
  draw: (ctx: CanvasRenderingContext2D, frame: FrameInfo) => void;
  className?: string;
  onCanvas?: (canvas: HTMLCanvasElement) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave?: () => void;
  onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove?: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLCanvasElement>) => void;
}

export function AnimatedCanvas({
  draw, className, onCanvas,
  onMouseMove, onMouseDown, onMouseUp, onMouseLeave, onClick,
  onTouchStart, onTouchMove, onTouchEnd,
}: AnimatedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef = useRef(window.devicePixelRatio || 1);

  drawRef.current = draw;

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

        ctx.save();
        // Reset transform each frame so draw callbacks can't permanently lose DPR scale
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        drawRef.current(ctx, {
          time: time / 1000,
          delta: Math.min(delta, 0.1),
          frameCount: frameRef.current,
          width: w,
          height: h,
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
