import { useEffect, useRef, useState } from 'react';
import type { CanvasCamera } from '@/hooks/useCanvasCamera';

interface CanvasToolbarProps {
  camera: CanvasCamera;
  className?: string;
  storageKey?: string;
}

export function CanvasToolbar({ camera, className, storageKey }: CanvasToolbarProps) {
  const [offset, setOffset] = useState(() => {
    if (!storageKey || typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { x: 0, y: 0 };
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      return {
        x: typeof parsed.x === 'number' ? parsed.x : 0,
        y: typeof parsed.y === 'number' ? parsed.y : 0,
      };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(offset));
  }, [offset, storageKey]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      setOffset({
        x: drag.baseX + (event.clientX - drag.startX),
        y: drag.baseY + (event.clientY - drag.startY),
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 2,
      }}
    >
      <div
        className="rounded-xl border panel-surface"
        style={{
          borderColor: 'var(--border)',
          padding: 8,
          width: 132,
          boxShadow: '0 10px 28px rgba(10, 8, 6, 0.18)',
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          <div
            onPointerDown={(event) => {
              dragStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                baseX: offset.x,
                baseY: offset.y,
              };
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
            aria-label="Drag view tools"
          >
            <span>View Tools</span>
            <span style={{ fontSize: 11, opacity: 0.65 }}>::</span>
          </div>
        </div>
        <div className="mb-2 flex gap-1.5">
          <ToolbarButton
            label="↖"
            onClick={() => camera.setMode('inspect')}
            title="Inspect mode"
            active={camera.mode === 'inspect'}
          />
          <ToolbarButton
            label="✋"
            onClick={() => camera.setMode('pan')}
            title="Hand pan mode"
            active={camera.mode === 'pan'}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <ToolbarButton label="+" onClick={() => camera.zoomBy(1.15)} title="Zoom in" />
          <ToolbarButton label="0" onClick={() => camera.reset()} title="Reset view" />
          <ToolbarButton label="-" onClick={() => camera.zoomBy(1 / 1.15)} title="Zoom out" />
          <ToolbarButton label="←" onClick={() => camera.panBy(30, 0)} title="Pan left" />
          <ToolbarButton label="↑" onClick={() => camera.panBy(0, 30)} title="Pan up" />
          <ToolbarButton label="→" onClick={() => camera.panBy(-30, 0)} title="Pan right" />
          <ToolbarButton label="·" onClick={() => camera.reset()} title="Center view" />
          <ToolbarButton label="↓" onClick={() => camera.panBy(0, -30)} title="Pan down" />
          <div className="flex items-center justify-center text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            pan
          </div>
        </div>
        <div className="mt-2 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Drag header · Scroll to zoom · <span className="font-mono">0</span> resets
        </div>
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  title: string;
  active?: boolean;
}

function ToolbarButton({ label, onClick, title, active = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="app-btn-secondary rounded-lg h-8 text-xs font-medium"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={active ? { background: 'var(--button-bg-strong)', color: 'var(--text-primary)' } : undefined}
    >
      {label}
    </button>
  );
}
