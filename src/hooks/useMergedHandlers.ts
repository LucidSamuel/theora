import type { CanvasInteraction } from './useCanvasInteraction';
import type { CanvasCamera } from './useCanvasCamera';

type AnyHandler = ((...args: any[]) => void) | undefined;

function merge<T extends AnyHandler>(...fns: T[]): T {
  return ((...args: any[]) => {
    for (const fn of fns) {
      fn?.(...args);
    }
  }) as T;
}

/**
 * Merge interaction and camera handlers into a single set for AnimatedCanvas.
 * Camera handlers run first (for pan detection), then interaction handlers.
 */
export function mergeCanvasHandlers(
  interaction: CanvasInteraction,
  camera: CanvasCamera
) {
  return {
    onWheel: camera.handlers.onWheel,
    onMouseMove: merge(camera.handlers.onMouseMove, interaction.handlers.onMouseMove),
    onMouseDown: merge(camera.handlers.onMouseDown, interaction.handlers.onMouseDown),
    onMouseUp: merge(camera.handlers.onMouseUp, interaction.handlers.onMouseUp),
    onMouseLeave: interaction.handlers.onMouseLeave,
    onClick: interaction.handlers.onClick,
    onTouchStart: merge(camera.handlers.onTouchStart, interaction.handlers.onTouchStart),
    onTouchMove: merge(camera.handlers.onTouchMove, interaction.handlers.onTouchMove),
    onTouchEnd: merge(camera.handlers.onTouchEnd, interaction.handlers.onTouchEnd),
  };
}
