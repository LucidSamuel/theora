import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, TextInput, ButtonControl, NumberInputControl, ControlCard, ControlNote } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
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
import { analyzeLookup, parseNumberList } from './logic';
import { renderLookup } from './renderer';
import { logUpCheck, type LogUpResult } from './logup';
import { renderLogUp, type LogUpRenderState } from './logupRenderer';

type LookupView = 'multiset' | 'logup';

const DEFAULT_LOGUP = {
  tableValues: [1n, 2n, 3n, 4n, 5n],
  wireValues: [2n, 3n, 3n, 5n, 1n, 2n],
  beta: 17n,
  fieldSize: 101n,
};

interface LookupShareState {
  table?: string;
  wires?: string;
  view?: LookupView;
  logupTable?: string;
  logupWires?: string;
  logupBeta?: number;
  logupFieldSize?: number;
  logupComputed?: boolean;
  logupActiveStep?: number;
}

function bigintListToString(values: bigint[]): string {
  return values.map(String).join(',');
}

function parseBigIntList(input: string): bigint[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try { return BigInt(s); } catch { return null; }
    })
    .filter((v): v is bigint => v !== null);
}

function clampLogUpStep(value: number | undefined, maxIndex: number): number {
  if (maxIndex < 0) return -1;
  if (typeof value !== 'number' || Number.isNaN(value)) return maxIndex;
  return Math.max(0, Math.min(value, maxIndex));
}

