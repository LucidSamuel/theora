import { useEffect, useRef, useState } from 'react';
import { MousePointer2, Hand, ZoomIn, ZoomOut, RotateCcw, GripHorizontal } from 'lucide-react';
import type { CanvasCamera } from '@/hooks/useCanvasCamera';

interface CanvasToolbarProps {
  camera: CanvasCamera;
  className?: string;
  storageKey?: string;
  /** Override default reset to fit content into view */
  onReset?: () => void;
}

export function CanvasToolbar({ camera, className, storageKey, onReset }: CanvasToolbarProps) {
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
        zIndex: 2,
      }}
    >
      <div className="canvas-toolbar">
        {/* Drag handle */}
        <div
          className="canvas-toolbar-handle"
          onPointerDown={(event) => {
            dragStateRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              baseX: offset.x,
              baseY: offset.y,
            };
          }}
          aria-label="Drag to reposition"
        >
          <GripHorizontal size={12} />
        </div>

        {/* Mode tools */}
        <div className="canvas-toolbar-group">
          <ToolbarBtn
            icon={<MousePointer2 size={14} />}
            onClick={() => camera.setMode('inspect')}
            title="Select"
            active={camera.mode === 'inspect'}
            shortcut="V"
          />
          <ToolbarBtn
            icon={<Hand size={14} />}
            onClick={() => camera.setMode('pan')}
            title="Pan"
            active={camera.mode === 'pan'}
            shortcut="H"
          />
        </div>

        <div className="canvas-toolbar-divider" />

        {/* Zoom tools */}
        <div className="canvas-toolbar-group">
          <ToolbarBtn
            icon={<ZoomIn size={14} />}
            onClick={() => camera.zoomBy(1.2)}
            title="Zoom in"
            shortcut="+"
          />
          <ToolbarBtn
            icon={<ZoomOut size={14} />}
            onClick={() => camera.zoomBy(1 / 1.2)}
            title="Zoom out"
            shortcut="-"
          />
        </div>

        <div className="canvas-toolbar-divider" />

        {/* Reset */}
        <ToolbarBtn
          icon={<RotateCcw size={14} />}
          onClick={() => (onReset ?? camera.reset)()}
          title="Reset view"
          shortcut="0"
        />
      </div>
    </div>
  );
}

interface ToolbarBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  shortcut?: string;
}

function ToolbarBtn({ icon, onClick, title, active = false, shortcut }: ToolbarBtnProps) {
  const fullTitle = shortcut ? `${title} (${shortcut})` : title;
  return (
    <button
      type="button"
      className={`canvas-toolbar-btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      title={fullTitle}
      aria-label={fullTitle}
      aria-pressed={active}
    >
      {icon}
      {shortcut && (
        <span className="canvas-toolbar-shortcut">{shortcut}</span>
      )}
    </button>
  );
}
