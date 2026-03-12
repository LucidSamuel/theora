import type { CanvasCamera } from '@/hooks/useCanvasCamera';

interface CanvasToolbarProps {
  camera: CanvasCamera;
  className?: string;
}

export function CanvasToolbar({ camera, className }: CanvasToolbarProps) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
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
          View Tools
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
          Wheel or pinch to zoom. Arrow keys pan. <span className="font-mono">0</span> resets.
        </div>
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  title: string;
}

function ToolbarButton({ label, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="app-btn-secondary rounded-lg h-8 text-xs font-medium"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {label}
    </button>
  );
}
