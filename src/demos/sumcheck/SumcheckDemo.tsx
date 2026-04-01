import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  ToggleControl,
  ButtonControl,
  NumberInputControl,
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
import {
  createPolynomial,
  computeHonestSum,
  evaluateAtPoint,
  runSumcheckProver,
  verifySumcheck,
} from './logic';
import { renderSumcheck, type SumcheckRenderState } from './renderer';

// ── Constants ──────────────────────────────────────────────────────────────

const FIELD_SIZE = 101n;

/** Deterministic challenge values per round — used as the verifier's randomness. */
const CHALLENGES_2 = [37n, 53n];
const CHALLENGES_3 = [37n, 53n, 71n];

/** Default polynomial evaluations for 2 and 3 variables. */
const DEFAULT_VALUES_2: bigint[] = [3n, 5n, 7n, 11n];   // f(00)=3, f(01)=5, f(10)=7, f(11)=11
const DEFAULT_VALUES_3: bigint[] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];

// ── State types ────────────────────────────────────────────────────────────

interface SumcheckDemoState {
  numVariables: 2 | 3;
  fieldSize: bigint;
  values: bigint[];
  claimedSum: bigint;
  honestSum: bigint;
  challenges: bigint[];
  rounds: ReturnType<typeof runSumcheckProver>;
  currentRound: number;
  phase: 'setup' | 'proving' | 'verifying' | 'complete';
  verdict: 'honest' | 'cheating_caught' | null;
  cheatMode: boolean;
}

// ── Actions ────────────────────────────────────────────────────────────────

type SumcheckAction =
  | { type: 'SET_NUM_VARS'; numVars: 2 | 3 }
  | { type: 'SET_VALUE'; index: number; value: bigint }
  | { type: 'SET_CHEAT_MODE'; enabled: boolean }
  | { type: 'STEP' }
  | { type: 'RUN_ALL' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: Partial<SumcheckDemoState> };

// ── Helpers ────────────────────────────────────────────────────────────────

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function buildInitialState(numVars: 2 | 3, cheatMode: boolean, prevValues?: bigint[]): SumcheckDemoState {
  const values = prevValues ?? (numVars === 2 ? DEFAULT_VALUES_2 : DEFAULT_VALUES_3);
  const poly = createPolynomial(numVars, FIELD_SIZE, values);
  const honestSum = computeHonestSum(poly);
  const claimedSum = cheatMode ? mod(honestSum + 1n, FIELD_SIZE) : honestSum;
  const challenges = numVars === 2 ? CHALLENGES_2 : CHALLENGES_3;

  return {
    numVariables: numVars,
    fieldSize: FIELD_SIZE,
    values,
    claimedSum,
    honestSum,
    challenges,
    rounds: [],
    currentRound: 0,
    phase: 'setup',
    verdict: null,
    cheatMode,
  };
}

function computeNextRound(state: SumcheckDemoState): SumcheckDemoState {
  const { numVariables, fieldSize, values, claimedSum, challenges, rounds, currentRound } = state;

  if (currentRound >= numVariables) {
    // All rounds done — do oracle verification
    const poly = createPolynomial(numVariables, fieldSize, values);
    const result = verifySumcheck(poly, claimedSum, rounds, challenges, fieldSize);
    return {
      ...state,
      phase: 'complete',
      verdict: result.passed ? 'honest' : 'cheating_caught',
      currentRound: numVariables + 1,
    };
  }

  // Run prover up through the next round
  const poly = createPolynomial(numVariables, fieldSize, values);
  const nextRoundCount = currentRound + 1;
  const newRounds = runSumcheckProver(poly, claimedSum, challenges, fieldSize).slice(0, nextRoundCount);

  return {
    ...state,
    rounds: newRounds,
    currentRound: nextRoundCount,
    phase: nextRoundCount < numVariables ? 'proving' : 'verifying',
    verdict: null,
  };
}

// ── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: SumcheckDemoState, action: SumcheckAction): SumcheckDemoState {
  switch (action.type) {
    case 'SET_NUM_VARS': {
      if (action.numVars === state.numVariables) return state;
      return buildInitialState(action.numVars, state.cheatMode);
    }

    case 'SET_VALUE': {
      const newValues = [...state.values];
      newValues[action.index] = mod(action.value, state.fieldSize);
      const poly = createPolynomial(state.numVariables, state.fieldSize, newValues);
      const honestSum = computeHonestSum(poly);
      const claimedSum = state.cheatMode ? mod(honestSum + 1n, state.fieldSize) : honestSum;
      return {
        ...state,
        values: newValues,
        honestSum,
        claimedSum,
        rounds: [],
        currentRound: 0,
        phase: 'setup',
        verdict: null,
      };
    }

    case 'SET_CHEAT_MODE': {
      const poly = createPolynomial(state.numVariables, state.fieldSize, state.values);
      const honestSum = computeHonestSum(poly);
      const claimedSum = action.enabled ? mod(honestSum + 1n, state.fieldSize) : honestSum;
      return {
        ...state,
        cheatMode: action.enabled,
        claimedSum,
        rounds: [],
        currentRound: 0,
        phase: 'setup',
        verdict: null,
      };
    }

    case 'STEP':
      return computeNextRound(state);

    case 'RUN_ALL': {
      let s = state;
      // If already complete, reset first
      if (s.phase === 'complete') {
        s = { ...s, rounds: [], currentRound: 0, phase: 'setup', verdict: null };
      }
      // Step through all rounds + oracle
      while (s.phase !== 'complete') {
        s = computeNextRound(s);
      }
      return s;
    }

    case 'RESET':
      return buildInitialState(state.numVariables, state.cheatMode, state.values);

    case 'RESTORE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ── URL serialization helpers ──────────────────────────────────────────────

interface SerializedState {
  numVars?: 2 | 3;
  values?: string[];   // BigInt as decimal strings
  cheatMode?: boolean;
  currentRound?: number;
  phase?: SumcheckDemoState['phase'];
  verdict?: SumcheckDemoState['verdict'];
}

function serializeState(state: SumcheckDemoState): SerializedState {
  return {
    numVars: state.numVariables,
    values: state.values.map(String),
    cheatMode: state.cheatMode,
    currentRound: state.currentRound,
    phase: state.phase,
    verdict: state.verdict ?? undefined,
  };
}

function deserializeState(raw: SerializedState): Partial<SumcheckDemoState> {
  const numVars = raw.numVars === 2 || raw.numVars === 3 ? raw.numVars : 2;
  const values = Array.isArray(raw.values) && raw.values.every(v => typeof v === 'string')
    ? raw.values.map(v => mod(BigInt(v), FIELD_SIZE))
    : (numVars === 2 ? DEFAULT_VALUES_2 : DEFAULT_VALUES_3);
  const cheatMode = typeof raw.cheatMode === 'boolean' ? raw.cheatMode : false;

  const base = buildInitialState(numVars, cheatMode, values);

  // Replay rounds to restore progress
  const targetRound = typeof raw.currentRound === 'number' ? raw.currentRound : 0;
  let restored = { ...base };
  let steps = Math.min(targetRound, numVars + 1);
  while (steps > 0 && restored.phase !== 'complete') {
    restored = computeNextRound(restored);
    steps--;
  }
  if (raw.phase === 'complete' && restored.phase !== 'complete') {
    restored = computeNextRound(restored);
  }

  return restored;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SumcheckDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  const [state, dispatch] = useReducer(reducer, null, () =>
    buildInitialState(2, false),
  );

  // ── Restore from URL on mount ──────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'sumcheck' ? hashState.state : null;
    const decoded = decodeStatePlain<SerializedState>(rawHash)
      ?? decodeState<SerializedState>(getSearchParam('sc'));

    if (!decoded) return;
    const restored = deserializeState(decoded);
    dispatch({ type: 'RESTORE', state: restored });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────
  const buildShareState = useCallback((): SerializedState => serializeState(state), [state]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'sumcheck') return;
    setSearchParams({ sc: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ─────────────────────────────────────────────────────
  useEffect(() => {
    const roundLabel = state.phase === 'setup'
      ? 'Ready to run'
      : state.phase === 'complete'
        ? `Complete — ${state.verdict === 'honest' ? 'sum verified' : 'cheating detected'}`
        : `Round ${state.currentRound} of ${state.numVariables}`;
    let body: string;
    if (state.cheatMode && state.phase === 'complete') {
      body = `Cheating detected: the prover claimed sum ${state.claimedSum} but the honest sum is ${state.honestSum}. `
        + `The round-1 sum check caught the false claim (g(0)+g(1) \u2260 claimed sum). `
        + `Note: the oracle check may still show \u2713 match — this is correct. The oracle compares the last round polynomial against f(r\u2081,\u2026,r\u2099) and the prover evaluated honestly. `
        + `Detection relies on the round checks, not the oracle alone.`;
    } else if (state.cheatMode) {
      body = `Cheat mode: prover claims sum ${state.claimedSum} but honest sum is ${state.honestSum}. The verifier will catch the discrepancy in the round sum checks.`;
    } else {
      body = `Prover sends univariate polynomials each round. Verifier checks g_i(0)+g_i(1) equals the current expected sum, then sends a random challenge r_i.`;
    }
    setEntry('sumcheck', {
      title: roundLabel,
      body,
      nextSteps: [
        'Step through one round at a time',
        'Toggle cheat mode to see detection',
        'Change the number of variables',
      ],
    });
  }, [state.cheatMode, state.claimedSum, state.currentRound, state.honestSum, state.numVariables, state.phase, state.verdict, setEntry]);

  // ── Share handlers ─────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('sc');
    url.hash = `sumcheck|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'sumcheck');
    url.searchParams.set('sc', encodeState(buildShareState()));
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
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-sumcheck.png', showDownloadToast);
  };

  const handleCopyAuditSummary = () => {
    const poly = createPolynomial(state.numVariables, state.fieldSize, state.values);
    const oracleValue = state.rounds.length === state.numVariables
      ? evaluateAtPoint(poly, state.challenges)
      : null;
    const auditRounds = state.rounds.map(r => ({
      roundNumber: r.roundNumber,
      poly: r.univariatePoly.map(String),
      evalAt0: String(r.evalAt0),
      evalAt1: String(r.evalAt1),
      expectedSum: String(r.expectedSum),
      sumCheck: r.sumCheck,
      challenge: r.challenge !== null ? String(r.challenge) : null,
      evalAtChallenge: r.evalAtChallenge !== null ? String(r.evalAtChallenge) : null,
    }));
    const payload = {
      demo: 'sumcheck',
      timestamp: new Date().toISOString(),
      numVariables: state.numVariables,
      fieldSize: String(state.fieldSize),
      values: state.values.map(String),
      challenges: state.challenges.map(String),
      claimedSum: String(state.claimedSum),
      honestSum: String(state.honestSum),
      cheatMode: state.cheatMode,
      phase: state.phase,
      verdict: state.verdict,
      rounds: auditRounds,
      oracleCheck: state.phase === 'complete' ? {
        finalRoundOutput: state.rounds.at(-1)?.evalAtChallenge !== null
          ? String(state.rounds.at(-1)?.evalAtChallenge)
          : null,
        oracleValue: oracleValue !== null ? String(oracleValue) : null,
      } : null,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Full protocol trace including per-round polynomials');
  };

  // ── Canvas draw ────────────────────────────────────────────────────
  const renderState = useMemo<SumcheckRenderState>(() => ({
    numVariables: state.numVariables,
    fieldSize: state.fieldSize,
    claimedSum: state.claimedSum,
    rounds: state.rounds,
    currentRound: state.currentRound,
    verdict: state.verdict,
    phase: state.phase,
  }), [state.claimedSum, state.currentRound, state.fieldSize, state.numVariables, state.phase, state.rounds, state.verdict]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderSumcheck(ctx, frame, renderState, theme);
  }, [renderState, theme]);

  // ── Helpers for sidebar ────────────────────────────────────────────
  const canStep = state.phase !== 'complete';
  const stepLabel = state.phase === 'setup'
    ? 'Start'
    : state.currentRound >= state.numVariables
      ? 'Check Oracle'
      : `Step Round ${state.currentRound + 1}`;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <DemoLayout
      onEmbedPlay={() => dispatch({ type: 'STEP' })}
      embedPlaying={state.phase === 'proving' || state.phase === 'verifying'}
      onEmbedReset={() => dispatch({ type: 'RESET' })}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Configuration */}
        <ControlGroup label="Configuration">
          <SelectControl
            label="Variables"
            value={String(state.numVariables)}
            options={[
              { value: '2', label: '2 variables (4 evaluations)' },
              { value: '3', label: '3 variables (8 evaluations)' },
            ]}
            onChange={(v) => dispatch({ type: 'SET_NUM_VARS', numVars: Number(v) as 2 | 3 })}
          />
          <ControlCard>
            <span className="control-kicker">Field</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              GF({String(state.fieldSize)})
            </div>
            <div className="control-caption">All arithmetic is mod {String(state.fieldSize)}.</div>
          </ControlCard>
          <ToggleControl
            label="Cheat mode"
            checked={state.cheatMode}
            onChange={(v) => dispatch({ type: 'SET_CHEAT_MODE', enabled: v })}
          />
          {state.cheatMode && (
            <ControlNote tone="error">
              Prover claims {String(state.claimedSum)} but honest sum is {String(state.honestSum)}. The final oracle check will catch the mismatch.
            </ControlNote>
          )}
        </ControlGroup>

        {/* Polynomial values */}
        <ControlGroup label="Polynomial Values" collapsible defaultCollapsed={state.numVariables === 3}>
          {state.values.map((v, i) => {
            const key = i.toString(2).padStart(state.numVariables, '0');
            return (
              <NumberInputControl
                key={i}
                label={`f(${key})`}
                value={Number(v)}
                min={0}
                max={Number(state.fieldSize) - 1}
                onChange={(n) => dispatch({ type: 'SET_VALUE', index: i, value: BigInt(n) })}
              />
            );
          })}
          <ControlNote>
            Values are reduced mod {String(state.fieldSize)}.
          </ControlNote>
        </ControlGroup>

        {/* Protocol controls */}
        <ControlGroup label="Protocol">
          <ButtonControl
            label={stepLabel}
            onClick={() => dispatch({ type: 'STEP' })}
            disabled={!canStep}
          />
          <ButtonControl
            label="Run All Rounds"
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
            state.verdict === 'honest' ? 'success' :
            state.verdict === 'cheating_caught' ? 'error' :
            'default'
          }>
            <span className="control-kicker">Phase</span>
            <div className="control-value">
              {state.phase === 'setup' && 'Setup'}
              {state.phase === 'proving' && `Round ${state.currentRound} / ${state.numVariables}`}
              {state.phase === 'verifying' && 'Oracle check'}
              {state.phase === 'complete' && 'Complete'}
            </div>
            {state.verdict && (
              <div className="control-caption" style={{
                color: state.verdict === 'honest' ? 'var(--status-success)' : 'var(--status-error)',
              }}>
                {state.verdict === 'honest' ? 'Honest sum verified' : 'Cheating detected'}
              </div>
            )}
          </ControlCard>

          <ControlCard>
            <span className="control-kicker">Honest sum</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              {String(state.honestSum)}
            </div>
          </ControlCard>

          <ControlCard>
            <span className="control-kicker">Claimed sum</span>
            <div
              className="control-value"
              style={{
                fontFamily: 'var(--font-mono)',
                color: state.cheatMode && state.claimedSum !== state.honestSum
                  ? 'var(--status-error)'
                  : undefined,
              }}
            >
              {String(state.claimedSum)}
            </div>
          </ControlCard>

          {state.rounds.length > 0 && (
            <ControlCard>
              <span className="control-kicker">Round checks</span>
              {state.rounds.map((r) => (
                <div
                  key={r.roundNumber}
                  className="control-caption"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: r.sumCheck ? 'var(--status-success)' : 'var(--status-error)',
                  }}
                >
                  Round {r.roundNumber}: g({String(r.challenge ?? '?')}) = {String(r.evalAtChallenge ?? '?')}
                  {' '}{r.sumCheck ? '✓' : '✗'}
                </div>
              ))}
            </ControlCard>
          )}
        </ControlGroup>

        {/* Share */}
        <ControlGroup label="Share">
          <ShareSaveDropdown
            demoId="sumcheck"
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
          storageKey="theora:toolbar:sumcheck"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Sumcheck Protocol"
      />
    </DemoLayout>
  );
}
