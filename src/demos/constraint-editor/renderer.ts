/**
 * Constraint editor canvas rendering — a thin wrapper over the shared
 * circuit graph renderer, plus empty/error states for unparsable source.
 */

import type { FrameInfo } from '@/components/shared/AnimatedCanvas';
import { renderDebugGraph, hitTest, type DebugRenderState } from '@/lib/circuitGraph/renderer';
import type { EditorPipeline } from './logic';

export { hitTest };
export type { DebugRenderState };

export interface EditorRenderState {
  pipeline: EditorPipeline;
  selectedWire: number | null;
  selectedConstraint: number | null;
  hoveredElement: { type: 'wire' | 'constraint'; id: number } | null;
}

export function renderEditor(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  state: EditorRenderState,
  theme: 'dark' | 'light',
): void {
  const { pipeline } = state;
  const { compilation, layout } = pipeline;

  if (!compilation?.success || !layout) {
    const rect = ctx.canvas.getBoundingClientRect();
    ctx.fillStyle = theme === 'dark' ? '#71717a' : '#a1a1aa';
    ctx.font = '12px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const message = pipeline.parseResult.success
      ? 'Circuit does not compile — see the errors in the sidebar.'
      : 'Waiting for a valid circuit — fix the parse errors to see the graph.';
    ctx.fillText(message, rect.width / 2, rect.height / 2);
    return;
  }

  renderDebugGraph(
    ctx,
    frame,
    {
      compilation,
      witness: pipeline.witness,
      checks: pipeline.checks,
      failureTrace: pipeline.failureTrace,
      analysis: pipeline.analysis,
      selectedWire: state.selectedWire,
      selectedConstraint: state.selectedConstraint,
      hoveredElement: state.hoveredElement,
      layout,
    },
    theme,
  );
}
