import { useState, useCallback, type MouseEvent as ReactMouseEvent } from 'react';

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
  };
  lastClick: { x: number; y: number } | null;
}

export function useCanvasInteraction(onClick?: (x: number, y: number) => void): CanvasInteraction {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [lastClick, setLastClick] = useState<{ x: number; y: number } | null>(null);

  const getCanvasCoords = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (e.currentTarget.width / rect.width),
      y: (e.clientY - rect.top) * (e.currentTarget.height / rect.height),
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      setMouseX(x);
      setMouseY(y);
      setIsHovering(true);
    },
    [getCanvasCoords],
  );

  const handleMouseDown = useCallback(() => setIsPressed(true), []);
  const handleMouseUp = useCallback(() => setIsPressed(false), []);
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setIsPressed(false);
  }, []);

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      setLastClick({ x, y });
      onClick?.(x, y);
    },
    [getCanvasCoords, onClick],
  );

  return {
    mouseX,
    mouseY,
    isHovering,
    isPressed,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
    },
    lastClick,
  };
}
