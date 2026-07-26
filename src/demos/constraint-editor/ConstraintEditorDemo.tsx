import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, ButtonControl, ControlCard, ControlNote, NumberInputControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { useAttack } from '@/modes/attack/AttackProvider';
import { useAttackActions } from '@/modes/attack/useAttackActions';
import {
  decodeState,
  decodeStatePlain,
  encodeState,
  encodeStatePlain,
  getHashState,
  getSearchParam,
  setSearchParams,
} from '@/lib/urlState';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
import type { ExhaustiveResult } from '@/lib/dsl/types';
import { exhaustiveCheck } from '@/lib/dsl/exhaustive';
import {
  evaluateCircuit,
  exportTrace,
  relevantInputs,
  serializeDocument,
  deserializeDocument,
  type CircuitDocumentV1,
  type EditorDocumentState,
} from './logic';
import { EDITOR_PRESETS, getEditorPreset, getPresetIdForSource } from './presets';
import { renderEditor, hitTest, type EditorRenderState } from './renderer';
import { EditorPane } from './EditorPane';

const MAX_SAFE_COMBINATIONS = 1_100_000;
const DEFAULT_PRESET = EDITOR_PRESETS[0]!;

// ── State ──────────────────────────────────────────────────────────────────

interface EditorState {
  source: string;
  fieldSize: bigint;
  inputs: Map<string, bigint>;
  presetId: string;
  selectedWire: number | null;
  selectedConstraint: number | null;
  exhaustive: ExhaustiveResult | null;
  exhaustiveRunning: boolean;
  exhaustiveProgress: number;
}

type EditorAction =
  | { type: 'SET_SOURCE'; source: string }
  | { type: 'LOAD_PRESET'; presetId: string }
  | { type: 'SET_FIELD'; fieldSize: bigint }
  | { type: 'SET_INPUT'; name: string; value: bigint }
  | { type: 'LOAD_INPUTS'; inputs: Map<string, bigint> }
  | { type: 'SELECT'; wire?: number | null; constraint?: number | null }
  | { type: 'EXHAUSTIVE_START' }
  | { type: 'EXHAUSTIVE_PROGRESS'; progress: number }
  | { type: 'EXHAUSTIVE_DONE'; result: ExhaustiveResult | null }
  | { type: 'RESTORE'; state: Partial<EditorDocumentState> }
  | { type: 'RESET' };

function inputsFromRecord(record: Record<string, number>): Map<string, bigint> {
  return new Map(Object.entries(record).map(([k, v]) => [k, BigInt(v)]));
}

