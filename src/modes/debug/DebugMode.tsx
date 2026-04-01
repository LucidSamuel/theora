import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { DemoId } from '@/types';
import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { AnimatedCanvas } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { getSearchParam } from '@/lib/urlState';
import { DebugProvider, useDebug } from './DebugProvider';
import { DebugPanel } from './DebugPanel';
import { renderDebugGraph, hitTest, type DebugRenderState } from './renderer';

interface DebugModeProps {
  activeDemo: DemoId;
  children: ReactNode;
}

export function DebugMode({ activeDemo, children }: DebugModeProps) {
  const isEmbed = !!getSearchParam('embed');

  return (
    <DebugProvider activeDemo={activeDemo}>
      <div className="flex h-full w-full overflow-hidden">
        {/* Debug sidebar — hidden in embed mode and on mobile */}
        {!isEmbed && (
          <aside
            className="hidden md:flex flex-col h-full border-r shrink-0"
            style={{
              borderColor: 'var(--border)',
              width: 280,
              backgroundColor: 'var(--bg-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <DebugPanel activeDemo={activeDemo} />
          </aside>
        )}

        {/* Canvas area — show constraint graph for circuit, or demo canvas for others */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {activeDemo === 'circuit' ? (
            <DebugCanvas />
          ) : (
            children
          )}
        </div>
      </div>
    </DebugProvider>
  );
}

function DebugCanvas() {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const {
    compilation, witness, checks, failureTrace, layout,
    selectedWire, setSelectedWire,
    selectedConstraint, setSelectedConstraint,
    hoveredElement, setHoveredElement,
    _canvasEl, _camera, _fitToView,
  } = useDebug();

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    if (!compilation || !witness || !checks || !layout) return;

    const state: DebugRenderState = {
      compilation,
      witness,
      checks,
      failureTrace,
      selectedWire,
      selectedConstraint,
      hoveredElement,
      layout,
    };

    renderDebugGraph(ctx, frame, state, theme);
  }, [compilation, witness, checks, failureTrace, layout, selectedWire, selectedConstraint, hoveredElement, theme]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas || !layout) return;
    fitCameraToBounds(camera, canvas, layout.bounds, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera, layout]);

  // Register canvas/camera/fitToView for PNG export from DebugPanel
  useEffect(() => {
    _camera.current = camera;
    _fitToView.current = handleFitToView;
  });

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!layout || !canvasElRef.current) return;
    const rect = canvasElRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x: canvasX, y: canvasY } = camera.toWorld(screenX, screenY);

    const hit = hitTest(layout, canvasX, canvasY);
    setHoveredElement(hit);

    mergedHandlers.onMouseMove?.(e);
  }, [layout, camera, setHoveredElement, mergedHandlers]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!layout || !canvasElRef.current) return;
    if (!camera.shouldHandleClick()) return;
    const rect = canvasElRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x: canvasX, y: canvasY } = camera.toWorld(screenX, screenY);

    const hit = hitTest(layout, canvasX, canvasY);
    if (hit?.type === 'wire') {
      setSelectedWire(selectedWire === hit.id ? null : hit.id);
      setSelectedConstraint(null);
    } else if (hit?.type === 'constraint') {
      setSelectedConstraint(selectedConstraint === hit.id ? null : hit.id);
      setSelectedWire(null);
    } else {
      setSelectedWire(null);
      setSelectedConstraint(null);
    }
  }, [layout, camera, selectedWire, selectedConstraint, setSelectedWire, setSelectedConstraint]);

  return (
    <div className="relative w-full h-full">
      <AnimatedCanvas
        draw={draw}
        camera={camera}
        onCanvas={(c) => { canvasElRef.current = c; _canvasEl.current = c; }}
        {...mergedHandlers}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      <CanvasToolbar camera={camera} storageKey="theora:toolbar:debug" onReset={handleFitToView} />
    </div>
  );
}
