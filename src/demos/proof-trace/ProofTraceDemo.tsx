import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea, useEmbedContext } from '@/components/shared/DemoLayout';
import { ControlGroup, ButtonControl, ControlCard, ControlNote, SliderControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { HashBadge } from '@/components/shared/HashBadge';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
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
import { startGifRecording, type GifRecorder } from '@/lib/gifExport';
import type { ProofTrace } from './schema';
import { FINGERPRINT_VERSION, normalizeTrace } from './schema';
import { buildFingerprintSpec, groupEventsByRound, transcriptHash } from './logic';
import { buildSample } from './samples';
import { fetchProofTrace } from './importTrace';
import {
  DEFAULT_SOURCE,
  deserializeState,
  serializeForUrl,
  type SerializedState,
  type TraceSource,
  type TraceView,
} from './serialization';
import { renderFingerprint, type ProofTraceRenderState } from './renderer';
import { TraceSourcePanel } from './TraceSourcePanel';
import { computeTraceLayout } from './constraintLayout';
import { renderTraceConstraints } from './constraintRenderer';
import { renderTraceTimeline, timelineBounds } from './timelineRenderer';

// ── State ──────────────────────────────────────────────────────────────────

interface ProofTraceDemoState {
  source: TraceSource;
  trace: ProofTrace | null;
  hash: string | null;
  view: TraceView;
  step: number;
  playing: boolean;
  loading: boolean;
  errors: string[];
}

type ProofTraceAction =
  | { type: 'SELECT_SAMPLE'; id: Parameters<typeof buildSample>[0] }
  | { type: 'LOCAL_TRACE'; trace: ProofTrace; name: string }
  | { type: 'LOAD_URL_START'; url: string }
  | { type: 'LOAD_URL_OK'; trace: ProofTrace }
  | { type: 'LOAD_URL_FAIL'; errors: string[] }
  | { type: 'SET_ERRORS'; errors: string[] }
  | { type: 'SET_HASH'; hash: string }
  | { type: 'SET_VIEW'; view: TraceView }
  | { type: 'SET_STEP'; step: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TICK' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: SerializedState };

function resolveSourceTrace(source: TraceSource): ProofTrace | null {
  if (source.kind === 'sample') return buildSample(source.id);
  if (source.kind === 'inline') return source.trace;
  return null;
}

function buildInitialState(): ProofTraceDemoState {
  const source = { ...DEFAULT_SOURCE };
  return {
    source,
    trace: resolveSourceTrace(source),
    hash: null,
    view: 'fingerprint',
    step: 0,
    playing: false,
    loading: false,
    errors: [],
  };
}

function reducer(state: ProofTraceDemoState, action: ProofTraceAction): ProofTraceDemoState {
  switch (action.type) {
    case 'SELECT_SAMPLE': {
      const source: TraceSource = { kind: 'sample', id: action.id };
      return { ...state, source, trace: resolveSourceTrace(source), hash: null, step: 0, playing: false, loading: false, errors: [] };
    }
    case 'LOCAL_TRACE':
      return {
        ...state,
        source: { kind: 'local', name: action.name, hash: '' },
        trace: action.trace,
        hash: null,
        step: 0,
        playing: false,
        loading: false,
        errors: [],
      };
    case 'LOAD_URL_START':
      return { ...state, source: { kind: 'url', url: action.url }, trace: null, hash: null, step: 0, playing: false, loading: true, errors: [] };
    case 'LOAD_URL_OK':
      return { ...state, trace: action.trace, hash: null, loading: false, errors: [] };
    case 'LOAD_URL_FAIL': {
      const source = { ...DEFAULT_SOURCE };
      return {
        ...state,
        source,
        trace: resolveSourceTrace(source),
        hash: null,
        loading: false,
        errors: action.errors,
      };
    }
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SET_HASH':
      return { ...state, hash: action.hash };
    case 'SET_VIEW':
      return { ...state, view: action.view, playing: false };
    case 'SET_STEP':
      return { ...state, step: Math.max(0, action.step), playing: false };
    case 'PLAY':
      return { ...state, view: 'timeline', playing: true };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'TICK': {
      if (!state.trace) return { ...state, playing: false };
      const last = state.trace.transcript.length - 1;
      if (state.step >= last) return { ...state, playing: false };
      const next = state.step + 1;
      return { ...state, step: next, playing: next < last };
    }
    case 'RESET':
      return { ...state, step: 0, playing: false };
    case 'RESTORE': {
      const trace = resolveSourceTrace(action.state.source);
      return {
        ...state,
        source: action.state.source,
        trace,
        hash: null,
        view: action.state.view,
        step: action.state.step,
        playing: false,
        loading: action.state.source.kind === 'url',
        errors: [],
      };
    }
    default:
      return state;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function ProofTraceDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const { isEmbed } = useEmbedContext();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const gifRecorderRef = useRef<GifRecorder | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  const [state, dispatch] = useReducer(reducer, null, buildInitialState);

  // ── Restore from URL on mount ──────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'proof-trace' ? hashState.state : null;
    const decoded = decodeStatePlain<SerializedState>(rawHash)
      ?? decodeState<SerializedState>(getSearchParam('pt'));
    if (!decoded) return;
    const restored = deserializeState(decoded);
    if (restored) dispatch({ type: 'RESTORE', state: restored });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL fetch for url-kind sources ─────────────────────────────────
  useEffect(() => {
    if (state.source.kind !== 'url' || state.trace !== null) return;
    let active = true;
    const url = state.source.url;
    void fetchProofTrace(url).then((result) => {
      if (!active) return;
      if (result.ok && result.trace) {
        dispatch({ type: 'LOAD_URL_OK', trace: result.trace });
      } else {
        dispatch({ type: 'LOAD_URL_FAIL', errors: result.errors });
        showToast('Trace load failed', result.errors[0] ?? 'Invalid trace');
      }
    });
    return () => {
      active = false;
    };
  }, [state.source, state.trace]);

  // ── Transcript hash ────────────────────────────────────────────────
  useEffect(() => {
    if (!state.trace) return;
    let active = true;
    void transcriptHash(state.trace).then((hash) => {
      if (active) dispatch({ type: 'SET_HASH', hash });
    });
    return () => {
      active = false;
    };
  }, [state.trace]);

  // ── Timeline auto-play ─────────────────────────────────────────────
  useEffect(() => {
    if (!state.playing) return;
    const interval = window.setInterval(() => dispatch({ type: 'TICK' }), 400);
    return () => window.clearInterval(interval);
  }, [state.playing]);

  // GIF recorder stops when auto-play finishes
  useEffect(() => {
    if (!state.playing && gifRecorderRef.current) {
      gifRecorderRef.current.stop();
      gifRecorderRef.current = null;
    }
  }, [state.playing]);

  // ── Derived render data ────────────────────────────────────────────
  const spec = useMemo(
    () => (state.trace && state.hash ? buildFingerprintSpec(state.hash, state.trace) : null),
    [state.trace, state.hash],
  );

  const constraintLayout = useMemo(
    () => (state.trace?.constraints ? computeTraceLayout(state.trace.constraints, state.trace.meta.field) : null),
    [state.trace],
  );

  const roundCount = useMemo(() => (state.trace ? groupEventsByRound(state.trace).length : 0), [state.trace]);

  // ── URL sync ───────────────────────────────────────────────────────
  const shareState = useMemo(
    () => serializeForUrl(state.source, state.view, state.step, state.hash),
    [state.source, state.view, state.step, state.hash],
  );

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'proof-trace') return;
    setSearchParams({ pt: encodeState(shareState) });
  }, [shareState]);

  // ── Info panel ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.trace) {
      setEntry('proof-trace', {
        title: state.loading ? 'Loading trace…' : 'No trace loaded',
        body: state.loading
          ? 'Fetching the trace file.'
          : 'Load a bundled sample, upload a trace.json, or paste a GitHub URL to fingerprint a proof execution.',
        nextSteps: ['Pick a bundled sample', 'Upload a trace.json file', 'Load a trace from a gist URL'],
      });
      return;
    }
    const t = state.trace;
    const checks = t.transcript.filter((e) => e.t === 'check');
    const failed = checks.filter((e) => e.ok === false).length;
    setEntry('proof-trace', {
      title: t.meta.label ?? `${t.meta.protocol} trace`,
      body: `${t.transcript.length} transcript events across ${roundCount} rounds over GF(${t.meta.field}). ${
        failed > 0 ? `${failed} of ${checks.length} checks failed — the fingerprint reflects the dishonest run.` : 'All checks passed.'
      }${state.hash ? ` Fingerprint ${state.hash.slice(0, 12)}… identifies this exact interaction.` : ''}`,
      nextSteps: [
        'Switch views: fingerprint, constraints, timeline',
        'Corrupt one transcript value in a copy and compare fingerprints',
        'Save to GitHub to get a restorable share link',
      ],
      securityState: { fieldSize: BigInt(t.meta.field), numRounds: roundCount },
    });
  }, [state.trace, state.hash, state.loading, roundCount, setEntry]);

  // ── Camera fit ─────────────────────────────────────────────────────
  const worldBounds = useCallback((): { minX: number; minY: number; maxX: number; maxY: number } => {
    const canvas = canvasElRef.current;
    const rect = canvas?.getBoundingClientRect();
    const w = rect?.width || 900;
    const h = rect?.height || 600;
    if (state.view === 'constraints' && constraintLayout) return constraintLayout.bounds;
    if (state.view === 'timeline' && state.trace) return timelineBounds(state.trace);
    if (spec) {
      return {
        minX: w / 2 + spec.bounds.minX,
        minY: h / 2 + spec.bounds.minY,
        maxX: w / 2 + spec.bounds.maxX,
        maxY: h / 2 + spec.bounds.maxY,
      };
    }
    return { minX: 0, minY: 0, maxX: w, maxY: h };
  }, [state.view, state.trace, constraintLayout, spec]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    fitCameraToBounds(camera, canvas, worldBounds(), options?.instant ? { durationMs: 0 } : undefined);
  }, [camera, worldBounds]);

  useEffect(() => {
    handleFitToView({ instant: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view, state.trace === null]);

  // ── Canvas draw ────────────────────────────────────────────────────
  const fingerprintRenderState = useMemo<ProofTraceRenderState>(() => ({
    spec,
    traceLabel: state.trace?.meta.label ?? (state.trace ? 'trace' : 'no trace'),
    protocol: state.trace?.meta.protocol ?? '—',
    field: state.trace?.meta.field ?? '—',
    loading: state.loading,
    error: state.errors[0] ?? null,
  }), [spec, state.trace, state.loading, state.errors]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    if (state.view === 'constraints') {
      renderTraceConstraints(ctx, frame, {
        section: state.trace?.constraints ?? null,
        layout: constraintLayout,
        hueShiftDeg: spec?.hueShiftDeg ?? 0,
      }, theme);
    } else if (state.view === 'timeline') {
      renderTraceTimeline(ctx, frame, {
        trace: state.trace,
        step: state.step,
        hueShiftDeg: spec?.hueShiftDeg ?? 0,
      }, theme);
    } else {
      renderFingerprint(ctx, frame, fingerprintRenderState, theme);
    }
  }, [state.view, state.trace, state.step, constraintLayout, spec, fingerprintRenderState, theme]);

  // ── Share handlers ─────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('pt');
    url.hash = `proof-trace|${encodeStatePlain(shareState)}`;
    copyToClipboard(url.toString());
    if (shareState.source.kind === 'local') {
      showToast('Hash URL copied', 'Trace too large for a URL — save to GitHub for a restorable link');
    } else {
      showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
    }
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'proof-trace');
    url.searchParams.set('pt', encodeState(shareState));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-proof-trace.png', showDownloadToast);
  };

  const handleExportGif = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas || !state.trace) return;
    dispatch({ type: 'SET_VIEW', view: 'timeline' });
    dispatch({ type: 'SET_STEP', step: 0 });
    gifRecorderRef.current = startGifRecording({
      canvas,
      camera,
      fitToView: handleFitToView,
      filename: 'theora-proof-trace.gif',
      onDone: () => showDownloadToast('theora-proof-trace.gif'),
    });
    dispatch({ type: 'PLAY' });
  }, [camera, handleFitToView, state.trace]);

  const handleCopyAudit = () => {
    if (!state.trace) return;
    const payload = {
      demo: 'proof-trace',
      timestamp: new Date().toISOString(),
      fingerprintVersion: FINGERPRINT_VERSION,
      transcriptHash: state.hash,
      trace: normalizeTrace(state.trace),
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Normalized trace plus transcript hash');
  };

  // ── Render ─────────────────────────────────────────────────────────
  const activeSampleId = state.source.kind === 'sample' ? state.source.id : null;
  const maxStep = state.trace ? state.trace.transcript.length - 1 : 0;
  const hasConstraints = Boolean(state.trace?.constraints);
  const showReuploadNotice = state.source.kind === 'local' && state.trace === null;

  const viewButtons: Array<{ id: TraceView; label: string; disabled?: boolean }> = [
    { id: 'fingerprint', label: 'Fingerprint' },
    { id: 'constraints', label: 'Constraints', disabled: !hasConstraints },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <DemoLayout
      onEmbedPlay={() => dispatch(state.playing ? { type: 'PAUSE' } : { type: 'PLAY' })}
      embedPlaying={state.playing}
      onEmbedReset={() => dispatch({ type: 'RESET' })}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {!isEmbed && (
          <TraceSourcePanel
            activeSampleId={activeSampleId}
            loading={state.loading}
            errors={state.errors}
            onSelectSample={(id) => dispatch({ type: 'SELECT_SAMPLE', id })}
            onLocalTrace={(trace, name) => dispatch({ type: 'LOCAL_TRACE', trace, name })}
            onLoadUrl={(url) => dispatch({ type: 'LOAD_URL_START', url })}
            onErrors={(errors) => dispatch({ type: 'SET_ERRORS', errors })}
            showReuploadNotice={showReuploadNotice}
          />
        )}

        <ControlGroup label="View">
          <div className="control-choice-list">
            {viewButtons.map((btn) => (
              <button
                key={btn.id}
                className={`control-choice-button${state.view === btn.id ? ' active' : ''}`}
                onClick={() => !btn.disabled && dispatch({ type: 'SET_VIEW', view: btn.id })}
                disabled={btn.disabled}
                style={btn.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              >
                {btn.label}
              </button>
            ))}
          </div>
          {!hasConstraints && (
            <ControlNote>This trace has no constraint section, so the constraint view is unavailable.</ControlNote>
          )}
        </ControlGroup>

        {state.trace && (
          <ControlGroup label="Trace">
            <ControlCard>
              <span className="control-kicker">{state.trace.meta.protocol}</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                GF({state.trace.meta.field})
              </div>
              <div className="control-caption">
                {state.trace.transcript.length} events · {roundCount} rounds
                {state.trace.constraints ? ` · ${state.trace.constraints.constraints.length} constraints` : ''}
              </div>
              {state.hash && (
                <div style={{ marginTop: 6 }}>
                  <HashBadge hash={state.hash} truncate={12} color="#d946ef" />
                </div>
              )}
            </ControlCard>
          </ControlGroup>
        )}

        {state.view === 'timeline' && state.trace && (
          <ControlGroup label="Playback">
            <SliderControl
              label="Step"
              value={Math.min(state.step, maxStep)}
              min={0}
              max={Math.max(maxStep, 0)}
              onChange={(v) => dispatch({ type: 'SET_STEP', step: v })}
            />
            <ButtonControl
              label={state.playing ? 'Pause' : 'Play'}
              onClick={() => dispatch(state.playing ? { type: 'PAUSE' } : { type: 'PLAY' })}
            />
            <ButtonControl label="Reset" onClick={() => dispatch({ type: 'RESET' })} variant="secondary" />
          </ControlGroup>
        )}

        <ShareSaveDropdown
          demoId="proof-trace"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onExportGif={handleExportGif}
          onCopyAudit={handleCopyAudit}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={draw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
        />
        <CanvasToolbar
          camera={camera}
          storageKey="theora:toolbar:proof-trace"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Proof Trace"
      />
    </DemoLayout>
  );
}