function buildInitialState(): EditorState {
  return {
    source: DEFAULT_PRESET.source,
    fieldSize: 101n,
    inputs: inputsFromRecord(DEFAULT_PRESET.defaultInputs),
    presetId: DEFAULT_PRESET.id,
    selectedWire: null,
    selectedConstraint: null,
    exhaustive: null,
    exhaustiveRunning: false,
    exhaustiveProgress: 0,
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_SOURCE':
      return {
        ...state,
        source: action.source,
        presetId: getPresetIdForSource(action.source),
        exhaustive: null,
        selectedWire: null,
        selectedConstraint: null,
      };
    case 'LOAD_PRESET': {
      const preset = getEditorPreset(action.presetId);
      if (!preset) return state;
      return {
        ...state,
        source: preset.source,
        inputs: inputsFromRecord(preset.defaultInputs),
        presetId: preset.id,
        exhaustive: null,
        selectedWire: null,
        selectedConstraint: null,
      };
    }
    case 'SET_FIELD':
      return { ...state, fieldSize: action.fieldSize, exhaustive: null };
    case 'SET_INPUT': {
      const inputs = new Map(state.inputs);
      inputs.set(action.name, action.value);
      return { ...state, inputs, exhaustive: null };
    }
    case 'LOAD_INPUTS':
      return { ...state, inputs: new Map(action.inputs), exhaustive: null };
    case 'SELECT':
      return {
        ...state,
        selectedWire: action.wire ?? null,
        selectedConstraint: action.constraint ?? null,
      };
    case 'EXHAUSTIVE_START':
      return { ...state, exhaustiveRunning: true, exhaustiveProgress: 0, exhaustive: null };
    case 'EXHAUSTIVE_PROGRESS':
      return { ...state, exhaustiveProgress: action.progress };
    case 'EXHAUSTIVE_DONE':
      return { ...state, exhaustiveRunning: false, exhaustiveProgress: 100, exhaustive: action.result };
    case 'RESTORE':
      return {
        ...buildInitialState(),
        ...('source' in action.state && action.state.source !== undefined ? { source: action.state.source } : {}),
        ...(action.state.fieldSize !== undefined ? { fieldSize: action.state.fieldSize } : {}),
        ...(action.state.inputs !== undefined ? { inputs: action.state.inputs } : {}),
        ...(action.state.presetId !== undefined ? { presetId: action.state.presetId } : {}),
        selectedWire: action.state.selectedWire ?? null,
        selectedConstraint: action.state.selectedConstraint ?? null,
      };
    case 'RESET':
      return buildInitialState();
    default:
      return state;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function ConstraintEditorDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const { currentDemoAction } = useAttack();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [hoveredElement, setHoveredElement] = useState<{ type: 'wire' | 'constraint'; id: number } | null>(null);

  const [state, dispatch] = useReducer(reducer, null, buildInitialState);

  // ── Debounced source for the pipeline + URL sync ───────────────────
  const [debouncedSource, setDebouncedSource] = useState(state.source);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSource(state.source), 300);
    return () => window.clearTimeout(handle);
  }, [state.source]);

  const pipeline = useMemo(
    () => evaluateCircuit(debouncedSource, state.fieldSize, state.inputs),
    [debouncedSource, state.fieldSize, state.inputs],
  );

  // ── Restore from URL on mount ──────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'constraint-editor' ? hashState.state : null;
    const decoded = decodeStatePlain<CircuitDocumentV1>(rawHash)
      ?? decodeState<CircuitDocumentV1>(getSearchParam('ce'));
    if (!decoded) return;
    const restored = deserializeDocument(decoded);
    if (restored) {
      dispatch({ type: 'RESTORE', state: restored });
      if (restored.source !== undefined) setDebouncedSource(restored.source);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL sync (from debounced source only) ──────────────────────────
  const shareDoc = useMemo(
    () =>
      serializeDocument({
        source: debouncedSource,
        fieldSize: state.fieldSize,
        inputs: relevantInputs(pipeline.compilation, state.inputs),
        presetId: getPresetIdForSource(debouncedSource),
        selectedWire: state.selectedWire,
        selectedConstraint: state.selectedConstraint,
      }),
    [debouncedSource, state.fieldSize, state.inputs, state.selectedWire, state.selectedConstraint, pipeline.compilation],
  );

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'constraint-editor') return;
    setSearchParams({ ce: encodeState(shareDoc) });
  }, [shareDoc]);

  // ── Exhaustive check ───────────────────────────────────────────────
  const inputWireCount = pipeline.compilation
    ? pipeline.compilation.inputWires.length + pipeline.compilation.publicWires.length
    : 0;
  const totalCombinations = Math.pow(Number(state.fieldSize), inputWireCount);
  const exhaustiveTooLarge = totalCombinations > MAX_SAFE_COMBINATIONS;

  const handleRunExhaustive = useCallback(() => {
    // Evaluate fresh (not from the debounced memo) so attack-driven runs
    // never race the 300ms debounce.
    const fresh = evaluateCircuit(state.source, state.fieldSize, state.inputs);
    const compilation = fresh.compilation;
    if (!compilation?.success) return;
    const inputCount = compilation.inputWires.length + compilation.publicWires.length;
    if (inputCount === 0 || Math.pow(Number(state.fieldSize), inputCount) > MAX_SAFE_COMBINATIONS) return;
    dispatch({ type: 'EXHAUSTIVE_START' });
    window.setTimeout(() => {
      const result = exhaustiveCheck(compilation, fresh.parseResult.ast, (tested, total) => {
        dispatch({ type: 'EXHAUSTIVE_PROGRESS', progress: Math.round((tested / total) * 100) });
      });
      dispatch({ type: 'EXHAUSTIVE_DONE', result });
    }, 50);
  }, [state.source, state.fieldSize, state.inputs]);

  // ── Attack mode integration ────────────────────────────────────────
  useAttackActions(currentDemoAction, useMemo(() => ({
    LOAD_PRESET: (payload: unknown) => {
      if (typeof payload === 'string') dispatch({ type: 'LOAD_PRESET', presetId: payload });
    },
    LOAD_SOURCE: (payload: unknown) => {
      const p = payload as { source?: string; inputs?: Record<string, string | number> };
      if (typeof p?.source !== 'string') return;
      dispatch({ type: 'SET_SOURCE', source: p.source });
      setDebouncedSource(p.source);
      if (p.inputs) {
        const inputs = new Map<string, bigint>();
        for (const [k, v] of Object.entries(p.inputs)) {
          try { inputs.set(k, BigInt(v)); } catch { /* skip */ }
        }
        dispatch({ type: 'LOAD_INPUTS', inputs });
      }
    },
    LOAD_INPUTS: (payload: unknown) => {
      const record = payload as Record<string, string | number>;
      if (typeof record !== 'object' || record === null) return;
      const inputs = new Map<string, bigint>();
      for (const [k, v] of Object.entries(record)) {
        try { inputs.set(k, BigInt(v)); } catch { /* skip */ }
      }
      dispatch({ type: 'LOAD_INPUTS', inputs });
    },
    RUN_EXHAUSTIVE: () => handleRunExhaustive(),
    RESET: () => {
      dispatch({ type: 'RESET' });
      setDebouncedSource(DEFAULT_PRESET.source);
    },
  }), [handleRunExhaustive]));

  // ── Info panel ─────────────────────────────────────────────────────
  useEffect(() => {
    const analysis = pipeline.analysis;
    const checks = pipeline.checks;
    const flagged = analysis ? analysis.unconstrainedWires.length + analysis.weakInputWires.length : 0;
    let body: string;
    if (!pipeline.parseResult.success) {
      body = 'The source does not parse yet. Fix the errors listed under the editor to compile the circuit.';
    } else if (!pipeline.compilation?.success) {
      body = 'The circuit parses but does not compile. Check the sidebar errors.';
    } else {
      const wireCount = pipeline.compilation.wires.length - 1; // exclude the constant one
      body = `${pipeline.compilation.constraints.length} R1CS constraints over ${wireCount} wires in GF(${state.fieldSize}). ${
        checks ? (checks.allSatisfied ? 'The current witness satisfies every constraint.' : `${checks.failedConstraints.length} constraint(s) FAIL with the current witness.`) : ''
      }${
        flagged > 0
          ? ` Analyzer flags ${flagged} wire(s) the prover can choose freely — this circuit may accept false statements.`
          : ''
      }`;
    }
    setEntry('constraint-editor', {
      title: state.presetId !== 'custom' ? (getEditorPreset(state.presetId)?.name ?? 'Custom circuit') : 'Custom circuit',
      body,
      nextSteps: flagged > 0
        ? ['Find the missing constraint', 'Run the exhaustive check for a counterexample', 'Fix the circuit and watch the flags clear']
        : ['Edit the circuit and watch constraints update', 'Try a buggy preset and hunt the bug', 'Share your circuit as a URL'],
      securityState: { fieldSize: state.fieldSize },
    });
  }, [pipeline, state.presetId, state.fieldSize, setEntry]);

  // ── Camera fit ─────────────────────────────────────────────────────
  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas || !pipeline.layout) return;
    fitCameraToBounds(camera, canvas, pipeline.layout.bounds, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera, pipeline.layout]);

  useEffect(() => {
    handleFitToView({ instant: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.layout === null, state.presetId]);

  // ── Canvas draw + hit testing ──────────────────────────────────────
  const renderState = useMemo<EditorRenderState>(() => ({
    pipeline,
    selectedWire: state.selectedWire,
    selectedConstraint: state.selectedConstraint,
    hoveredElement,
  }), [pipeline, state.selectedWire, state.selectedConstraint, hoveredElement]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderEditor(ctx, frame, renderState, theme);
  }, [renderState, theme]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (pipeline.layout && canvasElRef.current) {
      const rect = canvasElRef.current.getBoundingClientRect();
      const { x, y } = camera.toWorld(e.clientX - rect.left, e.clientY - rect.top);
      setHoveredElement(hitTest(pipeline.layout, x, y));
    }
    mergedHandlers.onMouseMove?.(e);
  }, [pipeline.layout, camera, mergedHandlers]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pipeline.layout || !canvasElRef.current || !camera.shouldHandleClick()) return;
    const rect = canvasElRef.current.getBoundingClientRect();
    const { x, y } = camera.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const hit = hitTest(pipeline.layout, x, y);
    if (hit?.type === 'wire') {
      dispatch({ type: 'SELECT', wire: state.selectedWire === hit.id ? null : hit.id });
    } else if (hit?.type === 'constraint') {
      dispatch({ type: 'SELECT', constraint: state.selectedConstraint === hit.id ? null : hit.id });
    } else {
      dispatch({ type: 'SELECT' });
    }
  }, [pipeline.layout, camera, state.selectedWire, state.selectedConstraint]);

  // ── Share handlers ─────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact circuit');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('ce');
    url.hash = `constraint-editor|${encodeStatePlain(shareDoc)}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'Circuit is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'constraint-editor');
    url.searchParams.set('ce', encodeState(shareDoc));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-constraint-editor.png', showDownloadToast);
  };

  const handleCopyAudit = () => {
    const payload = {
      ...exportTrace(pipeline, state.fieldSize),
      timestamp: new Date().toISOString(),
      document: shareDoc,
      exhaustive: state.exhaustive
        ? {
            allSatisfied: state.exhaustive.allSatisfied,
            isInputDetermined: state.exhaustive.isInputDetermined,
            tested: state.exhaustive.tested,
            counterexample: state.exhaustive.counterexample?.explanation ?? null,
          }
        : null,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Circuit document, analysis, and proof trace');
  };

  // ── Render ─────────────────────────────────────────────────────────
  const analysis = pipeline.analysis;
  const hasUnderconstraint = Boolean(
    analysis && (analysis.unconstrainedWires.length > 0 || analysis.weakInputWires.length > 0),
  );
  const inputWires = pipeline.compilation
    ? [...pipeline.compilation.inputWires, ...pipeline.compilation.publicWires]
    : [];
  const selectedCheck = state.selectedConstraint !== null
    ? pipeline.checks?.checks.find((c) => c.constraintId === state.selectedConstraint) ?? null
    : null;

  return (
    <DemoLayout
      onEmbedReset={() => {
        dispatch({ type: 'RESET' });
        setDebouncedSource(DEFAULT_PRESET.source);
      }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar resetScrollKey={state.presetId}>
        <ControlGroup label="Circuit">
          <EditorPane
            source={state.source}
            onChange={(source) => dispatch({ type: 'SET_SOURCE', source })}
            onSelectPreset={(id) => dispatch({ type: 'LOAD_PRESET', presetId: id })}
            errors={pipeline.parseResult.errors}
            fieldSize={state.fieldSize}
            onFieldSizeChange={(fieldSize) => dispatch({ type: 'SET_FIELD', fieldSize })}
          />
        </ControlGroup>

        {inputWires.length > 0 && (
          <ControlGroup label="Witness inputs">
            {inputWires.map((wire) => (
              <NumberInputControl
                key={wire.name}
                label={`${wire.name}${wire.type === 'public' ? ' (public)' : ''}`}
                value={Number(state.inputs.get(wire.name) ?? 0n)}
                min={0}
                max={Number(state.fieldSize) - 1}
                onChange={(v) => dispatch({ type: 'SET_INPUT', name: wire.name, value: BigInt(Math.max(0, Math.round(v))) })}
              />
            ))}
          </ControlGroup>
        )}

        {analysis && (
          <ControlGroup label="Analysis">
            <ControlCard tone={hasUnderconstraint ? 'error' : 'default'}>
              {hasUnderconstraint ? (
                <>
                  <span className="control-kicker" style={{ color: 'var(--status-error)' }}>underconstrained</span>
                  {analysis.unconstrainedWires.length > 0 && (
                    <div className="control-caption">
                      Unbound wires: {analysis.unconstrainedWires.map((w) => w.name).join(', ')}
                    </div>
                  )}
                  {analysis.weakInputWires.length > 0 && (
                    <div className="control-caption">
                      Never multiplied: {analysis.weakInputWires.map((w) => w.name).join(', ')} — nothing pins these
                      values to a computation.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span className="control-kicker">constraint coverage</span>
                  <div className="control-caption">No unconstrained or weak wires detected.</div>
                </>
              )}
              <div className="control-caption">
                {analysis.constraintCount} constraints · {analysis.wireCount} wires · {analysis.degreesOfFreedom} degrees of freedom
              </div>
            </ControlCard>
            {hasUnderconstraint && (
              <ControlNote tone="error">
                A dishonest prover can pick flagged values freely. Run the exhaustive check to find a concrete exploit.
              </ControlNote>
            )}
          </ControlGroup>
        )}

        {pipeline.checks && (
          <ControlGroup label="Constraints" collapsible defaultCollapsed>
            {pipeline.checks.checks.map((check) => (
              <button
                key={check.constraintId}
                className="control-choice-button"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: check.satisfied ? 'var(--text-secondary)' : 'var(--status-error)',
                  borderColor: state.selectedConstraint === check.constraintId ? 'var(--focus-ring)' : undefined,
                }}
                onClick={() => dispatch({ type: 'SELECT', constraint: check.constraintId })}
              >
                {check.satisfied ? '✓' : '✗'} {check.sourceExpr}
              </button>
            ))}
            {selectedCheck && !selectedCheck.satisfied && selectedCheck.mismatch && (
              <ControlNote tone="error">
                A·B = {String(selectedCheck.ab_product)} but C = {String(selectedCheck.c_value)} (difference{' '}
                {String(selectedCheck.mismatch.difference)}).
              </ControlNote>
            )}
          </ControlGroup>
        )}

        {pipeline.compilation?.success && inputWireCount > 0 && (
          <ControlGroup label="Exhaustive check">
            <ButtonControl
              label={
                state.exhaustiveRunning
                  ? `Testing… ${state.exhaustiveProgress}%`
                  : `Test all ${totalCombinations.toLocaleString()} inputs`
              }
              onClick={handleRunExhaustive}
              disabled={state.exhaustiveRunning || exhaustiveTooLarge}
            />
            {exhaustiveTooLarge && (
              <ControlNote>
                Too many combinations ({totalCombinations.toLocaleString()}). Reduce the field size or input count.
              </ControlNote>
            )}
            {state.exhaustive && (
              <ControlCard tone={state.exhaustive.isInputDetermined && state.exhaustive.allSatisfied ? 'default' : 'error'}>
                <span className="control-kicker">
                  {state.exhaustive.isInputDetermined ? 'input-determined' : 'NOT input-determined'}
                </span>
                <div className="control-caption">
                  Tested {state.exhaustive.tested.toLocaleString()} of {state.exhaustive.totalCombinations.toLocaleString()} ·{' '}
                  {state.exhaustive.uniqueOutputs.toLocaleString()} unique outputs
                </div>
                {state.exhaustive.counterexample && (
                  <div className="control-caption" style={{ color: 'var(--status-error)' }}>
                    {state.exhaustive.counterexample.explanation}
                  </div>
                )}
              </ControlCard>
            )}
          </ControlGroup>
        )}

        <ShareSaveDropdown
          demoId="constraint-editor"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleCopyAudit}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={draw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />
        <CanvasToolbar
          camera={camera}
          storageKey="theora:toolbar:constraint-editor"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Constraint Editor"
      />
    </DemoLayout>
  );
}
