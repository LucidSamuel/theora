import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  ButtonControl,
  NumberInputControl,
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
import {
  createMLE,
  evaluateMLE,
  partialEvaluate,
  sumOverHypercube,
  type MLEFunction,
  type MLEEvaluation,
  type PartialEvalResult,
} from './logic';
import { renderMLE, type MLERenderState } from './renderer';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_FIELD_SIZE = 101n;

const DEFAULT_VALUES_1: bigint[] = [3n, 7n];
const DEFAULT_VALUES_2: bigint[] = [3n, 5n, 7n, 11n];
const DEFAULT_VALUES_3: bigint[] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];

function defaultValuesFor(numVars: number): bigint[] {
  if (numVars === 1) return [...DEFAULT_VALUES_1];
  if (numVars === 3) return [...DEFAULT_VALUES_3];
  return [...DEFAULT_VALUES_2];
}

// ── State types ────────────────────────────────────────────────────────────

interface MLEDemoState {
  numVars: number;         // 1-3
  fieldSize: bigint;       // 101n
  values: bigint[];        // 2^numVars values
  evalPoint: bigint[];     // evaluation point
  fixedVars: bigint[];     // for partial evaluation
  evaluation: MLEEvaluation | null;
  partialResult: PartialEvalResult | null;
  attackClaim: bigint | null;
  phase: 'viewing' | 'evaluating' | 'partial';
}

// ── Actions ────────────────────────────────────────────────────────────────

type MLEAction =
  | { type: 'SET_NUM_VARS'; numVars: number }
  | { type: 'SET_VALUE'; index: number; value: bigint }
  | { type: 'SET_EVAL_POINT_COORD'; index: number; value: bigint }
  | { type: 'SET_FIXED_VAR'; index: number; value: bigint }
  | { type: 'EVALUATE' }
  | { type: 'PARTIAL_EVALUATE' }
  | { type: 'LOAD_ATTACK_EVALUATION'; point: bigint[]; claimedValue?: bigint }
  | { type: 'RANDOMIZE' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: Partial<MLEDemoState> };

// ── Helpers ────────────────────────────────────────────────────────────────

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function buildInitialState(numVars: number, fieldSize?: bigint, values?: bigint[]): MLEDemoState {
  const p = fieldSize ?? DEFAULT_FIELD_SIZE;
  const n = Math.max(1, Math.min(3, numVars));
  const vals = values ?? defaultValuesFor(n);
  const evalPoint = Array.from({ length: n }, () => 0n);
  const fixedVars: bigint[] = [0n];

  return {
    numVars: n,
    fieldSize: p,
    values: vals.map(v => mod(v, p)),
    evalPoint,
    fixedVars,
    evaluation: null,
    partialResult: null,
    attackClaim: null,
    phase: 'viewing',
  };
}

// ── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: MLEDemoState, action: MLEAction): MLEDemoState {
  switch (action.type) {
    case 'SET_NUM_VARS': {
      const n = Math.max(1, Math.min(3, action.numVars));
      if (n === state.numVars) return state;
      return buildInitialState(n, state.fieldSize);
    }

    case 'SET_VALUE': {
      const newValues = [...state.values];
      newValues[action.index] = mod(action.value, state.fieldSize);
      return {
        ...state,
        values: newValues,
        evaluation: null,
        partialResult: null,
        attackClaim: null,
        phase: 'viewing',
      };
    }

    case 'SET_EVAL_POINT_COORD': {
      const newPoint = [...state.evalPoint];
      newPoint[action.index] = mod(action.value, state.fieldSize);
      return { ...state, evalPoint: newPoint, attackClaim: null };
    }

    case 'SET_FIXED_VAR': {
      const newFixed = [...state.fixedVars];
      // Ensure array is large enough
      while (newFixed.length <= action.index) {
        newFixed.push(0n);
      }
      newFixed[action.index] = mod(action.value, state.fieldSize);
      return { ...state, fixedVars: newFixed, attackClaim: null };
    }

    case 'EVALUATE': {
      const mle = createMLE(state.numVars, state.fieldSize, state.values);
      const evaluation = evaluateMLE(mle, state.evalPoint);
      return {
        ...state,
        evaluation,
        partialResult: null,
        attackClaim: null,
        phase: 'evaluating',
      };
    }

    case 'PARTIAL_EVALUATE': {
      const mle = createMLE(state.numVars, state.fieldSize, state.values);
      const trimmedFixed = state.fixedVars.slice(0, state.numVars);
      // Ensure we have at least 1 fixed var but not more than numVars
      const fixedCount = Math.max(1, Math.min(trimmedFixed.length, state.numVars));
      const fixedSlice = trimmedFixed.slice(0, fixedCount);
      const result = partialEvaluate(mle, fixedSlice);
      return {
        ...state,
        partialResult: result,
        evaluation: null,
        attackClaim: null,
        phase: 'partial',
      };
    }

    case 'LOAD_ATTACK_EVALUATION': {
      const numVars = Math.max(1, Math.min(3, action.point.length || state.numVars));
      const attackState = buildInitialState(numVars, state.fieldSize);
      const point = action.point
        .slice(0, numVars)
        .map((value) => mod(value, attackState.fieldSize));
      if (point.length !== numVars) return state;
      const mle = createMLE(attackState.numVars, attackState.fieldSize, attackState.values);
      const evaluation = evaluateMLE(mle, point);
      return {
        ...attackState,
        evalPoint: point,
        evaluation,
        partialResult: null,
        attackClaim: typeof action.claimedValue === 'bigint'
          ? mod(action.claimedValue, attackState.fieldSize)
          : null,
        phase: 'evaluating',
      };
    }

    case 'RANDOMIZE': {
      const count = 1 << state.numVars;
      const p = state.fieldSize;
      const newValues = Array.from({ length: count }, () =>
        mod(BigInt(Math.floor(Math.random() * Number(p))), p),
      );
      return {
        ...state,
        values: newValues,
        evaluation: null,
        partialResult: null,
        attackClaim: null,
        phase: 'viewing',
      };
    }

    case 'RESET':
      return buildInitialState(state.numVars, state.fieldSize);

    case 'RESTORE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ── URL serialization helpers ──────────────────────────────────────────────

interface SerializedState {
  numVars?: number;
  fieldSize?: string;
  values?: string[];
  evalPoint?: string[];
  fixedVars?: string[];
  phase?: MLEDemoState['phase'];
}

function serializeState(state: MLEDemoState): SerializedState {
  return {
    numVars: state.numVars,
    fieldSize: String(state.fieldSize),
    values: state.values.map(String),
    evalPoint: state.evalPoint.map(String),
    fixedVars: state.fixedVars.map(String),
    phase: state.phase,
  };
}

function deserializeState(raw: SerializedState): Partial<MLEDemoState> {
  const numVars = typeof raw.numVars === 'number' && raw.numVars >= 1 && raw.numVars <= 3
    ? raw.numVars : 2;
  const fieldSize = raw.fieldSize ? BigInt(raw.fieldSize) : DEFAULT_FIELD_SIZE;
  const expectedCount = 1 << numVars;

  const values = Array.isArray(raw.values) && raw.values.length === expectedCount
    ? raw.values.map(v => mod(BigInt(v), fieldSize))
    : defaultValuesFor(numVars);

  const evalPoint = Array.isArray(raw.evalPoint) && raw.evalPoint.length === numVars
    ? raw.evalPoint.map(v => mod(BigInt(v), fieldSize))
    : Array.from({ length: numVars }, () => 0n);

  const fixedVars = Array.isArray(raw.fixedVars)
    ? raw.fixedVars.map(v => mod(BigInt(v), fieldSize))
    : [0n];

  const base = buildInitialState(numVars, fieldSize, values);
  base.evalPoint = evalPoint;
  base.fixedVars = fixedVars;

  // Replay phase if needed
  if (raw.phase === 'evaluating') {
    const mle = createMLE(numVars, fieldSize, values);
    base.evaluation = evaluateMLE(mle, evalPoint);
    base.phase = 'evaluating';
  } else if (raw.phase === 'partial') {
    const mle = createMLE(numVars, fieldSize, values);
    const fixedCount = Math.max(1, Math.min(fixedVars.length, numVars));
    base.partialResult = partialEvaluate(mle, fixedVars.slice(0, fixedCount));
    base.phase = 'partial';
  }

  return base;
}

// ── Symbolic formula builder ──────────────────────────────────────────────

function buildSymbolicFormula(numVars: number, values: bigint[]): string {
  const count = 1 << numVars;
  const subscripts = ['\u2081', '\u2082', '\u2083'];
  const varNames = Array.from({ length: numVars }, (_, i) => `x${subscripts[i] ?? String(i + 1)}`);
  const terms: string[] = [];

  for (let idx = 0; idx < count; idx++) {
    const v = values[idx]!;
    if (v === 0n) continue;
    const bits = idx.toString(2).padStart(numVars, '0');
    const factors: string[] = [];
    for (let i = 0; i < numVars; i++) {
      if (bits[i] === '1') {
        factors.push(varNames[i]!);
      } else {
        factors.push(`(1-${varNames[i]!})`);
      }
    }
    terms.push(`${String(v)}\u00b7${factors.join('')}`);
  }

  if (terms.length === 0) return `f\u0303(${varNames.join(',')}) = 0`;
  return `f\u0303(${varNames.join(',')}) = ${terms.join(' + ')}`;
}

/**
 * Check if all evaluation point coordinates are 0 or 1 (boolean).
 * If so, return the corresponding hypercube vertex index and bit string.
 */
function booleanPointInfo(
  evalPoint: bigint[],
  fieldSize: bigint,
): { isBool: true; bits: string; index: number } | { isBool: false } {
  for (const coord of evalPoint) {
    const c = ((coord % fieldSize) + fieldSize) % fieldSize;
    if (c !== 0n && c !== 1n) return { isBool: false };
  }
  const bits = evalPoint.map((c) => {
    const v = ((c % fieldSize) + fieldSize) % fieldSize;
    return v === 1n ? '1' : '0';
  }).join('');
  const index = parseInt(bits, 2);
  return { isBool: true, bits, index };
}

// ── Component ──────────────────────────────────────────────────────────────

export function MLEDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const { currentDemoAction } = useAttack();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  const [state, dispatch] = useReducer(reducer, null, () =>
    buildInitialState(2),
  );

  // Derived MLE
  const mle: MLEFunction = useMemo(
    () => createMLE(state.numVars, state.fieldSize, state.values),
    [state.numVars, state.fieldSize, state.values],
  );
  const hypercubeSum = useMemo(() => sumOverHypercube(mle), [mle]);

  // Derived symbolic formula
  const symbolicFormula = useMemo(
    () => buildSymbolicFormula(state.numVars, state.values),
    [state.numVars, state.values],
  );

  useAttackActions(currentDemoAction, useMemo(() => ({
    SET_VARIABLES: (payload) => {
      if (typeof payload !== 'number' || !Number.isInteger(payload)) return;
      dispatch({ type: 'RESTORE', state: buildInitialState(payload) });
    },
    LOAD_ATTACK_EVALUATION: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const point = Array.isArray((payload as { point?: unknown }).point)
        ? (payload as { point: unknown[] }).point
        : null;
      if (!point || point.some((coord) => typeof coord !== 'number' || !Number.isInteger(coord))) {
        return;
      }
      const claimedValue = (payload as { claimedValue?: unknown }).claimedValue;
      dispatch({
        type: 'LOAD_ATTACK_EVALUATION',
        point: point.map((coord) => BigInt(coord as number)),
        claimedValue: typeof claimedValue === 'number' && Number.isFinite(claimedValue)
          && Number.isInteger(claimedValue)
          ? BigInt(claimedValue)
          : undefined,
      });
    },
  }), [currentDemoAction]));

  // ── Restore from URL on mount ──────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'mle' ? hashState.state : null;
    const decoded = decodeStatePlain<SerializedState>(rawHash)
      ?? decodeState<SerializedState>(getSearchParam('mle'));

    if (!decoded) return;
    try {
      const restored = deserializeState(decoded);
      dispatch({ type: 'RESTORE', state: restored });
    } catch {
      // Invalid state — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────
  const buildShareState = useCallback((): SerializedState => serializeState(state), [state]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'mle') return;
    setSearchParams({ mle: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ─────────────────────────────────────────────────────
  useEffect(() => {
    const phaseLabel = state.phase === 'viewing'
      ? 'Viewing hypercube'
      : state.phase === 'evaluating' && state.attackClaim !== null
        ? `Verifier rejected claim ${String(state.attackClaim)}`
      : state.phase === 'evaluating'
        ? `Evaluated at (${state.evalPoint.map(String).join(', ')})`
        : `Partial eval: ${state.fixedVars.length} var${state.fixedVars.length !== 1 ? 's' : ''} fixed`;
    setEntry('mle', {
      title: phaseLabel,
      body: state.phase === 'evaluating' && state.evaluation && state.attackClaim !== null
        ? `Claimed f̃(r) = ${String(state.attackClaim)}, but the verifier recomputed ${String(state.evaluation.value)} from the public hypercube values and rejected the forgery.`
        : state.phase === 'evaluating' && state.evaluation
        ? `f\u0303(r) = ${String(state.evaluation.value)}. Each vertex contributes f(v)\u00B7eq(r,v) to the sum.`
        : state.phase === 'partial' && state.partialResult
          ? `Reduced to ${state.partialResult.remainingVars} variable${state.partialResult.remainingVars !== 1 ? 's' : ''} with ${state.partialResult.evaluations.length} points.`
          : `The MLE extends ${1 << state.numVars} hypercube values to a multilinear polynomial over GF(${String(state.fieldSize)}).`,
      nextSteps: [
        'Edit hypercube values and evaluate at a non-boolean point',
        'Use partial evaluation to see dimension reduction',
        'Compare the eq-basis weights at different points',
      ],
    });
  }, [state.phase, state.evalPoint, state.evaluation, state.partialResult, state.numVars, state.fieldSize, state.fixedVars.length, state.attackClaim, setEntry]);

  // ── Share handlers ─────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('mle');
    url.hash = `mle|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment \u2014 no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'mle');
    url.searchParams.set('mle', encodeState(buildShareState()));
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
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-mle.png', showDownloadToast);
  };


  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'mle',
      timestamp: new Date().toISOString(),
      numVars: state.numVars,
      fieldSize: String(state.fieldSize),
      values: state.values.map(String),
      hypercubeSum: String(hypercubeSum),
      phase: state.phase,
      evalPoint: state.evalPoint.map(String),
      evaluation: state.evaluation ? {
        point: state.evaluation.point.map(String),
        value: String(state.evaluation.value),
        basisTerms: state.evaluation.basisTerms.map(t => ({
          vertex: t.vertex,
          weight: String(t.weight),
        })),
      } : null,
      partialResult: state.partialResult ? {
        fixedVars: state.partialResult.fixedVars.map(String),
        remainingVars: state.partialResult.remainingVars,
        evaluations: state.partialResult.evaluations.map(e => ({
          bits: e.bits,
          value: String(e.value),
        })),
      } : null,
      attackClaim: state.attackClaim === null ? null : String(state.attackClaim),
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Full MLE state including basis terms');
  };

  // ── Canvas draw ────────────────────────────────────────────────────
  const renderState = useMemo<MLERenderState>(() => ({
    mle,
    evaluation: state.evaluation,
    partialResult: state.partialResult,
    attackClaim: state.attackClaim,
    hypercubeSum,
    phase: state.phase,
  }), [mle, state.evaluation, state.partialResult, state.attackClaim, hypercubeSum, state.phase]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderMLE(ctx, frame, renderState, theme);
  }, [renderState, theme]);

  // ── Derived labels ─────────────────────────────────────────────────
  const numVarsOptions = [
    { value: '1', label: '1 variable (2 points)' },
    { value: '2', label: '2 variables (4 points)' },
    { value: '3', label: '3 variables (8 points)' },
  ];

  // How many fixed vars for partial evaluation (1 to numVars-1, at least 1)
  const maxFixedVars = Math.max(1, state.numVars - 1);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <DemoLayout
      onEmbedPlay={() => dispatch({ type: 'EVALUATE' })}
      embedPlaying={state.phase === 'evaluating'}
      onEmbedReset={() => dispatch({ type: 'RESET' })}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Configuration */}
        <ControlGroup label="Configuration">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              className="text-[11px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Variables
            </label>
            <div className="control-choice-list">
              {numVarsOptions.map(opt => (
                <button
                  key={opt.value}
                  className={`control-choice-button${String(state.numVars) === opt.value ? ' active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_NUM_VARS', numVars: Number(opt.value) })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <ControlCard>
            <span className="control-kicker">Field</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              GF({String(state.fieldSize)})
            </div>
            <div className="control-caption">All arithmetic is mod {String(state.fieldSize)}.</div>
          </ControlCard>
          <ButtonControl
            label="Randomize Values"
            onClick={() => dispatch({ type: 'RANDOMIZE' })}
            variant="secondary"
          />
        </ControlGroup>

        {/* Hypercube Values */}
        <ControlGroup label="Hypercube Values" collapsible defaultCollapsed={state.numVars === 3} ariaLabel="Toggle hypercube values">
          {state.values.map((v, i) => {
            const bits = i.toString(2).padStart(state.numVars, '0');
            return (
              <NumberInputControl
                key={`${state.numVars}-${i}`}
                label={`f(${bits})`}
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

        {/* Symbolic Formula */}
        <ControlGroup label="Formula" collapsible ariaLabel="Toggle formula">
          <ControlCard>
            <span className="control-kicker">Multilinear extension</span>
            <div
              className="control-caption"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {symbolicFormula}
            </div>
          </ControlCard>
        </ControlGroup>

        {/* Evaluate MLE */}
        <ControlGroup label="Evaluate MLE">
          {state.evalPoint.map((v, i) => (
            <NumberInputControl
              key={`eval-${state.numVars}-${i}`}
              label={`r${i + 1}`}
              value={Number(v)}
              min={0}
              max={Number(state.fieldSize) - 1}
              onChange={(n) => dispatch({ type: 'SET_EVAL_POINT_COORD', index: i, value: BigInt(n) })}
            />
          ))}
          <ButtonControl
            label="Evaluate"
            onClick={() => dispatch({ type: 'EVALUATE' })}
          />
          {state.evaluation && state.phase === 'evaluating' && (() => {
            const bpInfo = booleanPointInfo(state.evalPoint, state.fieldSize);
            return (
              <ControlCard tone="success">
                <span className="control-kicker">Result</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  f&#x0303;(r) = {String(state.evaluation.value)}
                </div>
                <div className="control-caption">
                  Sum of {state.evaluation.basisTerms.length} weighted terms.
                </div>
                {bpInfo.isBool && (
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    f&#x0303;({state.evalPoint.map(String).join(',')}) = f({bpInfo.bits}) = {String(state.evaluation.value)} (hypercube vertex)
                  </div>
                )}
              </ControlCard>
            );
          })()}
          {state.evaluation && state.phase === 'evaluating' && state.attackClaim !== null && (
            <ControlCard tone={state.attackClaim === state.evaluation.value ? 'success' : 'error'}>
              <span className="control-kicker">Forgery attempt</span>
              <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                Claimed f&#x0303;(r) = {String(state.attackClaim)}
              </div>
              <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                Verifier recomputed {String(state.evaluation.value)} from the public hypercube values
              </div>
              <div className="control-caption">
                {state.attackClaim === state.evaluation.value ? 'Claim accepted.' : 'Claim rejected — the multilinear extension is deterministic once the cube values are fixed.'}
              </div>
            </ControlCard>
          )}
        </ControlGroup>

        {/* Partial Evaluation */}
        <ControlGroup label="Partial Evaluation" collapsible ariaLabel="Toggle partial evaluation">
          <ControlNote>
            Fix the first k variables to field values, reducing the dimension.
          </ControlNote>
          {Array.from({ length: maxFixedVars }, (_, i) => (
            <NumberInputControl
              key={`fixed-${state.numVars}-${i}`}
              label={`x${i + 1}`}
              value={Number(state.fixedVars[i] ?? 0n)}
              min={0}
              max={Number(state.fieldSize) - 1}
              onChange={(n) => dispatch({ type: 'SET_FIXED_VAR', index: i, value: BigInt(n) })}
            />
          ))}
          <ButtonControl
            label="Partial Evaluate"
            onClick={() => dispatch({ type: 'PARTIAL_EVALUATE' })}
          />
          {state.partialResult && state.phase === 'partial' && (
            <ControlCard>
              <span className="control-kicker">Reduced hypercube</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {state.partialResult.remainingVars} var{state.partialResult.remainingVars !== 1 ? 's' : ''}, {state.partialResult.evaluations.length} points
              </div>
              {state.partialResult.evaluations.map((pt, i) => (
                <div key={i} className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                  f({pt.bits.join('')}) = {String(pt.value)}
                </div>
              ))}
            </ControlCard>
          )}
        </ControlGroup>

        {/* Summary */}
        <ControlGroup label="Summary">
          <ControlCard>
            <span className="control-kicker">Hypercube sum</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              {String(hypercubeSum)}
            </div>
            <div className="control-caption">{1 << state.numVars} evaluation points.</div>
          </ControlCard>
          <ButtonControl
            label="Reset"
            onClick={() => dispatch({ type: 'RESET' })}
            variant="secondary"
          />
        </ControlGroup>

        <ShareSaveDropdown
          demoId="mle"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleCopyAuditSummary}
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
          storageKey="theora:toolbar:mle"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Multilinear Extensions"
      />
    </DemoLayout>
  );
}
