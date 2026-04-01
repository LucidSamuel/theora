import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SelectControl, SliderControl, ToggleControl, ButtonControl, ControlCard, ControlNote, NumberInputControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { SaveToGitHub } from '@/components/shared/SaveToGitHub';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
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
import { buildPairingConfig, demonstrateBilinearity, simulateGroth16Verify, simulateKZGVerify, pairingTable as computePairingTable } from './pairing';
import type { PairingConfig } from './pairing';
import { renderPairing } from './pairingRenderer';

type ActiveTab = 'curves' | 'pairings';
type PairingView = 'bilinearity' | 'table' | 'groth16' | 'kzg';

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

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('curves');

  // Pairing state
  const [pairingA, setPairingA] = useState(2);
  const [pairingB, setPairingB] = useState(3);
  const [pairingView, setPairingView] = useState<PairingView>('bilinearity');

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
      tab?: ActiveTab;
      pairingA?: number;
      pairingB?: number;
      pairingView?: PairingView;
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
      tab?: ActiveTab;
      pairingA?: number;
      pairingB?: number;
      pairingView?: PairingView;
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
    if (payload.tab === 'curves' || payload.tab === 'pairings') setActiveTab(payload.tab);
    if (typeof payload.pairingA === 'number') setPairingA(payload.pairingA);
    if (typeof payload.pairingB === 'number') setPairingB(payload.pairingB);
    if (payload.pairingView === 'bilinearity' || payload.pairingView === 'table' || payload.pairingView === 'groth16' || payload.pairingView === 'kzg') {
      setPairingView(payload.pairingView);
    }
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

  // ── Pairing computed state ────────────────────────────────────────────────
  const pairingConfig = useMemo<PairingConfig | null>(() => {
    try { return buildPairingConfig(curve); } catch { return null; }
  }, [curve]);

  const bilinearityResult = useMemo(() => {
    if (!pairingConfig) return null;
    return demonstrateBilinearity(pairingConfig, pairingA, pairingB);
  }, [pairingConfig, pairingA, pairingB]);

  const groth16Result = useMemo(() => {
    if (!pairingConfig) return null;
    return simulateGroth16Verify(pairingConfig);
  }, [pairingConfig]);

  const kzgResult = useMemo(() => {
    if (!pairingConfig) return null;
    return simulateKZGVerify(pairingConfig);
  }, [pairingConfig]);

  const pairingTableData = useMemo(() => {
    if (!pairingConfig || pairingView !== 'table') return null;
    return computePairingTable(pairingConfig);
  }, [pairingConfig, pairingView]);

  const updateCurveParam = useCallback((key: keyof CurveConfig, value: number) => {
    setCurveError(null);
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
      setCurveError('Singular curve (4a\u00b3 + 27b\u00b2 \u2261 0 mod p)');
      return;
    }
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
    if (activeTab === 'curves') {
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
    } else {
      const verEq = pairingView === 'groth16' ? groth16Result : pairingView === 'kzg' ? kzgResult : null;
      renderPairing(ctx, frame, {
        config: pairingConfig,
        bilinearityDemo: bilinearityResult,
        pairingTableData,
        verificationEq: verEq,
        view: pairingView,
      }, theme);
    }
  }, [activeTab, pointA, pointB, points, scalar, scalarResult.steps, sum, theme, curve, pairingConfig, bilinearityResult, pairingTableData, pairingView, groth16Result, kzgResult]);

  const buildShareState = useCallback(() => ({
    a: curve.a,
    b: curve.b,
    p: curve.p,
    pointAIndex,
    pointBIndex,
    scalar,
    showPasta,
    tab: activeTab,
    pairingA,
    pairingB,
    pairingView,
  }), [curve.a, curve.b, curve.p, pointAIndex, pointBIndex, scalar, showPasta, activeTab, pairingA, pairingB, pairingView]);

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
    showToast('Hash URL copied', 'State is encoded in the fragment \u2014 no server needed');
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
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-elliptic.png', showDownloadToast);
  };

  const handleCopyAuditSummary = () => {
    const payload: Record<string, unknown> = {
      demo: 'elliptic',
      timestamp: new Date().toISOString(),
      curve: { a: curve.a, b: curve.b, p: curve.p },
      pointCount: points.length,
      tab: activeTab,
    };
    if (activeTab === 'curves') {
      payload.pointA = pointLabel(pointA);
      payload.pointB = pointLabel(pointB);
      payload.sum = pointLabel(sum);
      payload.scalar = scalar;
      payload.scalarResult = pointLabel(scalarResult.result);
      payload.showPasta = showPasta;
    } else {
      payload.pairingView = pairingView;
      payload.pairingA = pairingA;
      payload.pairingB = pairingB;
      if (pairingConfig) {
        payload.groupOrder = pairingConfig.groupOrder;
        payload.generator = pointLabel(pairingConfig.generator);
      }
      if (bilinearityResult) {
        payload.bilinearityHolds = bilinearityResult.bilinearityHolds;
        payload.eaPbQ = bilinearityResult.eaPbQ;
        payload.ePQab = bilinearityResult.ePQab;
      }
    }
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', activeTab === 'curves' ? 'Curve parameters, points & arithmetic results' : 'Pairing configuration & bilinearity results');
  };

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    fitCameraToBounds(camera, canvas, {
      minX: 48,
      minY: 24,
      maxX: width - 24,
      maxY: height - 24,
    }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  useEffect(() => {
    if (activeTab === 'curves') {
      setEntry('elliptic', {
        title: 'Finite-field curve arithmetic',
        body: `y\u00b2 = x\u00b3 + ${curve.a}x + ${curve.b} (mod ${curve.p}). ${points.length} points. A = ${pointLabel(pointA)}, B = ${pointLabel(pointB)}, A + B = ${pointLabel(sum)}. ${scalar}\u00b7A = ${pointLabel(scalarResult.result)}.`,
        nextSteps: ['Change curve parameters', 'Try a preset curve', 'Switch to Pairings tab'],
      });
    } else {
      const configInfo = pairingConfig
        ? `Order ${pairingConfig.groupOrder}, G = ${pointLabel(pairingConfig.generator)}.`
        : 'No valid pairing config.';
      const viewInfo = pairingView === 'bilinearity' && bilinearityResult
        ? ` e(${pairingA}P, ${pairingB}Q) = ${bilinearityResult.eaPbQ}, e(P,Q)^(${pairingA * pairingB}) = ${bilinearityResult.ePQab}. ${bilinearityResult.bilinearityHolds ? 'Holds.' : 'Broken!'}`
        : pairingView === 'table'
          ? ' Showing full pairing table.'
          : pairingView === 'groth16' && groth16Result
            ? ` Groth16: ${groth16Result.holds ? 'passes' : 'fails'}.`
            : pairingView === 'kzg' && kzgResult
              ? ` KZG: ${kzgResult.holds ? 'passes' : 'fails'}.`
              : '';
      setEntry('elliptic', {
        title: 'Bilinear pairings',
        body: `${configInfo}${viewInfo}`,
        nextSteps: ['Adjust a and b scalars', 'Try Groth16 or KZG verification', 'View the pairing table'],
      });
    }
  }, [activeTab, pointA, pointB, scalar, scalarResult.result, setEntry, sum, curve, points.length, pairingConfig, pairingView, pairingA, pairingB, bilinearityResult, groth16Result, kzgResult]);

  const handleResetAll = useCallback(() => {
    setCurve(DEFAULT_CURVE);
    setCurveError(null);
    setPointAIndex(0);
    setPointBIndex(1);
    setScalar(5);
    setShowPasta(true);
    setActiveTab('curves');
    setPairingA(2);
    setPairingB(3);
    setPairingView('bilinearity');
    showToast('Reset to defaults');
  }, []);

  return (
    <DemoLayout
      onEmbedReset={() => { handleResetAll(); }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* ── Tab selector ──────────────────────────────────────────────── */}
        <div className="control-choice-list" style={{ flexDirection: 'row', gap: 0 }}>
          <button
            className={`control-choice-button ${activeTab === 'curves' ? 'is-active' : ''}`}
            style={{ textAlign: 'center' }}
            onClick={() => setActiveTab('curves')}
          >
            Curves
          </button>
          <button
            className={`control-choice-button ${activeTab === 'pairings' ? 'is-active' : ''}`}
            style={{ textAlign: 'center' }}
            onClick={() => setActiveTab('pairings')}
          >
            Pairings
          </button>
        </div>

        {/* ── Curve Parameters (shared between tabs) ───────────────────── */}
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

        {/* ── Curves tab controls ──────────────────────────────────────── */}
        {activeTab === 'curves' && (
          <>
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
          </>
        )}

        {/* ── Pairings tab controls ────────────────────────────────────── */}
        {activeTab === 'pairings' && (
          <>
            {pairingConfig && (
              <ControlGroup label="Pairing Config">
                <ControlCard>
                  <span className="control-kicker">Generator</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    G = {pointLabel(pairingConfig.generator)}
                  </div>
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">Group Order</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    n = {pairingConfig.groupOrder}
                  </div>
                  <div className="control-caption">
                    Subgroup of {points.length} curve points
                  </div>
                </ControlCard>
              </ControlGroup>
            )}

            <ControlGroup label="View">
              <SelectControl
                label="Visualization"
                value={pairingView}
                options={[
                  { value: 'bilinearity', label: 'Bilinearity Explorer' },
                  { value: 'table', label: 'Pairing Table' },
                  { value: 'groth16', label: 'Groth16 Verification' },
                  { value: 'kzg', label: 'KZG Verification' },
                ]}
                onChange={(v) => setPairingView(v as PairingView)}
              />
            </ControlGroup>

            {pairingView === 'bilinearity' && (
              <ControlGroup label="Bilinearity Explorer">
                <SliderControl label="Scalar a" value={pairingA} min={1} max={10} step={1} onChange={setPairingA} editable />
                <SliderControl label="Scalar b" value={pairingB} min={1} max={10} step={1} onChange={setPairingB} editable />
                {bilinearityResult && (
                  <>
                    <ControlCard>
                      <span className="control-kicker">e(aP, bQ)</span>
                      <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                        = {bilinearityResult.eaPbQ}
                      </div>
                    </ControlCard>
                    <ControlCard>
                      <span className="control-kicker">e(P,Q)^(ab)</span>
                      <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                        = {bilinearityResult.ePQab}
                      </div>
                    </ControlCard>
                    <ControlNote tone={bilinearityResult.bilinearityHolds ? 'success' : 'error'}>
                      {bilinearityResult.bilinearityHolds
                        ? 'Bilinearity property holds: e(aP, bQ) = e(P, Q)^(ab)'
                        : 'Bilinearity broken!'}
                    </ControlNote>
                  </>
                )}
              </ControlGroup>
            )}

            {pairingView === 'table' && pairingConfig && (
              <ControlGroup label="Pairing Table">
                <ControlNote>
                  Full {pairingConfig.groupOrder} x {pairingConfig.groupOrder} table showing e(iG, jG) values for all scalar multiples.
                </ControlNote>
              </ControlGroup>
            )}

            {pairingView === 'groth16' && groth16Result && (
              <ControlGroup label="Groth16 Verification">
                <ControlCard>
                  <span className="control-kicker">Equation</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {groth16Result.description}
                  </div>
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">LHS</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    {groth16Result.lhsValue}
                  </div>
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">RHS</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    {groth16Result.rhsValue}
                  </div>
                </ControlCard>
                <ControlNote tone={groth16Result.holds ? 'success' : 'error'}>
                  {groth16Result.holds ? 'Verification passes' : 'Verification fails \u2014 pairing mismatch'}
                </ControlNote>
              </ControlGroup>
            )}

            {pairingView === 'kzg' && kzgResult && (
              <ControlGroup label="KZG Verification">
                <ControlCard>
                  <span className="control-kicker">Equation</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {kzgResult.description}
                  </div>
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">LHS</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    {kzgResult.lhsValue}
                  </div>
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">RHS</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    {kzgResult.rhsValue}
                  </div>
                </ControlCard>
                <ControlNote tone={kzgResult.holds ? 'success' : 'error'}>
                  {kzgResult.holds ? 'Verification passes' : 'Verification fails \u2014 pairing mismatch'}
                </ControlNote>
              </ControlGroup>
            )}

            {!pairingConfig && (
              <ControlNote tone="error">
                Could not build a pairing config for this curve. Try a different curve or preset.
              </ControlNote>
            )}
          </>
        )}

        <ButtonControl label="Reset to Defaults" onClick={handleResetAll} variant="secondary" />

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <SaveToGitHub demoId="elliptic" />
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
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:elliptic" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Elliptic Curves" />
    </DemoLayout>
  );
}
