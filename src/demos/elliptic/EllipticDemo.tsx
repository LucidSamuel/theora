import { useMemo, useState, useCallback, useEffect } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SelectControl, SliderControl, ToggleControl, ControlCard, ControlNote, NumberInputControl } from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import type { CurveConfig } from './logic';
import {
  DEFAULT_CURVE,
  PRESET_CURVES,
  enumerateCurvePoints,
  addPoints,
  scalarMultiply,
  pointLabel,
  pastaCycleSummary,
  isPrime,
  isCurveValid,
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
  const [curve, setCurve] = useState<CurveConfig>(DEFAULT_CURVE);
  const [curveError, setCurveError] = useState<string | null>(null);
  const [pointAIndex, setPointAIndex] = useState(0);
  const [pointBIndex, setPointBIndex] = useState(1);

  const points = useMemo(() => enumerateCurvePoints(curve), [curve]);
  const generator = points[0] ?? null;

  // Reset point indices when curve changes and points list shrinks
  useEffect(() => {
    if (pointAIndex >= points.length) setPointAIndex(0);
    if (pointBIndex >= points.length) setPointBIndex(Math.min(1, points.length - 1));
  }, [points.length, pointAIndex, pointBIndex]);

  const pointA = points[pointAIndex] ?? generator;
  const pointB = points[pointBIndex] ?? generator;
  const sum = useMemo(() => addPoints(pointA, pointB, curve), [pointA, pointB, curve]);
  const scalarResult = useMemo(() => scalarMultiply(pointA, scalar, curve), [pointA, scalar, curve]);
  const pasta = pastaCycleSummary();

  const options = points.slice(0, 80).map((point, index) => ({
    value: String(index),
    label: `${index}: ${pointLabel(point)}`,
  }));

  const updateCurveParam = useCallback((key: keyof CurveConfig, value: number) => {
    const next = { ...curve, [key]: value };
    if (key === 'p') {
      if (!isPrime(value)) {
        setCurveError(`${value} is not prime`);
        return;
      }
      if (value < 3 || value > 997) {
        setCurveError('p must be between 3 and 997');
        return;
      }
    }
    if (!isCurveValid(next)) {
      setCurveError('Singular curve (4a³ + 27b² ≡ 0 mod p)');
      return;
    }
    setCurveError(null);
    setCurve(next);
    setPointAIndex(0);
    setPointBIndex(1);
  }, [curve]);

  const loadPreset = useCallback((index: number) => {
    const preset = PRESET_CURVES[index];
    if (!preset) return;
    setCurve(preset.config);
    setCurveError(null);
    setPointAIndex(0);
    setPointBIndex(1);
  }, []);

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
      curve,
    });
  }, [pointA, pointB, points, scalar, scalarResult.steps, sum, theme, curve]);

  useEffect(() => {
    setEntry('elliptic', {
      title: 'Finite-field curve arithmetic',
      body: `y² = x³ + ${curve.a}x + ${curve.b} (mod ${curve.p}). ${points.length} points. A = ${pointLabel(pointA)}, B = ${pointLabel(pointB)}, A + B = ${pointLabel(sum)}. ${scalar}·A = ${pointLabel(scalarResult.result)}.`,
      nextSteps: ['Change curve parameters', 'Try a preset curve', 'Swap A and B'],
    });
  }, [pointA, pointB, scalar, scalarResult.result, setEntry, sum, curve, points.length]);

  return (
    <DemoLayout>
      <DemoSidebar>
        <ControlGroup label="Curve Parameters">
          <SelectControl
            label="Preset"
            value={String(PRESET_CURVES.findIndex((p) => p.config.p === curve.p && p.config.a === curve.a && p.config.b === curve.b))}
            options={PRESET_CURVES.map((p, i) => ({ value: String(i), label: p.label }))}
            onChange={(v) => loadPreset(Number(v))}
          />
          <NumberInputControl label="a" value={curve.a} min={0} max={999} onChange={(v) => updateCurveParam('a', v)} />
          <NumberInputControl label="b" value={curve.b} min={0} max={999} onChange={(v) => updateCurveParam('b', v)} />
          <NumberInputControl label="p (field size, prime)" value={curve.p} min={3} max={997} onChange={(v) => updateCurveParam('p', v)} />
          {curveError && <ControlNote tone="error">{curveError}</ControlNote>}
          <ControlNote>
            {points.length} points on y² = x³ + {curve.a}x + {curve.b} (mod {curve.p})
          </ControlNote>
        </ControlGroup>

        <ControlGroup label="Point Addition">
          <SelectControl label="Point A" value={String(pointAIndex)} options={options} onChange={(value) => setPointAIndex(Number(value))} />
          <SelectControl label="Point B" value={String(pointBIndex)} options={options} onChange={(value) => setPointBIndex(Number(value))} />
          <ControlCard>
            <span className="control-kicker">Sum</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              A + B = {pointLabel(sum)}
            </div>
          </ControlCard>
        </ControlGroup>

        <ControlGroup label="Scalar Multiply">
          <SliderControl label="Scalar k" value={scalar} min={2} max={16} step={1} onChange={setScalar} editable />
          <ControlCard>
            <span className="control-kicker">Current result</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              {scalar}·A = {pointLabel(scalarResult.result)}
            </div>
          </ControlCard>
        </ControlGroup>

        <ControlGroup label="Pasta Cycle">
          <ToggleControl label="Show Cycle Summary" checked={showPasta} onChange={setShowPasta} />
          {showPasta && (
            <div className="control-choice-list">
              {pasta.map((item) => (
                <ControlCard key={item.curve}>
                  <span className="control-kicker">{item.curve}</span>
                  <div className="control-value">{item.field} / scalar {item.scalar}</div>
                  <div className="control-caption">{item.role}</div>
                </ControlCard>
              ))}
            </div>
          )}
        </ControlGroup>
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:elliptic" />
      </DemoCanvasArea>
    </DemoLayout>
  );
}
