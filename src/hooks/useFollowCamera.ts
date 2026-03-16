import { useRef, useCallback } from 'react';
import { springStep, type SpringConfig, type SpringState } from '@/lib/animation';
import type { CanvasCamera } from './useCanvasCamera';

const CAMERA_SPRING: SpringConfig = { stiffness: 80, damping: 18, mass: 1.2 };
const SETTLE_POS = 0.5;
const SETTLE_ZOOM = 0.005;
const SETTLE_VEL = 0.5;
const SETTLE_ZOOM_VEL = 0.01;

interface FollowState {
  panX: SpringState;
  panY: SpringState;
  zoom: SpringState;
  active: boolean;
  worldX: number;
  worldY: number;
  canvasW: number;
  canvasH: number;
}

export function useFollowCamera(camera: CanvasCamera) {
  const stateRef = useRef<FollowState>({
    panX: { value: 0, velocity: 0, target: 0 },
    panY: { value: 0, velocity: 0, target: 0 },
    zoom: { value: 1, velocity: 0, target: 1 },
    active: false,
    worldX: 0,
    worldY: 0,
    canvasW: 800,
    canvasH: 600,
  });

  const setTarget = useCallback((worldX: number, worldY: number, zoom: number, canvasW: number, canvasH: number) => {
    const s = stateRef.current;
    s.worldX = worldX;
    s.worldY = worldY;
    s.canvasW = canvasW;
    s.canvasH = canvasH;
    s.zoom.target = zoom;
    // Pan targets are recomputed each frame based on current zoom (see update)
    s.panX.target = canvasW / 2 - worldX * zoom;
    s.panY.target = canvasH / 2 - worldY * zoom;
  }, []);

  const setActive = useCallback((active: boolean) => {
    const s = stateRef.current;
    if (active && !s.active) {
      // Sync spring values from current camera position
      s.panX.value = camera.panX;
      s.panX.velocity = 0;
      s.panY.value = camera.panY;
      s.panY.velocity = 0;
      s.zoom.value = camera.zoom;
      s.zoom.velocity = 0;
    }
    s.active = active;
  }, [camera]);

  const update = useCallback((dt: number) => {
    const s = stateRef.current;
    if (!s.active) return;

    // Step zoom first, then recompute pan targets based on current zoom
    s.zoom = springStep(s.zoom, CAMERA_SPRING, dt);
    const currentZoom = s.zoom.value;
    s.panX.target = s.canvasW / 2 - s.worldX * currentZoom;
    s.panY.target = s.canvasH / 2 - s.worldY * currentZoom;
    s.panX = springStep(s.panX, CAMERA_SPRING, dt);
    s.panY = springStep(s.panY, CAMERA_SPRING, dt);

    camera.setPanZoom(s.panX.value, s.panY.value, s.zoom.value);
  }, [camera]);

  const isSettled = useCallback(() => {
    const s = stateRef.current;
    return (
      Math.abs(s.panX.value - s.panX.target) < SETTLE_POS &&
      Math.abs(s.panY.value - s.panY.target) < SETTLE_POS &&
      Math.abs(s.zoom.value - s.zoom.target) < SETTLE_ZOOM &&
      Math.abs(s.panX.velocity) < SETTLE_VEL &&
      Math.abs(s.panY.velocity) < SETTLE_VEL &&
      Math.abs(s.zoom.velocity) < SETTLE_ZOOM_VEL
    );
  }, []);

  return { setTarget, setActive, update, isSettled, stateRef };
}
