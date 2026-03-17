import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SelectControl, SliderControl, ToggleControl, ButtonControl, ControlCard, ControlNote, NumberInputControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
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
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'elliptic' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      a?: number;
      b?: number;
      p?: number;
      pointAIndex?: number;
      pointBIndex?: number;
      scalar?: number;
      showPasta?: boolean;
    }>(rawHash);
    const raw = decodedHash ? null : getSearchParam('e');
    const decoded = decodeState<{
      a?: number;
      b?: number;
      p?: number;
      pointAIndex?: number;
      pointBIndex?: number;
      scalar?: number;
      showPasta?: boolean;
    }>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.a === 'number' && typeof payload.b === 'number' && typeof payload.p === 'number') {
      const next = { a: payload.a, b: payload.b, p: payload.p };
      if (isCurveValid(next)) setCurve(next);
    }
    if (typeof payload.pointAIndex === 'number') setPointAIndex(payload.pointAIndex);
    if (typeof payload.pointBIndex === 'number') setPointBIndex(payload.pointBIndex);
    if (typeof payload.scalar === 'number') setScalar(payload.scalar);
    if (typeof payload.showPasta === 'boolean') setShowPasta(payload.showPasta);
  }, []);

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

  const buildShareState = useCallback(() => ({
    a: curve.a,
    b: curve.b,
    p: curve.p,
    pointAIndex,
    pointBIndex,
    scalar,
    showPasta,
  }), [curve.a, curve.b, curve.p, pointAIndex, pointBIndex, scalar, showPasta]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'elliptic') return;
    setSearchParams({ e: encodeState(buildShareState()) });
  }, [buildShareState]);

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('e');
    url.hash = `elliptic|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'elliptic');
    url.searchParams.set('e', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-elliptic.png';
    a.click();
    showDownloadToast('theora-elliptic.png');
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'elliptic',
      timestamp: new Date().toISOString(),
      curve: { a: curve.a, b: curve.b, p: curve.p },
      pointCount: points.length,
      pointA: pointLabel(pointA),
      pointB: pointLabel(pointB),
      sum: pointLabel(sum),
      scalar,
      scalarResult: pointLabel(scalarResult.result),
      showPasta,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Curve parameters, points & arithmetic results');
  };

  useEffect(() => {
    setEntry('elliptic', {
      title: 'Finite-field curve arithmetic',
      body: `y² = x³ + ${curve.a}x + ${curve.b} (mod ${curve.p}). ${points.length} points. A = ${pointLabel(pointA)}, B = ${pointLabel(pointB)}, A + B = ${pointLabel(sum)}. ${scalar}·A = ${pointLabel(scalarResult.result)}.`,
      nextSteps: ['Change curve parameters', 'Try a preset curve', 'Swap A and B'],
    });
  }, [pointA, pointB, scalar, scalarResult.result, setEntry, sum, curve, points.length]);

  return (
    <DemoLayout
      onEmbedReset={() => { setCurve(DEFAULT_CURVE); setCurveError(null); setPointAIndex(0); setPointBIndex(1); setScalar(5); setShowPasta(true); }}
      onEmbedFitToView={() => camera.reset()}
    >
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

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <div className="control-button-grid">
            <ButtonControl label="Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Embed" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Audit JSON" onClick={handleCopyAuditSummary} variant="secondary" />
          </div>
        </ControlGroup>
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:elliptic" />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Elliptic Curves" />
    </DemoLayout>
  );
}
