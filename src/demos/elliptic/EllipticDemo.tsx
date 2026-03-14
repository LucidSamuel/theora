import { useMemo, useState, useCallback, useEffect } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { ControlGroup, SelectControl, SliderControl, ToggleControl } from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import {
  DEFAULT_CURVE,
  enumerateCurvePoints,
  addPoints,
  scalarMultiply,
  getDefaultGenerator,
  pointLabel,
  pastaCycleSummary,
} from './logic';
import { renderElliptic } from './renderer';

export function EllipticDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const [scalar, setScalar] = useState(5);
  const [showPasta, setShowPasta] = useState(true);
  const points = useMemo(() => enumerateCurvePoints(DEFAULT_CURVE), []);
  const generator = useMemo(() => getDefaultGenerator(DEFAULT_CURVE), []);
  const [pointAIndex, setPointAIndex] = useState(0);
  const [pointBIndex, setPointBIndex] = useState(1);

  const pointA = points[pointAIndex] ?? generator;
  const pointB = points[pointBIndex] ?? generator;
  const sum = useMemo(() => addPoints(pointA, pointB, DEFAULT_CURVE), [pointA, pointB]);
  const scalarResult = useMemo(() => scalarMultiply(pointA, scalar, DEFAULT_CURVE), [pointA, scalar]);
  const pasta = pastaCycleSummary();

  const options = points.slice(0, 80).map((point, index) => ({
    value: String(index),
    label: `${index}: ${pointLabel(point)}`,
  }));

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderElliptic({
      ctx,
      points,
      pointA,
      pointB,
      result: sum,
      scalar,
      scalarSteps: scalarResult.steps,
      theme,
      frame,
    });
  }, [pointA, pointB, points, scalar, scalarResult.steps, sum, theme]);

  useEffect(() => {
    setEntry('elliptic', {
      title: 'Finite-field curve arithmetic',
      body: `A = ${pointLabel(pointA)}, B = ${pointLabel(pointB)}, A + B = ${pointLabel(sum)}. Scalar multiplication currently shows ${scalar}·A = ${pointLabel(scalarResult.result)}.`,
      nextSteps: ['Swap A and B', 'Increase the scalar', 'Compare with the Pasta cycle summary'],
    });
  }, [pointA, pointB, scalar, scalarResult.result, setEntry, sum]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="w-[320px] shrink-0 overflow-y-auto demo-sidebar">
        <ControlGroup label="Point Addition">
          <SelectControl label="Point A" value={String(pointAIndex)} options={options} onChange={(value) => setPointAIndex(Number(value))} />
          <SelectControl label="Point B" value={String(pointBIndex)} options={options} onChange={(value) => setPointBIndex(Number(value))} />
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Finite-field curves are discrete, so this is a schematic line picture over the actual group law.
          </div>
        </ControlGroup>

        <ControlGroup label="Scalar Multiply">
          <SliderControl label="Scalar k" value={scalar} min={2} max={16} step={1} onChange={setScalar} />
          <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
            {scalar}·A = {pointLabel(scalarResult.result)}
          </div>
        </ControlGroup>

        <ControlGroup label="Pasta Cycle">
          <ToggleControl label="Show Cycle Summary" checked={showPasta} onChange={setShowPasta} />
          {showPasta && (
            <div className="space-y-2 text-xs">
              {pasta.map((item) => (
                <div key={item.curve} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-element)' }}>
                  <div style={{ color: 'var(--text-primary)' }}>{item.curve}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{item.field} / scalar {item.scalar}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{item.role}</div>
                </div>
              ))}
            </div>
          )}
        </ControlGroup>
      </div>

      <div className="flex-1 relative min-w-0 overflow-hidden demo-canvas-area">
        <AnimatedCanvas draw={draw} camera={camera} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:elliptic" />
      </div>
    </div>
  );
}
