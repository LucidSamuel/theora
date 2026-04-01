import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ButtonControl,
  ControlCard,
  ControlGroup,
  ControlNote,
  NumberInputControl,
  SliderControl,
} from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { SaveToGitHub } from '@/components/shared/SaveToGitHub';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showDownloadToast, showToast } from '@/lib/toast';
import {
  decodeState,
  decodeStatePlain,
  encodeState,
  encodeStatePlain,
  getHashState,
  getSearchParam,
  setSearchParams,
} from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
import {
  buildSimpleCircuit,
  createInstance,
  foldInstances,
  replayNovaIVC,
  runNovaIVC,
  type FoldingStep,
  type NovaState,
  type R1CSMatrices,
} from './logic';
import { renderNova, type NovaRenderState } from './renderer';

// ── Constants ────────────────────────────────────────────────────────────────

const FIELD_SIZE = 101n;
const DEFAULT_X_VALUES = [3, 7, 11, 5];
const DEFAULT_CHALLENGES = [17n, 23n, 31n, 41n, 53n]; // enough for up to 6 steps

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function witnessFromX(x: number, p: bigint): bigint[] {
  const xb = mod(BigInt(x), p);
  const t = mod(xb * xb, p);
  const y = mod(t + xb + 5n, p);
  return [1n, xb, y, t];
}

// ── URL state shape ──────────────────────────────────────────────────────────

