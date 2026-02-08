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
}

export function AnimatedCanvas({ draw, className, onCanvas, onMouseMove, onMouseDown, onMouseUp, onMouseLeave, onClick }: AnimatedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  drawRef.current = draw;

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    resize();

    const canvas = canvasRef.current;
    if (!canvas) return;
    onCanvas?.(canvas);
    const parent = canvas.parentElement;

    const ro = new ResizeObserver(() => resize());
    if (parent) ro.observe(parent);

    const animate = (time: number) => {
      const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = time;
      frameRef.current++;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        ctx.save();
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
      style={{ display: 'block', width: '100%', height: '100%' }}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    />
  );
}