export function LookupDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();

  // ── view tab ────────────────────────────────────────────
  const [view, setView] = useState<LookupView>('multiset');

  // ── multiset state ──────────────────────────────────────
  const [tableInput, setTableInput] = useState('1,2,3,5,8,13');
  const [wireInput, setWireInput] = useState('2,5,8');

  // ── logup state ─────────────────────────────────────────
  const [logupTableInput, setLogupTableInput] = useState(bigintListToString(DEFAULT_LOGUP.tableValues));
  const [logupWireInput, setLogupWireInput] = useState(bigintListToString(DEFAULT_LOGUP.wireValues));
  const [logupBeta, setLogupBeta] = useState(Number(DEFAULT_LOGUP.beta));
  const [logupFieldSize, setLogupFieldSize] = useState(Number(DEFAULT_LOGUP.fieldSize));
  const [logupResult, setLogupResult] = useState<LogUpResult | null>(null);
  const [logupActiveStep, setLogupActiveStep] = useState(-1);

  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // ── URL state restore ───────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'lookup' ? hashState.state : null;
    const decodedHash = decodeStatePlain<LookupShareState>(rawHash);
    const raw = decodedHash ? null : getSearchParam('l');
    const decoded = decodeState<LookupShareState>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.table === 'string') setTableInput(payload.table);
    if (typeof payload.wires === 'string') setWireInput(payload.wires);
    if (payload.view === 'multiset' || payload.view === 'logup') setView(payload.view);
    if (typeof payload.logupTable === 'string') setLogupTableInput(payload.logupTable);
    if (typeof payload.logupWires === 'string') setLogupWireInput(payload.logupWires);
    if (typeof payload.logupBeta === 'number') setLogupBeta(payload.logupBeta);
    if (typeof payload.logupFieldSize === 'number') setLogupFieldSize(payload.logupFieldSize);

    if (payload.view === 'logup' && payload.logupComputed) {
      const restoredTable = typeof payload.logupTable === 'string'
        ? payload.logupTable
        : bigintListToString(DEFAULT_LOGUP.tableValues);
      const restoredWires = typeof payload.logupWires === 'string'
        ? payload.logupWires
        : bigintListToString(DEFAULT_LOGUP.wireValues);
      const restoredBeta = typeof payload.logupBeta === 'number'
        ? payload.logupBeta
        : Number(DEFAULT_LOGUP.beta);
      const restoredFieldSize = typeof payload.logupFieldSize === 'number'
        ? payload.logupFieldSize
        : Number(DEFAULT_LOGUP.fieldSize);

      try {
        const result = logUpCheck({
          tableValues: parseBigIntList(restoredTable),
          wireValues: parseBigIntList(restoredWires),
          beta: BigInt(restoredBeta),
          fieldSize: BigInt(restoredFieldSize),
        });
        setLogupResult(result);
        setLogupActiveStep(clampLogUpStep(payload.logupActiveStep, result.steps.length - 1));
      } catch {
        setLogupResult(null);
        setLogupActiveStep(-1);
      }
    }
  }, []);

  // ── multiset analysis ───────────────────────────────────
  const analysis = useMemo(() => analyzeLookup(parseNumberList(tableInput), parseNumberList(wireInput)), [tableInput, wireInput]);

  // ── logup render state ──────────────────────────────────
  const logupRenderState = useMemo((): LogUpRenderState => ({
    tableValues: parseBigIntList(logupTableInput),
    wireValues: parseBigIntList(logupWireInput),
    beta: BigInt(logupBeta),
    fieldSize: BigInt(logupFieldSize),
    result: logupResult,
    activeStep: logupActiveStep,
  }), [logupTableInput, logupWireInput, logupBeta, logupFieldSize, logupResult, logupActiveStep]);

  // ── info panel ──────────────────────────────────────────
  useEffect(() => {
    if (view === 'multiset') {
      setEntry('lookup', {
        title: analysis.passes ? 'Lookup passes' : 'Lookup mismatch',
        body: analysis.passes
          ? `The wire multiset [${analysis.wires.join(', ')}] is contained in the table [${analysis.table.join(', ')}].`
          : `Missing values: [${analysis.missing.join(', ')}], multiplicity issues: [${analysis.multiplicityMismatches.join(', ')}].`,
        nextSteps: ['Add a repeated wire value', 'Remove a table entry', 'Compare the sorted multisets'],
      });
    } else {
      setEntry('lookup', {
        title: logupResult
          ? (logupResult.satisfied ? 'LogUp check satisfied' : 'LogUp check failed')
          : 'LogUp — logarithmic-derivative lookup',
        body: logupResult
          ? `Wire sum = ${logupResult.wireSum}, Table sum = ${logupResult.tableSum}. ${logupResult.satisfied ? 'The sums balance in GF(' + logupFieldSize + ').' : 'The sums do not match' + (logupResult.invalidWires.length > 0 ? ' — ' + logupResult.invalidWires.length + ' invalid wire(s).' : '.')}`
          : 'Configure table/wire values and a challenge beta, then run the LogUp check to visualize the logarithmic-derivative argument.',
        nextSteps: [
          'Change beta to see how the challenge affects fractions',
          'Add a wire value not in the table',
          'Compare with the Multiset tab',
        ],
      });
    }
  }, [view, analysis, logupResult, logupFieldSize, setEntry]);

  // ── draw callback ───────────────────────────────────────
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    if (view === 'multiset') {
      renderLookup(ctx, frame, analysis, theme);
    } else {
      renderLogUp(ctx, frame, logupRenderState, theme);
    }
  }, [view, analysis, logupRenderState, theme]);

  // ── share state ─────────────────────────────────────────
  const buildShareState = useCallback((): LookupShareState => ({
    table: tableInput,
    wires: wireInput,
    view,
    logupTable: logupTableInput,
    logupWires: logupWireInput,
    logupBeta: logupBeta,
    logupFieldSize: logupFieldSize,
    logupComputed: view === 'logup' && logupResult ? true : undefined,
    logupActiveStep: view === 'logup' && logupResult ? logupActiveStep : undefined,
  }), [tableInput, wireInput, view, logupTableInput, logupWireInput, logupBeta, logupFieldSize, logupResult, logupActiveStep]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'lookup') return;
    setSearchParams({ l: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── share handlers ──────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('l');
    url.hash = `lookup|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'lookup');
    url.searchParams.set('l', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-lookup.png', showDownloadToast);
  };


  const handleCopyAuditSummary = () => {
    if (view === 'multiset') {
      const payload = {
        demo: 'lookup',
        view: 'multiset',
        timestamp: new Date().toISOString(),
        table: analysis.table,
        wires: analysis.wires,
        passes: analysis.passes,
        missing: analysis.missing,
        multiplicityMismatches: analysis.multiplicityMismatches,
      };
      copyToClipboard(JSON.stringify(payload, null, 2));
      showToast('Audit JSON copied', 'Lookup table, wire values & analysis results');
    } else {
      const multiplicityObj: Record<string, number> = {};
      if (logupResult) {
        logupResult.multiplicities.forEach((v, k) => { multiplicityObj[String(k)] = v; });
      }
      const payload = {
        demo: 'lookup',
        view: 'logup',
        timestamp: new Date().toISOString(),
        tableValues: parseBigIntList(logupTableInput).map(String),
        wireValues: parseBigIntList(logupWireInput).map(String),
        beta: logupBeta,
        fieldSize: logupFieldSize,
        satisfied: logupResult?.satisfied ?? null,
        wireSum: logupResult ? String(logupResult.wireSum) : null,
        tableSum: logupResult ? String(logupResult.tableSum) : null,
        multiplicities: multiplicityObj,
        invalidWires: logupResult?.invalidWires ?? [],
      };
      copyToClipboard(JSON.stringify(payload, null, 2));
      showToast('Audit JSON copied', 'LogUp argument state & results');
    }
  };

  // ── logup run ───────────────────────────────────────────
  const handleRunLogUp = () => {
    const tableVals = parseBigIntList(logupTableInput);
    const wireVals = parseBigIntList(logupWireInput);
    if (tableVals.length === 0 || wireVals.length === 0) {
      showToast('Invalid input', 'Provide at least one table value and one wire value');
      return;
    }
    try {
      const result = logUpCheck({
        tableValues: tableVals,
        wireValues: wireVals,
        beta: BigInt(logupBeta),
        fieldSize: BigInt(logupFieldSize),
      });
      setLogupResult(result);
      setLogupActiveStep(result.steps.length - 1);
    } catch (err) {
      showToast('LogUp error', err instanceof Error ? err.message : 'Computation failed');
    }
  };

  // ── fit to view ─────────────────────────────────────────
  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;

    if (view === 'multiset') {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 800;
      const columnHeight = Math.max(120, Math.max(analysis.sortedTable.length, analysis.sortedWires.length) * 34 + 16);
      const rightX = width / 2 + 24;
      const badgeRight = rightX + 180 + 24 + 120;

      fitCameraToBounds(camera, canvas, {
        minX: 72,
        minY: 40,
        maxX: badgeRight,
        maxY: 96 + columnHeight + 16,
      }, options?.instant ? { durationMs: 0 } : undefined);
    } else {
      const tableVals = parseBigIntList(logupTableInput);
      const wireVals = parseBigIntList(logupWireInput);
      const maxRows = Math.max(wireVals.length, tableVals.length);
      const rowH = 38;
      const wireColW = 220;
      const centerGap = 120;
      const tableColW = 260;
      const rightX = 72 + wireColW + centerGap;
      const stepsCount = logupResult ? logupResult.steps.length : 0;
      const colBottom = 80 + 36 + maxRows * rowH + 8 + 32;
      const stepsBottom = colBottom + 54 + 22 + stepsCount * 44;

      fitCameraToBounds(camera, canvas, {
        minX: 50,
        minY: 20,
        maxX: rightX + tableColW + 24 + 130 + 24,
        maxY: Math.max(colBottom, stepsBottom) + 20,
      }, options?.instant ? { durationMs: 0 } : undefined);
    }
  }, [view, analysis.sortedTable.length, analysis.sortedWires.length, logupTableInput, logupWireInput, logupResult, camera]);

  // ── reset ───────────────────────────────────────────────
  const handleReset = () => {
    if (view === 'multiset') {
      setTableInput('1,2,3,5,8,13');
      setWireInput('2,5,8');
    } else {
      setLogupTableInput(bigintListToString(DEFAULT_LOGUP.tableValues));
      setLogupWireInput(bigintListToString(DEFAULT_LOGUP.wireValues));
      setLogupBeta(Number(DEFAULT_LOGUP.beta));
      setLogupFieldSize(Number(DEFAULT_LOGUP.fieldSize));
      setLogupResult(null);
      setLogupActiveStep(-1);
    }
    showToast('Reset to defaults');
  };

  return (
    <DemoLayout
      onEmbedReset={handleReset}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* ── View Tab Selector ── */}
        <ControlGroup label="View">
          <div className="demo-tab-bar">
            <button
              className="demo-tab-btn"
              aria-pressed={view === 'multiset'}
              onClick={() => setView('multiset')}
            >
              Multiset
            </button>
            <button
              className="demo-tab-btn"
              aria-pressed={view === 'logup'}
              onClick={() => setView('logup')}
            >
              LogUp
            </button>
          </div>
        </ControlGroup>

        {view === 'multiset' ? (
          /* ── Multiset controls ── */
          <>
            <ControlGroup label="Lookup Table">
              <TextInput value={tableInput} onChange={setTableInput} placeholder="1,2,3,5,8,13" />
            </ControlGroup>

            <ControlGroup label="Wire Values">
              <TextInput value={wireInput} onChange={setWireInput} placeholder="2,5,8" />
              <ButtonControl label="Load failing example" onClick={() => setWireInput('2,5,21')} variant="secondary" />
              <ButtonControl label="Load repeated lookup (passes)" onClick={() => setWireInput('2,2,2,8')} variant="secondary" />
            </ControlGroup>

            <ControlGroup label="Analysis">
              <ControlNote tone={analysis.passes ? 'success' : 'error'}>
                {analysis.passes ? 'Permutation-style lookup check passes.' : 'Lookup check fails.'}
              </ControlNote>
              <ControlCard>
                <span className="control-kicker">Sorted table</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  [{analysis.sortedTable.join(', ')}]
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">Sorted wires</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  [{analysis.sortedWires.join(', ')}]
                </div>
              </ControlCard>
            </ControlGroup>
          </>
        ) : (
          /* ── LogUp controls ── */
          <>
            <ControlGroup label="Table Values">
              <TextInput
                value={logupTableInput}
                onChange={(value) => {
                  setLogupTableInput(value);
                  setLogupResult(null);
                  setLogupActiveStep(-1);
                }}
                placeholder="1,2,3,4,5"
              />
              <ControlNote>
                Comma-separated integers (BigInt). These are the allowed lookup values.
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Wire Values">
              <TextInput
                value={logupWireInput}
                onChange={(value) => {
                  setLogupWireInput(value);
                  setLogupResult(null);
                  setLogupActiveStep(-1);
                }}
                placeholder="2,3,3,5,1,2"
              />
              <ButtonControl label="Load failing example" onClick={() => {
                setLogupWireInput('2,3,99,5,1');
                setLogupResult(null);
                setLogupActiveStep(-1);
              }} variant="secondary" />
            </ControlGroup>

            <ControlGroup label="Parameters">
              <NumberInputControl
                label="Beta (β) challenge"
                value={logupBeta}
                min={1}
                max={9999}
                onChange={(v) => { setLogupBeta(v); setLogupResult(null); setLogupActiveStep(-1); }}
              />
              <NumberInputControl
                label="Field size (p)"
                value={logupFieldSize}
                min={2}
                max={9999}
                onChange={(v) => { setLogupFieldSize(v); setLogupResult(null); setLogupActiveStep(-1); }}
              />
            </ControlGroup>

            <ButtonControl label="Run LogUp Check" onClick={handleRunLogUp} />

            {logupResult && (
              <ControlGroup label="Result">
                <ControlNote tone={logupResult.satisfied ? 'success' : 'error'}>
                  {logupResult.satisfied
                    ? 'LogUp check satisfied — wire and table sums balance.'
                    : logupResult.invalidWires.length > 0
                      ? `LogUp check failed — ${logupResult.invalidWires.length} wire(s) not in table.`
                      : 'LogUp check failed — sums do not match.'}
                </ControlNote>

                <ControlCard>
                  <span className="control-kicker">Wire sum</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {String(logupResult.wireSum)}
                  </div>
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">Table sum</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {String(logupResult.tableSum)}
                  </div>
                </ControlCard>

                <ControlCard>
                  <span className="control-kicker">Multiplicities</span>
                  <div className="control-choice-list" style={{ gap: 4, marginTop: 4 }}>
                    {Array.from(logupResult.multiplicities.entries()).map(([val, count]) => (
                      <div
                        key={String(val)}
                        className="control-caption"
                        style={{ fontFamily: 'var(--font-mono)', opacity: count === 0 ? 0.4 : 1 }}
                      >
                        t={String(val)} : m={count}
                      </div>
                    ))}
                  </div>
                </ControlCard>

                <ControlCard>
                  <span className="control-kicker">Steps</span>
                  <div className="control-choice-list" style={{ gap: 4, marginTop: 4 }}>
                    {logupResult.steps.map((step, i) => (
                      <div
                        key={i}
                        className="control-caption"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          opacity: i <= logupActiveStep ? 1 : 0.4,
                          cursor: 'pointer',
                        }}
                        onClick={() => setLogupActiveStep(i)}
                      >
                        <strong>{step.stepName}</strong>: {step.description}
                      </div>
                    ))}
                  </div>
                </ControlCard>
              </ControlGroup>
            )}
          </>
        )}

        <ButtonControl label="Reset to Defaults" onClick={handleReset} variant="secondary" />

        <ShareSaveDropdown
          demoId="lookup"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleCopyAuditSummary}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:lookup" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Lookup Arguments" />
    </DemoLayout>
  );
}
