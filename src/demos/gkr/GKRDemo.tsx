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
import { SaveToGitHub } from '@/components/shared/SaveToGitHub';
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
  buildLayeredCircuit,
  gkrProve,
  gkrVerify,
  gkrStep,
  type LayeredCircuit,
  type LayerGate,
  type GKRProof,
  type GKRVerification,
  type GKRStepInfo,
} from './logic';
import { renderGKR, type GKRRenderState } from './renderer';

// ── Constants ──────────────────────────────────────────────────────────────

const FIELD_SIZE = 101n;

const DEFAULT_INPUTS: bigint[] = [3n, 5n, 7n, 11n];
const DEFAULT_OUTPUT_POINT: bigint[] = [17n];
const DEFAULT_LAYER_CHALLENGES: bigint[][] = [[23n], [31n]];

const DEFAULT_LAYER_DEFS: LayerGate[][] = [
  [
    { type: 'add', leftInput: 0, rightInput: 1 },
    { type: 'mul', leftInput: 2, rightInput: 3 },
  ],
  [{ type: 'add', leftInput: 0, rightInput: 1 }],
];

// ── State types ────────────────────────────────────────────────────────────

interface GKRDemoState {
  circuit: LayeredCircuit;
  inputValues: bigint[];
  outputPoint: bigint[];
  layerChallenges: bigint[][];
  proof: GKRProof | null;
  verification: GKRVerification | null;
  currentStep: number; // -1 = no step, 0..n-1 = active layer proof step
  phase: 'setup' | 'proving' | 'verifying' | 'complete';
}

// ── Actions ────────────────────────────────────────────────────────────────

type GKRAction =
  | { type: 'SET_INPUT'; index: number; value: bigint }
  | { type: 'SET_OUTPUT_POINT'; index: number; value: bigint }
  | { type: 'PROVE' }
  | { type: 'VERIFY' }
  | { type: 'STEP' }
  | { type: 'RUN_ALL' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: Partial<GKRDemoState> };

// ── Helpers ────────────────────────────────────────────────────────────────

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function buildInitialState(
  inputValues?: bigint[],
  outputPoint?: bigint[],
  layerChallenges?: bigint[][],
): GKRDemoState {
  const inputs = inputValues ?? DEFAULT_INPUTS;
  const circuit = buildLayeredCircuit(inputs, DEFAULT_LAYER_DEFS, FIELD_SIZE);
  return {
    circuit,
    inputValues: inputs,
    outputPoint: outputPoint ?? DEFAULT_OUTPUT_POINT,
    layerChallenges: layerChallenges ?? DEFAULT_LAYER_CHALLENGES,
    proof: null,
    verification: null,
    currentStep: -1,
    phase: 'setup',
  };
}

// ── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: GKRDemoState, action: GKRAction): GKRDemoState {
  switch (action.type) {
    case 'SET_INPUT': {
      const newInputs = [...state.inputValues];
      newInputs[action.index] = mod(action.value, FIELD_SIZE);
      const circuit = buildLayeredCircuit(newInputs, DEFAULT_LAYER_DEFS, FIELD_SIZE);
      return {
        ...state,
        inputValues: newInputs,
        circuit,
        proof: null,
        verification: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'SET_OUTPUT_POINT': {
      const newPoint = [...state.outputPoint];
      newPoint[action.index] = mod(action.value, FIELD_SIZE);
      return {
        ...state,
        outputPoint: newPoint,
        proof: null,
        verification: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'PROVE': {
      try {
        const proof = gkrProve(state.circuit, state.outputPoint, state.layerChallenges);
        return {
          ...state,
          proof,
          verification: null,
          currentStep: -1,
          phase: 'proving',
        };
      } catch {
        return state;
      }
    }

    case 'VERIFY': {
      if (!state.proof) return state;
      const verification = gkrVerify(state.circuit, state.proof);
      return {
        ...state,
        verification,
        currentStep: state.proof.layerProofs.length - 1,
        phase: 'complete',
      };
    }

    case 'STEP': {
      if (!state.proof) {
        // First step: prove
        try {
          const proof = gkrProve(state.circuit, state.outputPoint, state.layerChallenges);
          return {
            ...state,
            proof,
            verification: null,
            currentStep: 0,
            phase: 'verifying',
          };
        } catch {
          return state;
        }
      }

      const nextStep = state.currentStep + 1;
      if (nextStep >= state.proof.layerProofs.length) {
        // Final step: do full verification
        const verification = gkrVerify(state.circuit, state.proof);
        return {
          ...state,
          verification,
          currentStep: state.proof.layerProofs.length - 1,
          phase: 'complete',
        };
      }

      return {
        ...state,
        currentStep: nextStep,
        phase: 'verifying',
      };
    }

    case 'RUN_ALL': {
      try {
        const proof = gkrProve(state.circuit, state.outputPoint, state.layerChallenges);
        const verification = gkrVerify(state.circuit, proof);
        return {
          ...state,
          proof,
          verification,
          currentStep: proof.layerProofs.length - 1,
          phase: 'complete',
        };
      } catch {
        return state;
      }
    }

    case 'RESET':
      return buildInitialState(state.inputValues, state.outputPoint, state.layerChallenges);

    case 'RESTORE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ── URL serialization helpers ──────────────────────────────────────────────

interface SerializedState {
  inputs?: string[];
  outputPoint?: string[];
  layerChallenges?: string[][];
  phase?: GKRDemoState['phase'];
  currentStep?: number;
  hasProof?: boolean;
}

function serializeState(state: GKRDemoState): SerializedState {
  return {
    inputs: state.inputValues.map(String),
    outputPoint: state.outputPoint.map(String),
    layerChallenges: state.layerChallenges.map(cs => cs.map(String)),
    phase: state.phase,
    currentStep: state.currentStep,
    hasProof: state.proof !== null,
  };
}

function deserializeState(raw: SerializedState): Partial<GKRDemoState> {
  const inputs = Array.isArray(raw.inputs) && raw.inputs.every(v => typeof v === 'string')
    ? raw.inputs.map(v => mod(BigInt(v), FIELD_SIZE))
    : DEFAULT_INPUTS;

  const outputPoint = Array.isArray(raw.outputPoint) && raw.outputPoint.every(v => typeof v === 'string')
    ? raw.outputPoint.map(v => mod(BigInt(v), FIELD_SIZE))
    : DEFAULT_OUTPUT_POINT;

  const layerChallenges = Array.isArray(raw.layerChallenges) && raw.layerChallenges.every(cs => Array.isArray(cs))
    ? raw.layerChallenges.map(cs => cs.map((v: string) => mod(BigInt(v), FIELD_SIZE)))
    : DEFAULT_LAYER_CHALLENGES;

  const base = buildInitialState(inputs, outputPoint, layerChallenges);

  // Replay to restore progress
  if (raw.hasProof) {
    try {
      const proof = gkrProve(base.circuit, base.outputPoint, base.layerChallenges);
      if (raw.phase === 'complete') {
        const verification = gkrVerify(base.circuit, proof);
        return {
          ...base,
          proof,
          verification,
          currentStep: proof.layerProofs.length - 1,
          phase: 'complete',
        };
      }
      const step = typeof raw.currentStep === 'number' ? raw.currentStep : 0;
      return {
        ...base,
        proof,
        currentStep: Math.min(step, proof.layerProofs.length - 1),
        phase: raw.phase ?? 'verifying',
      };
    } catch {
      return base;
    }
  }

  return base;
}

// ── Component ──────────────────────────────────────────────────────────────

export function GKRDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  const [state, dispatch] = useReducer(reducer, null, () =>
    buildInitialState(),
  );

  // ── Restore from URL on mount ──────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'gkr' ? hashState.state : null;
    const decoded = decodeStatePlain<SerializedState>(rawHash)
      ?? decodeState<SerializedState>(getSearchParam('gkr'));

    if (!decoded) return;
    try {
      const restored = deserializeState(decoded);
      dispatch({ type: 'RESTORE', state: restored });
    } catch {
      // ignore bad URL state
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────
  const buildShareState = useCallback((): SerializedState => serializeState(state), [state]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'gkr') return;
    setSearchParams({ gkr: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ─────────────────────────────────────────────────────
  useEffect(() => {
    let title: string;
    let body: string;

    if (state.phase === 'setup') {
      title = 'Ready to prove';
      body = `Circuit: ${state.circuit.numLayers} layers, ${state.inputValues.length} inputs over GF(${state.circuit.fieldSize}). Press Prove to generate the GKR proof.`;
    } else if (state.phase === 'proving') {
      title = 'Proof generated';
      body = `Output claim: V(r) = ${state.proof?.outputClaim}. Step through to see layer-by-layer reduction.`;
    } else if (state.phase === 'verifying') {
      const stepInfo: GKRStepInfo | null = state.proof
        ? gkrStep(state.circuit, state.proof, state.currentStep)
        : null;
      title = stepInfo ? `Layer ${stepInfo.layerIndex}` : 'Verifying';
      body = stepInfo?.description ?? 'Stepping through layer reductions.';
    } else {
      const passed = state.verification?.passed;
      title = passed ? 'Verified' : 'Verification failed';
      body = passed
        ? 'All layer reductions and the input oracle check passed.'
        : `Failed: ${state.verification?.reason ?? 'unknown error'}`;
    }

    setEntry('gkr', {
      title,
      body,
      nextSteps: [
        'Prove to see layer-by-layer reduction',
        'Step through to watch each sumcheck',
        'Change input values and re-prove',
      ],
    });
  }, [state.circuit, state.currentStep, state.inputValues.length, state.phase, state.proof, state.verification, setEntry]);

  // ── Share handlers ─────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('gkr');
    url.hash = `gkr|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'gkr');
    url.searchParams.set('gkr', encodeState(buildShareState()));
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
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-gkr.png', showDownloadToast);
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'gkr',
      timestamp: new Date().toISOString(),
      fieldSize: String(FIELD_SIZE),
      inputs: state.inputValues.map(String),
      outputPoint: state.outputPoint.map(String),
      layerChallenges: state.layerChallenges.map(cs => cs.map(String)),
      circuit: {
        numLayers: state.circuit.numLayers,
        layers: state.circuit.layers.map((l, i) => ({
          index: i,
          gates: l.gates.map(g => ({ type: g.type, left: g.leftInput, right: g.rightInput })),
          values: l.values.map(String),
        })),
      },
      proof: state.proof ? {
        outputClaim: String(state.proof.outputClaim),
        inputEval: String(state.proof.inputEval),
        layerProofs: state.proof.layerProofs.map(lp => ({
          layerIndex: lp.layerIndex,
          claim: String(lp.claim),
          reducedClaim: String(lp.reducedClaim),
          challenges: lp.challenges.map(String),
          nextPoint: lp.nextPoint.map(String),
        })),
      } : null,
      verification: state.verification,
      phase: state.phase,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Full GKR protocol trace');
  };

  // ── Canvas draw ────────────────────────────────────────────────────
  const renderState = useMemo<GKRRenderState>(() => ({
    circuit: state.circuit,
    proof: state.proof,
    verification: state.verification,
    currentStep: state.currentStep,
    phase: state.phase,
  }), [state.circuit, state.proof, state.verification, state.currentStep, state.phase]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderGKR(ctx, frame, renderState, theme);
  }, [renderState, theme]);

  // ── Sidebar helpers ────────────────────────────────────────────────
  const canStep = state.phase !== 'complete';
  const stepLabel = state.phase === 'setup'
    ? 'Prove & Step'
    : state.currentStep >= (state.proof?.layerProofs.length ?? 1) - 1
      ? 'Check Oracle'
      : `Step Layer ${state.proof?.layerProofs[state.currentStep + 1]?.layerIndex ?? '?'}`;

  // Current step info
  const stepInfo: GKRStepInfo | null = state.proof && state.currentStep >= 0
    ? gkrStep(state.circuit, state.proof, state.currentStep)
    : null;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <DemoLayout
      onEmbedPlay={() => dispatch({ type: 'STEP' })}
      embedPlaying={state.phase === 'verifying'}
      onEmbedReset={() => dispatch({ type: 'RESET' })}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Circuit inputs */}
        <ControlGroup label="Circuit Inputs">
          {state.inputValues.map((v, i) => (
            <NumberInputControl
              key={i}
              label={`x[${i}]`}
              value={Number(v)}
              min={0}
              max={Number(FIELD_SIZE) - 1}
              onChange={(n) => dispatch({ type: 'SET_INPUT', index: i, value: BigInt(n) })}
            />
          ))}
          <ControlNote>
            All arithmetic mod {String(FIELD_SIZE)}.
          </ControlNote>
        </ControlGroup>

        {/* Circuit structure */}
        <ControlGroup label="Circuit Structure" collapsible defaultCollapsed>
          <ControlCard>
            <span className="control-kicker">Field</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              GF({String(FIELD_SIZE)})
            </div>
          </ControlCard>
          {state.circuit.layers.slice(1).map((layer, li) => (
            <ControlCard key={li}>
              <span className="control-kicker">Layer {li + 1}</span>
              <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                {layer.gates.map((g, gi) => (
                  <div key={gi}>
                    gate{gi}: {g.type}(x[{g.leftInput}], x[{g.rightInput}]) = {String(layer.values[gi])}
                  </div>
                ))}
              </div>
            </ControlCard>
          ))}
          <ButtonControl
            label="Rebuild Circuit"
            onClick={() => dispatch({ type: 'RESET' })}
            variant="secondary"
          />
        </ControlGroup>

        {/* Protocol controls */}
        <ControlGroup label="Protocol">
          <ButtonControl
            label="Prove"
            onClick={() => dispatch({ type: 'PROVE' })}
            disabled={state.proof !== null && state.phase !== 'setup'}
          />
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

        {/* Current step info */}
        {stepInfo && (
          <ControlGroup label="Current Step">
            <ControlCard>
              <span className="control-kicker">Layer {stepInfo.layerIndex}</span>
              <div className="control-caption" style={{ lineHeight: 1.5 }}>
                {stepInfo.description}
              </div>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Claim</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {String(stepInfo.layerProof.claim)}
              </div>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Reduced claim</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {String(stepInfo.layerProof.reducedClaim)}
              </div>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Challenges</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                [{stepInfo.layerProof.challenges.map(String).join(', ')}]
              </div>
            </ControlCard>
          </ControlGroup>
        )}

        {/* Result */}
        {state.verification && (
          <ControlGroup label="Result">
            <ControlCard tone={state.verification.passed ? 'success' : 'error'}>
              <span className="control-kicker">Verdict</span>
              <div className="control-value">
                {state.verification.passed ? 'Verified' : 'Failed'}
              </div>
              {state.verification.reason && (
                <div className="control-caption" style={{
                  color: state.verification.passed ? 'var(--status-success)' : 'var(--status-error)',
                }}>
                  {state.verification.reason}
                </div>
              )}
              {state.verification.failedLayer !== null && (
                <div className="control-caption">
                  Failed at layer {state.verification.failedLayer}
                </div>
              )}
            </ControlCard>
          </ControlGroup>
        )}

        {/* Share */}
        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <SaveToGitHub demoId="gkr" />
          <div className="control-button-grid">
            <ButtonControl label="Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Embed" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Audit JSON" onClick={handleCopyAuditSummary} variant="secondary" />
          </div>
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
          storageKey="theora:toolbar:gkr"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="GKR Protocol"
      />
    </DemoLayout>
  );
}