interface UrlState {
  numSteps?: number;
  xValues?: number[];
  challenges?: string[]; // bigint as string
  phase?: 'setup' | 'folding' | 'complete';
  currentStep?: number;
  completedSteps?: number;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

interface NovaDemoState {
  matrices: R1CSMatrices;
  numSteps: number;
  xValues: number[];
  challenges: bigint[];
  result: NovaState | null;
  currentStep: number; // -1 = overview, 0..n-1 = specific step
  phase: 'setup' | 'folding' | 'complete';
}

type Action =
  | { type: 'SET_NUM_STEPS'; value: number }
  | { type: 'SET_X_VALUE'; index: number; value: number }
  | { type: 'FOLD_STEP' }
  | { type: 'FOLD_ALL' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: Partial<NovaDemoState> };

function makeInitialState(): NovaDemoState {
  return {
    matrices: buildSimpleCircuit(),
    numSteps: DEFAULT_X_VALUES.length,
    xValues: [...DEFAULT_X_VALUES],
    challenges: [...DEFAULT_CHALLENGES],
    result: null,
    currentStep: -1,
    phase: 'setup',
  };
}

function clampStepIndex(value: number | undefined, maxIndex: number, fallback: number): number {
  if (maxIndex < 0) return -1;
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(-1, Math.min(value, maxIndex));
}

function foldOneStep(state: NovaDemoState): NovaDemoState {
  const { matrices, xValues, challenges, result } = state;
  const p = FIELD_SIZE;

  // Build witness list from x-values
  const witnesses = xValues.map((x) => witnessFromX(x, p));

  if (witnesses.length < 2) return state;

  if (!result) {
    // First fold: create instances from first two witnesses
    const { instance: inst1, witness: wit1 } = createInstance(matrices, witnesses[0]!, p);
    const { instance: inst2, witness: wit2 } = createInstance(matrices, witnesses[1]!, p);
    const step = foldInstances(matrices, inst1, wit1, inst2, wit2, challenges[0]!, p);
    step.stepNumber = 1;

    const novaState: NovaState = {
      matrices,
      steps: [step],
      currentStep: 1,
      fieldSize: p,
    };

    return {
      ...state,
      result: novaState,
      currentStep: 0,
      phase: novaState.steps.length >= xValues.length - 1 ? 'complete' : 'folding',
    };
  }

  // Subsequent fold: fold the running accumulator with the next witness
  const stepsCompleted = result.steps.length;
  const nextWitnessIdx = stepsCompleted + 1;

  if (nextWitnessIdx >= witnesses.length) {
    return { ...state, phase: 'complete', currentStep: -1 };
  }

  const lastStep = result.steps[result.steps.length - 1]!;
  const { instance: newInst, witness: newWit } = createInstance(matrices, witnesses[nextWitnessIdx]!, p);
  const step = foldInstances(
    matrices,
    lastStep.foldedInstance,
    lastStep.foldedWitness,
    newInst,
    newWit,
    challenges[stepsCompleted]!,
    p,
  );
  step.stepNumber = stepsCompleted + 1;

  const newSteps = [...result.steps, step];
  const novaState: NovaState = {
    ...result,
    steps: newSteps,
    currentStep: newSteps.length,
  };

  return {
    ...state,
    result: novaState,
    currentStep: newSteps.length - 1,
    phase: newSteps.length >= xValues.length - 1 ? 'complete' : 'folding',
  };
}

function reducer(state: NovaDemoState, action: Action): NovaDemoState {
  switch (action.type) {
    case 'SET_NUM_STEPS': {
      const n = Math.max(2, Math.min(6, action.value));
      const xValues = [...state.xValues];
      while (xValues.length < n) xValues.push((xValues.length * 4 + 3) % 100);
      while (xValues.length > n) xValues.pop();
      return {
        ...state,
        numSteps: n,
        xValues,
        result: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'SET_X_VALUE': {
      const xValues = [...state.xValues];
      xValues[action.index] = Math.max(1, Math.min(99, action.value));
      return {
        ...state,
        xValues,
        result: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'FOLD_STEP':
      return foldOneStep(state);

    case 'FOLD_ALL': {
      const witnesses = state.xValues.map((x) => witnessFromX(x, FIELD_SIZE));
      const challengeSlice = state.challenges.slice(0, witnesses.length - 1);
      const novaState = runNovaIVC(state.matrices, witnesses, challengeSlice, FIELD_SIZE);
      return {
        ...state,
        result: novaState,
        currentStep: -1,
        phase: 'complete',
      };
    }

    case 'RESET':
      return makeInitialState();

    case 'RESTORE': {
      return { ...state, ...action.state };
    }

    default:
      return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function NovaDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();

  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // ── URL state restore ───────────────────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'nova' ? hashState.state : null;
    const decodedHash = decodeStatePlain<UrlState>(rawHash);
    const raw = decodedHash ? null : getSearchParam('nova');
    const decoded = decodeState<UrlState>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;

    const xValues = payload.xValues ?? [...DEFAULT_X_VALUES];
    const numSteps = payload.numSteps ?? xValues.length;
    const challenges = payload.challenges
      ? payload.challenges.map((c) => BigInt(c))
      : [...DEFAULT_CHALLENGES];

    const partial: Partial<NovaDemoState> = {
      numSteps,
      xValues,
      challenges,
    };

    if (payload.phase === 'folding' || payload.phase === 'complete') {
      const matrices = buildSimpleCircuit();
      const witnesses = xValues.map((x) => witnessFromX(x, FIELD_SIZE));
      const challengeSlice = challenges.slice(0, witnesses.length - 1);
      const totalSteps = Math.max(0, witnesses.length - 1);
      const fallbackCompletedSteps = payload.phase === 'complete'
        ? totalSteps
        : Math.max((payload.currentStep ?? -1) + 1, 0);
      const completedSteps = Math.max(
        0,
        Math.min(payload.completedSteps ?? fallbackCompletedSteps, totalSteps),
      );

      try {
        if (completedSteps > 0) {
          const novaState = replayNovaIVC(
            matrices,
            witnesses,
            challengeSlice,
            completedSteps,
            FIELD_SIZE,
          );
          const restoredPhase = completedSteps >= totalSteps ? 'complete' : 'folding';
          partial.result = novaState;
          partial.phase = restoredPhase;
          partial.currentStep = clampStepIndex(
            payload.currentStep,
            novaState.steps.length - 1,
            restoredPhase === 'complete' ? -1 : novaState.steps.length - 1,
          );
        } else {
          partial.result = null;
          partial.phase = 'setup';
          partial.currentStep = -1;
        }
      } catch {
        partial.result = null;
        partial.phase = 'setup';
        partial.currentStep = -1;
      }
    } else {
      partial.result = null;
      partial.phase = payload.phase ?? 'setup';
      partial.currentStep = payload.currentStep ?? -1;
    }

    dispatch({ type: 'RESTORE', state: partial });
  }, []);

  // ── URL sync ────────────────────────────────────────────────────────────
  const buildShareState = useCallback((): UrlState => ({
    numSteps: state.numSteps,
    xValues: state.xValues,
    challenges: state.challenges.map(String),
    phase: state.phase,
    currentStep: state.currentStep,
    completedSteps: state.result?.steps.length ?? 0,
  }), [state.numSteps, state.xValues, state.challenges, state.phase, state.currentStep, state.result]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'nova') return;
    setSearchParams({ nova: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ──────────────────────────────────────────────────────────
  useEffect(() => {
    const stepCount = state.result?.steps.length ?? 0;
    const allSatisfied = state.result?.steps.every((s) => s.satisfied) ?? false;

    setEntry('nova', {
      title: state.phase === 'setup'
        ? 'Nova Folding'
        : state.phase === 'folding'
          ? `Folding \u2014 Step ${stepCount}`
          : 'IVC Complete',
      body: state.phase === 'setup'
        ? `${state.numSteps} witnesses ready. Each fold compresses two relaxed R1CS instances into one.`
        : state.phase === 'folding'
          ? `${stepCount} of ${state.numSteps - 1} folds completed. The accumulator carries all prior computation.`
          : allSatisfied
            ? `All ${stepCount} folds satisfied. The final accumulator proves correctness of all ${state.numSteps} computations.`
            : `Folding chain broken \u2014 relaxed R1CS check failed.`,
      nextSteps: [
        'Fold one step to see the cross-term',
        'Run all steps to see the full IVC chain',
        'Check that each folded instance is satisfied',
      ],
    });
  }, [state.phase, state.result, state.numSteps, setEntry]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleFoldStep = useCallback(() => dispatch({ type: 'FOLD_STEP' }), []);
  const handleFoldAll = useCallback(() => dispatch({ type: 'FOLD_ALL' }), []);
  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    showToast('Reset to defaults');
  }, []);

  const canFoldMore = state.phase !== 'complete';

  // ── Share actions ───────────────────────────────────────────────────────
  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  }, []);

  const handleCopyHashUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('nova');
    url.hash = `nova|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment');
  }, [buildShareState]);

  const handleCopyEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'nova');
    url.searchParams.set('nova', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [buildShareState]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;
    fitCameraToBounds(camera, canvas, { minX: 0, minY: 0, maxX: w, maxY: h }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-nova.png', showDownloadToast);
  }, [camera, handleFitToView]);

  const handleCopyAuditSummary = useCallback(() => {
    const payload = {
      demo: 'nova',
      timestamp: new Date().toISOString(),
      fieldSize: Number(FIELD_SIZE),
      numSteps: state.numSteps,
      xValues: state.xValues,
      phase: state.phase,
      steps: state.result?.steps.map((s) => ({
        stepNumber: s.stepNumber,
        challenge: Number(s.challenge),
        crossTerm: s.crossTerm.map(Number),
        foldedU: Number(s.foldedInstance.u),
        foldedCommitment: Number(s.foldedInstance.commitment),
        foldedX: s.foldedInstance.x.map(Number),
        foldedE: s.foldedWitness.E.map(Number),
        satisfied: s.satisfied,
      })) ?? [],
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Full folding chain with cross-terms and satisfaction');
  }, [state]);

  // ── Draw ────────────────────────────────────────────────────────────────
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      const renderState: NovaRenderState = {
        steps: state.result?.steps ?? [],
        currentStep: state.currentStep,
        fieldSize: FIELD_SIZE,
        phase: state.phase,
        matrices: state.matrices,
      };
      renderNova(ctx, frame, renderState, theme);
    },
    [state, theme],
  );

  // ── Current step details ────────────────────────────────────────────────
  const activeStep: FoldingStep | null =
    state.result && state.currentStep >= 0 && state.currentStep < state.result.steps.length
      ? state.result.steps[state.currentStep]!
      : null;

  return (
    <DemoLayout
      onEmbedReset={handleReset}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Witnesses */}
        <ControlGroup label="Witnesses">
          <SliderControl
            label="IVC steps"
            value={state.numSteps}
            min={2}
            max={6}
            step={1}
            onChange={(v) => dispatch({ type: 'SET_NUM_STEPS', value: v })}
          />
          {state.xValues.map((x, i) => (
            <NumberInputControl
              key={i}
              label={`x\u2080 + ${i} (witness ${i + 1})`}
              value={x}
              min={1}
              max={99}
              onChange={(v) => dispatch({ type: 'SET_X_VALUE', index: i, value: v })}
            />
          ))}
        </ControlGroup>

        {/* Protocol */}
        <ControlGroup label="Protocol">
          <ButtonControl
            label={canFoldMore ? 'Fold Step' : 'Complete'}
            onClick={handleFoldStep}
            disabled={!canFoldMore}
          />
          <ButtonControl
            label="Fold All"
            onClick={handleFoldAll}
            variant="secondary"
            disabled={!canFoldMore}
          />
          <ButtonControl
            label="Reset"
            onClick={handleReset}
            variant="secondary"
          />

          {state.result && (
            <ControlCard>
              <span className="control-kicker">Folds completed</span>
              <span className="control-value">
                {state.result.steps.length} / {state.numSteps - 1}
              </span>
              <span className="control-caption">
                {state.phase === 'complete' ? 'IVC chain complete' : 'In progress'}
              </span>
            </ControlCard>
          )}
        </ControlGroup>

        {/* Current Step Detail */}
        {activeStep && (
          <ControlGroup label={`Step ${activeStep.stepNumber} Detail`}>
            <ControlCard>
              <span className="control-kicker">Instance 1 (accumulator)</span>
              <span className="control-value">u = {activeStep.instance1.u.toString()}</span>
              <span className="control-caption">
                commit = {activeStep.instance1.commitment.toString()}, x = [{activeStep.instance1.x.map(String).join(', ')}]
              </span>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Instance 2 (new)</span>
              <span className="control-value">u = {activeStep.instance2.u.toString()}</span>
              <span className="control-caption">
                commit = {activeStep.instance2.commitment.toString()}, x = [{activeStep.instance2.x.map(String).join(', ')}]
              </span>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Cross-term T</span>
              <span className="control-value">[{activeStep.crossTerm.map(String).join(', ')}]</span>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Challenge r</span>
              <span className="control-value">{activeStep.challenge.toString()}</span>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">Folded result</span>
              <span className="control-value">u' = {activeStep.foldedInstance.u.toString()}</span>
              <span className="control-caption">
                commit' = {activeStep.foldedInstance.commitment.toString()}, x' = [{activeStep.foldedInstance.x.map(String).join(', ')}]
              </span>
            </ControlCard>
            <ControlNote tone={activeStep.satisfied ? 'success' : 'error'}>
              {activeStep.satisfied
                ? 'Folded instance satisfies relaxed R1CS'
                : 'Folded instance violates relaxed R1CS!'}
            </ControlNote>
          </ControlGroup>
        )}

        {/* Final result */}
        {state.phase === 'complete' && state.result && (
          <ControlGroup label="Result">
            <ControlNote tone={state.result.steps.every((s) => s.satisfied) ? 'success' : 'error'}>
              {state.result.steps.every((s) => s.satisfied)
                ? `IVC verified \u2014 all ${state.result.steps.length} folds satisfied.`
                : 'IVC chain broken \u2014 at least one fold failed.'}
            </ControlNote>
          </ControlGroup>
        )}

        {/* Share */}
        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <SaveToGitHub demoId="nova" />
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
          onCanvas={(c) => { canvasElRef.current = c; }}
          {...mergedHandlers}
        />
        <CanvasToolbar
          camera={camera}
          storageKey="theora:toolbar:nova"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Nova Folding"
      />
    </DemoLayout>
  );
}
