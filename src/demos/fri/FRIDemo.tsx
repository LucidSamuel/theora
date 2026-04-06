import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  ButtonControl,
  SelectControl,
  ControlCard,
  ControlNote,
} from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
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
import { modPow } from '@/lib/math';
import {
  friCommit,
  friQuery,
  type FRICommitPhase,
  type FRIQueryRound,
} from './logic';
import { renderFRI, type FRIRenderState } from './renderer';

// ── Constants ──────────────────────────────────────────────────────────────

const FIELD_SIZE = 257n;

/**
 * omega = 3 is a primitive 256th root of unity in GF(257).
 * For an evaluation domain of size n, we use omega^(256/n) to get
 * an n-th root of unity.
 */
const OMEGA_256 = 3n;

/** Pre-computed challenge sets. */
const DEFAULT_CHALLENGES: bigint[] = [37n, 53n, 71n, 89n, 97n, 23n, 41n, 67n];

/** Default query indices. */
const DEFAULT_QUERY_INDICES = [0, 2];

// ── State types ────────────────────────────────────────────────────────────

interface FRIDemoState {
  coefficients: bigint[];
  fieldSize: bigint;
  omega: bigint;
  degree: number;        // coefficient count / domain size: 4, 8, or 16
  challenges: bigint[];
  queryIndices: number[];
  // Runtime
  commitPhase: FRICommitPhase | null;
  queries: FRIQueryRound[];
  accepted: boolean | null;
  currentLayer: number;  // -1 = not started, 0..n = stepping through layers
  phase: 'setup' | 'committing' | 'querying' | 'complete';
}

// ── Actions ────────────────────────────────────────────────────────────────

type FRIAction =
  | { type: 'SET_DEGREE'; degree: number }
  | { type: 'RANDOMIZE_COEFFICIENTS' }
  | { type: 'RUN_COMMIT' }
  | { type: 'RUN_QUERIES' }
  | { type: 'STEP' }
  | { type: 'RUN_ALL' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: Partial<FRIDemoState> };

// ── Helpers ────────────────────────────────────────────────────────────────

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function randomCoeffs(degree: number): bigint[] {
  const coeffs: bigint[] = [];
  for (let i = 0; i < degree; i++) {
    coeffs.push(BigInt(Math.floor(Math.random() * 256) + 1));
  }
  return coeffs;
}

function defaultCoeffs(degree: number): bigint[] {
  // Deterministic defaults for each supported size
  const defaults: Record<number, bigint[]> = {
    4: [3n, 7n, 11n, 5n],
    8: [3n, 7n, 11n, 5n, 13n, 2n, 9n, 4n],
    16: [3n, 7n, 11n, 5n, 13n, 2n, 9n, 4n, 6n, 8n, 14n, 1n, 10n, 15n, 12n, 16n],
  };
  return defaults[degree] ?? defaults[4]!;
}

function computeOmega(degree: number): bigint {
  // omega^(256/degree) gives us a degree-point evaluation domain in GF(257)
  const exp = 256n / BigInt(degree);
  return modPow(OMEGA_256, exp, FIELD_SIZE);
}

function buildInitialState(degree: number, coefficients?: bigint[]): FRIDemoState {
  const coeffs = coefficients ?? defaultCoeffs(degree);
  const omega = computeOmega(degree);
  return {
    coefficients: coeffs,
    fieldSize: FIELD_SIZE,
    omega,
    degree,
    challenges: DEFAULT_CHALLENGES.slice(0, Math.log2(degree)),
    queryIndices: DEFAULT_QUERY_INDICES.filter(i => i < degree),
    commitPhase: null,
    queries: [],
    accepted: null,
    currentLayer: -1,
    phase: 'setup',
  };
}

// ── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: FRIDemoState, action: FRIAction): FRIDemoState {
  switch (action.type) {
    case 'SET_DEGREE': {
      const d = action.degree;
      if (d === state.degree) return state;
      return buildInitialState(d);
    }

    case 'RANDOMIZE_COEFFICIENTS': {
      const coeffs = randomCoeffs(state.degree);
      return {
        ...buildInitialState(state.degree, coeffs),
      };
    }

    case 'RUN_COMMIT': {
      try {
        const commitPhase = friCommit(
          state.coefficients,
          state.omega,
          state.fieldSize,
          state.challenges,
        );
        return {
          ...state,
          commitPhase,
          queries: [],
          accepted: null,
          currentLayer: commitPhase.layers.length - 1,
          phase: 'committing',
        };
      } catch {
        return state;
      }
    }

    case 'RUN_QUERIES': {
      if (!state.commitPhase) return state;
      try {
        const queries = friQuery(state.commitPhase, state.queryIndices, state.fieldSize);
        const finalLayer = state.commitPhase.layers[state.commitPhase.layers.length - 1]!;
        const finalConstant = finalLayer.evaluations[0]!;
        const isConstant = finalLayer.evaluations.every(v => v === finalConstant);
        const allConsistent = queries.every(q => q.layerValues.every(lv => lv.consistent));
        return {
          ...state,
          queries,
          accepted: isConstant && allConsistent,
          phase: 'complete',
        };
      } catch {
        return state;
      }
    }

    case 'STEP': {
      if (state.phase === 'setup') {
        // Start commit phase
        return reducer(state, { type: 'RUN_COMMIT' });
      }
      if (state.phase === 'committing') {
        // Move to query phase
        return reducer(state, { type: 'RUN_QUERIES' });
      }
      return state;
    }

    case 'RUN_ALL': {
      let s = state;
      if (s.phase === 'complete') {
        s = buildInitialState(s.degree, s.coefficients);
      }
      // Commit
      s = reducer(s, { type: 'RUN_COMMIT' });
      // Query
      s = reducer(s, { type: 'RUN_QUERIES' });
      return s;
    }

    case 'RESET':
      return buildInitialState(state.degree, state.coefficients);

    case 'RESTORE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ── URL serialization helpers ──────────────────────────────────────────────

interface SerializedState {
  degree?: number;
  coefficients?: string[];
  phase?: FRIDemoState['phase'];
  accepted?: boolean | null;
}

function serializeState(state: FRIDemoState): SerializedState {
  return {
    degree: state.degree,
    coefficients: state.coefficients.map(String),
    phase: state.phase,
    accepted: state.accepted,
  };
}

function deserializeState(raw: SerializedState): Partial<FRIDemoState> {
  const degree = raw.degree === 4 || raw.degree === 8 || raw.degree === 16 ? raw.degree : 4;
  const coefficients = Array.isArray(raw.coefficients) && raw.coefficients.every(v => typeof v === 'string')
    ? raw.coefficients.map(v => mod(BigInt(v), FIELD_SIZE))
    : defaultCoeffs(degree);

  const base = buildInitialState(degree, coefficients);

  // If the saved state was complete, replay the protocol
  if (raw.phase === 'committing' || raw.phase === 'querying' || raw.phase === 'complete') {
    let restored = reducer(base, { type: 'RUN_COMMIT' });
    if (raw.phase === 'querying' || raw.phase === 'complete') {
      restored = reducer(restored, { type: 'RUN_QUERIES' });
    }
    return restored;
  }

  return base;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FRIDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  const [state, dispatch] = useReducer(reducer, null, () =>
    buildInitialState(4),
  );

  // ── Restore from URL on mount ──────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'fri' ? hashState.state : null;
    const decoded = decodeStatePlain<SerializedState>(rawHash)
      ?? decodeState<SerializedState>(getSearchParam('fri'));

    if (!decoded) return;
    const restored = deserializeState(decoded);
    dispatch({ type: 'RESTORE', state: restored });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────
  const buildShareState = useCallback((): SerializedState => serializeState(state), [state]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'fri') return;
    setSearchParams({ fri: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ─────────────────────────────────────────────────────
  useEffect(() => {
    const layerCount = state.commitPhase?.layers.length ?? 0;
    const phaseLabel = state.phase === 'setup'
      ? 'Ready to run'
      : state.phase === 'committing'
        ? `Commit phase complete \u2014 ${layerCount} layers`
        : state.phase === 'querying'
          ? 'Running consistency queries'
          : state.phase === 'complete'
            ? `Complete \u2014 ${state.accepted ? 'accepted' : 'rejected'}`
            : '';
    setEntry('fri', {
      title: phaseLabel,
      body: state.phase === 'setup'
        ? `${state.degree}-point domain over GF(257) for a max-degree-${state.degree - 1} polynomial. The commit phase will fold the domain ${Math.log2(state.degree)} times, halving the degree bound each round.`
        : state.phase === 'committing'
          ? `${layerCount} layers produced. Domain went from ${state.degree} points down to 1. Each fold used a verifier challenge \u03b1 to combine even and odd polynomial parts while lowering the degree bound.`
          : `Query phase checks that folding was done honestly by sampling random positions and walking through the layers.`,
      nextSteps: [
        'Run the commit phase to see domain folding',
        'Inspect query consistency checks',
        'Try different domain sizes',
      ],
    });
  }, [state.accepted, state.commitPhase?.layers.length, state.degree, state.phase, setEntry]);

  // ── Share handlers ─────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('fri');
    url.hash = `fri|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment \u2014 no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'fri');
    url.searchParams.set('fri', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 900;
    const h = rect.height || 600;
    fitCameraToBounds(
      camera,
      canvas,
      { minX: 40, minY: 40, maxX: w - 40, maxY: h - 56 },
      options?.instant ? { durationMs: 0 } : undefined,
    );
  }, [camera]);

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-fri.png', showDownloadToast);
  };


  const handleCopyAuditSummary = () => {
    const layers = state.commitPhase?.layers.map((l, i) => ({
      layer: i,
      degree: l.degree,
      domainSize: l.domain.length,
      challenge: l.challenge !== null ? String(l.challenge) : null,
      evaluationCount: l.evaluations.length,
    })) ?? [];

    const queryResults = state.queries.map(q => ({
      queryIndex: q.queryIndex,
      layerChecks: q.layerValues.map(lv => ({
        value: String(lv.value),
        siblingValue: String(lv.siblingValue),
        foldedValue: String(lv.foldedValue),
        consistent: lv.consistent,
      })),
    }));

    const payload = {
      demo: 'fri',
      timestamp: new Date().toISOString(),
      coefficientCount: state.degree,
      maxDegree: state.degree - 1,
      fieldSize: String(state.fieldSize),
      coefficients: state.coefficients.map(String),
      challenges: state.challenges.map(String),
      queryIndices: state.queryIndices,
      phase: state.phase,
      accepted: state.accepted,
      finalConstant: state.commitPhase?.finalConstant !== undefined
        ? String(state.commitPhase.finalConstant)
        : null,
      layers,
      queries: queryResults,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Full FRI protocol trace including per-layer and per-query data');
  };

  // ── Canvas draw ────────────────────────────────────────────────────
  const renderState = useMemo<FRIRenderState>(() => ({
    layers: state.commitPhase?.layers ?? [],
    queries: state.queries,
    fieldSize: state.fieldSize,
    currentLayer: state.currentLayer,
    phase: state.phase,
    accepted: state.accepted,
    finalConstant: state.commitPhase?.finalConstant ?? null,
  }), [state.commitPhase, state.queries, state.fieldSize, state.currentLayer, state.phase, state.accepted]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderFRI(ctx, frame, renderState, theme);
  }, [renderState, theme]);

  // ── Sidebar helpers ────────────────────────────────────────────────
  const canStep = state.phase !== 'complete';
  const stepLabel = state.phase === 'setup'
    ? 'Run Commit Phase'
    : state.phase === 'committing'
      ? 'Run Queries'
      : 'Complete';

  const layerCount = state.commitPhase?.layers.length ?? 0;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <DemoLayout
      onEmbedPlay={() => dispatch({ type: 'STEP' })}
      embedPlaying={state.phase === 'committing' || state.phase === 'querying'}
      onEmbedReset={() => dispatch({ type: 'RESET' })}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Configuration */}
        <ControlGroup label="Configuration">
          <SelectControl
            label="Domain size"
            value={String(state.degree)}
            options={[
              { value: '4', label: '4 coefficients (max degree 3)' },
              { value: '8', label: '8 coefficients (max degree 7)' },
              { value: '16', label: '16 coefficients (max degree 15)' },
            ]}
            onChange={(v) => dispatch({ type: 'SET_DEGREE', degree: Number(v) })}
          />
          <ControlCard>
            <span className="control-kicker">Field</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              GF({String(state.fieldSize)})
            </div>
            <div className="control-caption">
              257 = 2^8 + 1, giving convenient roots of unity.
            </div>
          </ControlCard>
          <ButtonControl
            label="Randomize Coefficients"
            onClick={() => dispatch({ type: 'RANDOMIZE_COEFFICIENTS' })}
            variant="secondary"
          />
          <ControlNote>
            Polynomial has {state.degree} coefficients, so its max degree is {state.degree - 1}.
          </ControlNote>
        </ControlGroup>

        {/* Coefficients display */}
        <ControlGroup label="Polynomial" collapsible defaultCollapsed={state.degree > 8}>
          <ControlCard>
            <span className="control-kicker">Coefficients</span>
            <div
              className="control-value"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.6,
                wordBreak: 'break-all',
              }}
            >
              [{state.coefficients.map(String).join(', ')}]
            </div>
          </ControlCard>
          <ControlCard>
            <span className="control-kicker">Root of unity ω</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              {String(state.omega)}
            </div>
            <div className="control-caption">
              3^({256 / state.degree}) mod 257
            </div>
          </ControlCard>
        </ControlGroup>

        {/* Protocol controls */}
        <ControlGroup label="Protocol">
          <ButtonControl
            label={stepLabel}
            onClick={() => dispatch({ type: 'STEP' })}
            disabled={!canStep}
          />
          <ButtonControl
            label="Run All"
            onClick={() => dispatch({ type: 'RUN_ALL' })}
          />
          <ButtonControl
            label="Reset"
            onClick={() => dispatch({ type: 'RESET' })}
            variant="secondary"
          />
        </ControlGroup>

        {/* Status */}
        <ControlGroup label="Status">
          <ControlCard tone={
            state.accepted === true ? 'success' :
            state.accepted === false ? 'error' :
            'default'
          }>
            <span className="control-kicker">Phase</span>
            <div className="control-value">
              {state.phase === 'setup' && 'Setup'}
              {state.phase === 'committing' && `Committed \u2014 ${layerCount} layers`}
              {state.phase === 'querying' && 'Querying'}
              {state.phase === 'complete' && 'Complete'}
            </div>
            {state.accepted !== null && (
              <div className="control-caption" style={{
                color: state.accepted ? 'var(--status-success)' : 'var(--status-error)',
              }}>
                {state.accepted ? 'Proof accepted' : 'Proof rejected'}
              </div>
            )}
          </ControlCard>

          {state.commitPhase && (
            <>
              <ControlCard>
                <span className="control-kicker">Layers</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {layerCount} ({Math.log2(state.degree)} fold rounds)
                </div>
              </ControlCard>

              <ControlCard>
                <span className="control-kicker">Final constant</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {String(state.commitPhase.finalConstant)}
                </div>
              </ControlCard>
            </>
          )}

          {state.queries.length > 0 && (
            <ControlCard>
              <span className="control-kicker">Query results</span>
              {state.queries.map((q) => {
                const allPass = q.layerValues.every(lv => lv.consistent);
                return (
                  <div
                    key={q.queryIndex}
                    className="control-caption"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: allPass ? 'var(--status-success)' : 'var(--status-error)',
                    }}
                  >
                    Query {q.queryIndex}: {q.layerValues.length} checks {allPass ? '\u2713' : '\u2717'}
                  </div>
                );
              })}
            </ControlCard>
          )}
        </ControlGroup>

        {/* Share */}
        <ControlGroup label="Share">
          <ShareSaveDropdown
            demoId="fri"
            onCopyShareUrl={handleCopyShareUrl}
            onCopyHashUrl={handleCopyHashUrl}
            onCopyEmbed={handleCopyEmbed}
            onExportPng={handleExportPng}
            onCopyAudit={handleCopyAuditSummary}
          />
        </ControlGroup>
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
          storageKey="theora:toolbar:fri"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="FRI Protocol"
      />
    </DemoLayout>
  );
}
