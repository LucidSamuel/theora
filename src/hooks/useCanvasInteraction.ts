import { useRef, useCallback, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';

export interface CanvasInteraction {
  mouseX: number;
  mouseY: number;
  isHovering: boolean;
  isPressed: boolean;
  handlers: {
    onMouseMove: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseDown: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave: () => void;
    onClick: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
    onTouchStart: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onTouchMove: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
    onTouchEnd: (e: ReactTouchEvent<HTMLCanvasElement>) => void;
  };
  lastClick: { x: number; y: number } | null;
}

// Use CSS pixel coordinates (not canvas buffer pixels) so they match
// the DPR-scaled drawing context used by AnimatedCanvas.
function getCSSCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function useCanvasInteraction(onClick?: (x: number, y: number) => void): CanvasInteraction {
  // Store coordinates in refs to avoid re-renders on every mouse move.
  // The canvas draw loop reads these via the returned object whose
  // properties are getters backed by the refs.
  const mouseXRef = useRef(0);
  const mouseYRef = useRef(0);
  const isHoveringRef = useRef(false);
  const isPressedRef = useRef(false);
  const lastClickRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCSSCoords(e.currentTarget, e.clientX, e.clientY);
      mouseXRef.current = x;
      mouseYRef.current = y;
      isHoveringRef.current = true;
    },
    [],
  );

  const handleMouseDown = useCallback(() => { isPressedRef.current = true; }, []);
  const handleMouseUp = useCallback(() => { isPressedRef.current = false; }, []);
  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    isPressedRef.current = false;
  }, []);

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCSSCoords(e.currentTarget, e.clientX, e.clientY);
      lastClickRef.current = { x, y };
      onClick?.(x, y);
    },
    [onClick],
  );

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLCanvasElement>) => {
      const touch = e.touches[0];
      if (!touch) return;
      const { x, y } = getCSSCoords(e.currentTarget, touch.clientX, touch.clientY);
      mouseXRef.current = x;
      mouseYRef.current = y;
      isHoveringRef.current = true;
      isPressedRef.current = true;
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLCanvasElement>) => {
      const touch = e.touches[0];
      if (!touch) return;
      const { x, y } = getCSSCoords(e.currentTarget, touch.clientX, touch.clientY);
      mouseXRef.current = x;
      mouseYRef.current = y;
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (_e: ReactTouchEvent<HTMLCanvasElement>) => {
      isPressedRef.current = false;
      // Fire click on touch end at last known position
      if (mouseXRef.current !== 0 || mouseYRef.current !== 0) {
        lastClickRef.current = { x: mouseXRef.current, y: mouseYRef.current };
        onClick?.(mouseXRef.current, mouseYRef.current);
      }
    },
    [onClick],
  );

  // Return an object with getter properties so the draw loop always
  // reads the latest ref values without triggering React re-renders.
  const interactionRef = useRef<CanvasInteraction | null>(null);
  if (!interactionRef.current) {
    interactionRef.current = {
      get mouseX() { return mouseXRef.current; },
      get mouseY() { return mouseYRef.current; },
      get isHovering() { return isHoveringRef.current; },
      get isPressed() { return isPressedRef.current; },
      get lastClick() { return lastClickRef.current; },
      handlers: {
        onMouseMove: handleMouseMove,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseLeave,
        onClick: handleClick,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      },
    };
  }

  // Keep handlers up to date
  interactionRef.current.handlers = {
    onMouseMove: handleMouseMove,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return interactionRef.current;
}
