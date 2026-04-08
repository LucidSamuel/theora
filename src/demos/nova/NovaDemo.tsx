import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ButtonControl,
  ControlCard,
  ControlGroup,
  ControlNote,
  NumberInputControl,
  SelectControl,
  SliderControl,
  ToggleControl,
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
import { getNovaSceneBounds, renderNova, type NovaRenderState } from './renderer';

// ── Constants ────────────────────────────────────────────────────────────────

const FIELD_SIZE = 101n;
const MIN_WITNESSES = 2;
const MAX_WITNESSES = 10;
const DEFAULT_BASE_X = 3;
const DEFAULT_STEP_DELTA = 4;
const DEFAULT_CHALLENGE_POOL = [17n, 23n, 31n, 41n, 53n, 61n, 71n, 83n, 89n];

function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function witnessFromX(x: number, p: bigint): bigint[] {
  const xb = mod(BigInt(x), p);
  const t = mod(xb * xb, p);
  const y = mod(t + xb + 5n, p);
  return [1n, xb, y, t];
}

function clampFieldInput(value: number): number {
  return Math.max(0, Math.min(Number(FIELD_SIZE - 1n), Math.round(value)));
}

function buildArithmeticWitnesses(baseX: number, stepDelta: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    Number(mod(BigInt(baseX) + BigInt(index) * BigInt(stepDelta), FIELD_SIZE)));
}

function buildChallengeList(count: number): bigint[] {
  if (count <= DEFAULT_CHALLENGE_POOL.length) {
    return DEFAULT_CHALLENGE_POOL.slice(0, count);
  }
  const next = [...DEFAULT_CHALLENGE_POOL];
  while (next.length < count) {
    const last = next[next.length - 1] ?? 17n;
    next.push(mod(last + 12n, FIELD_SIZE));
  }
  return next;
}

function normalizeBadWitnessIndex(value: unknown, numSteps: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const index = Math.trunc(value);
  if (index < 0 || index >= numSteps) return null;
  return index;
}

function resizeCustomWitnesses(current: number[], count: number, baseX: number, stepDelta: number): number[] {
  const next = current.slice(0, count).map(clampFieldInput);
  const derived = buildArithmeticWitnesses(baseX, stepDelta, count);
  while (next.length < count) next.push(derived[next.length]!);
  return next;
}

function inferWitnessPattern(xValues: number[]): { baseX: number; stepDelta: number; customWitnesses: boolean } {
  const baseX = clampFieldInput(xValues[0] ?? DEFAULT_BASE_X);
  const second = clampFieldInput(xValues[1] ?? baseX + DEFAULT_STEP_DELTA);
  const stepDelta = Number(mod(BigInt(second - baseX), FIELD_SIZE));
  const derived = buildArithmeticWitnesses(baseX, stepDelta, xValues.length);
  const customWitnesses = xValues.some((value, index) => clampFieldInput(value) !== derived[index]);
  return { baseX, stepDelta, customWitnesses };
}

function buildWitnessVectors(xValues: number[], badWitnessIndex: number | null): bigint[][] {
  return xValues.map((x, index) => {
    const witness = witnessFromX(x, FIELD_SIZE);
    if (badWitnessIndex === index) {
      witness[2] = mod(witness[2]! + 1n, FIELD_SIZE);
    }
    return witness;
  });
}

const DEFAULT_X_VALUES = buildArithmeticWitnesses(DEFAULT_BASE_X, DEFAULT_STEP_DELTA, 4);

// ── URL state shape ──────────────────────────────────────────────────────────

interface UrlState {
  numSteps?: number;
  baseX?: number;
  stepDelta?: number;
  customWitnesses?: boolean;
  xValues?: number[];
  badWitnessIndex?: number | null;
  challenges?: string[]; // bigint as string
  phase?: 'setup' | 'folding' | 'complete';
  currentStep?: number;
  completedSteps?: number;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

interface NovaDemoState {
  matrices: R1CSMatrices;
  numSteps: number;
  baseX: number;
  stepDelta: number;
  customWitnesses: boolean;
  xValues: number[];
  badWitnessIndex: number | null;
  challenges: bigint[];
  result: NovaState | null;
  currentStep: number; // -1 = overview, 0..n-1 = specific step
  phase: 'setup' | 'folding' | 'complete';
}

type Action =
  | { type: 'SET_NUM_STEPS'; value: number }
  | { type: 'SET_BASE_X'; value: number }
  | { type: 'SET_STEP_DELTA'; value: number }
  | { type: 'SET_CUSTOM_WITNESSES'; value: boolean }
  | { type: 'SET_X_VALUE'; index: number; value: number }
  | { type: 'SET_BAD_WITNESS'; value: number | null }
  | { type: 'SET_CURRENT_STEP'; value: number }
  | { type: 'FOLD_STEP' }
  | { type: 'FOLD_ALL' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: Partial<NovaDemoState> };

function makeInitialState(): NovaDemoState {
  return {
    matrices: buildSimpleCircuit(),
    numSteps: DEFAULT_X_VALUES.length,
    baseX: DEFAULT_BASE_X,
    stepDelta: DEFAULT_STEP_DELTA,
    customWitnesses: false,
    xValues: [...DEFAULT_X_VALUES],
    badWitnessIndex: null,
    challenges: buildChallengeList(MAX_WITNESSES - 1),
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
  const { matrices, xValues, badWitnessIndex, challenges, result } = state;
  const p = FIELD_SIZE;

  const witnesses = buildWitnessVectors(xValues, badWitnessIndex);

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
      const n = Math.max(MIN_WITNESSES, Math.min(MAX_WITNESSES, action.value));
      const xValues = state.customWitnesses
        ? resizeCustomWitnesses(state.xValues, n, state.baseX, state.stepDelta)
        : buildArithmeticWitnesses(state.baseX, state.stepDelta, n);
      return {
        ...state,
        numSteps: n,
        xValues,
        badWitnessIndex: normalizeBadWitnessIndex(state.badWitnessIndex, n),
        result: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'SET_BASE_X': {
      const baseX = clampFieldInput(action.value);
      return {
        ...state,
        baseX,
        customWitnesses: false,
        xValues: buildArithmeticWitnesses(baseX, state.stepDelta, state.numSteps),
        result: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'SET_STEP_DELTA': {
      const stepDelta = clampFieldInput(action.value);
      return {
        ...state,
        stepDelta,
        customWitnesses: false,
        xValues: buildArithmeticWitnesses(state.baseX, stepDelta, state.numSteps),
        result: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'SET_CUSTOM_WITNESSES':
      return {
        ...state,
        customWitnesses: action.value,
        xValues: action.value
          ? [...state.xValues]
          : buildArithmeticWitnesses(state.baseX, state.stepDelta, state.numSteps),
        result: null,
        currentStep: -1,
        phase: 'setup',
      };

    case 'SET_X_VALUE': {
      const xValues = [...state.xValues];
      xValues[action.index] = clampFieldInput(action.value);
      return {
        ...state,
        xValues,
        customWitnesses: true,
        result: null,
        currentStep: -1,
        phase: 'setup',
      };
    }

    case 'SET_BAD_WITNESS':
      return {
        ...state,
        badWitnessIndex: action.value,
        result: null,
        currentStep: -1,
        phase: 'setup',
      };

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: clampStepIndex(action.value, (state.result?.steps.length ?? 0) - 1, -1),
      };

    case 'FOLD_STEP':
      return foldOneStep(state);

    case 'FOLD_ALL': {
      const witnesses = buildWitnessVectors(state.xValues, state.badWitnessIndex);
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
  const { currentDemoAction } = useAttack();

  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const previousPhaseRef = useRef<NovaDemoState['phase']>('setup');

  // ── URL state restore ───────────────────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'nova' ? hashState.state : null;
    const decodedHash = decodeStatePlain<UrlState>(rawHash);
    const raw = decodedHash ? null : getSearchParam('nova');
    const decoded = decodeState<UrlState>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;

    const rawXValues = (payload.xValues ?? [...DEFAULT_X_VALUES]).map(clampFieldInput);
    const inferred = inferWitnessPattern(rawXValues);
    const numSteps = Math.max(
      MIN_WITNESSES,
      Math.min(MAX_WITNESSES, payload.numSteps ?? rawXValues.length),
    );
    const baseX = clampFieldInput(payload.baseX ?? inferred.baseX);
    const stepDelta = clampFieldInput(payload.stepDelta ?? inferred.stepDelta);
    const customWitnesses = payload.customWitnesses ?? inferred.customWitnesses;
    const xValues = customWitnesses
      ? resizeCustomWitnesses(rawXValues, numSteps, baseX, stepDelta)
      : buildArithmeticWitnesses(baseX, stepDelta, numSteps);
    const badWitnessIndex = normalizeBadWitnessIndex(payload.badWitnessIndex, numSteps);
    const challenges = payload.challenges
      ? buildChallengeList(Math.max(MAX_WITNESSES - 1, payload.challenges.length)).map(
          (_, index) => BigInt(payload.challenges?.[index] ?? buildChallengeList(MAX_WITNESSES - 1)[index]!),
        )
      : buildChallengeList(MAX_WITNESSES - 1);

    const partial: Partial<NovaDemoState> = {
      numSteps,
      baseX,
      stepDelta,
      customWitnesses,
      xValues,
      badWitnessIndex,
      challenges,
    };

    if (payload.phase === 'folding' || payload.phase === 'complete') {
      const matrices = buildSimpleCircuit();
      const witnesses = buildWitnessVectors(xValues, badWitnessIndex);
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
    baseX: state.baseX,
    stepDelta: state.stepDelta,
    customWitnesses: state.customWitnesses,
    xValues: state.xValues,
    badWitnessIndex: state.badWitnessIndex,
    challenges: state.challenges.map(String),
    phase: state.phase,
    currentStep: state.currentStep,
    completedSteps: state.result?.steps.length ?? 0,
  }), [
    state.numSteps,
    state.baseX,
    state.stepDelta,
    state.customWitnesses,
    state.xValues,
    state.badWitnessIndex,
    state.challenges,
    state.phase,
    state.currentStep,
    state.result,
  ]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'nova') return;
    setSearchParams({ nova: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ──────────────────────────────────────────────────────────
  useEffect(() => {
    const stepCount = state.result?.steps.length ?? 0;
    const allSatisfied = state.result?.steps.every((s) => s.satisfied) ?? false;
    const witnessFault = state.badWitnessIndex === null
      ? 'All witnesses are honest.'
      : `Witness ${state.badWitnessIndex + 1} has y incremented by 1, so the folded chain should fail when that step enters the accumulator.`;

    setEntry('nova', {
      title: state.phase === 'setup'
        ? 'Nova Folding'
        : state.phase === 'folding'
          ? `Folding \u2014 Step ${stepCount}`
          : 'IVC Complete',
      body: state.phase === 'setup'
        ? `${state.numSteps} witness instances ready for f(x) = x² + x + 5 over GF(101). ${witnessFault}`
        : state.phase === 'folding'
          ? `${stepCount} of ${state.numSteps - 1} folds completed. The accumulator carries all prior computation. ${witnessFault}`
          : allSatisfied
            ? `All ${stepCount} folds satisfied. The final accumulator proves correctness of all ${state.numSteps} computations.`
            : `Folding chain broken \u2014 relaxed R1CS check failed.`,
      nextSteps: [
        'Fold one step to see the cross-term',
        'Run all steps to see the full IVC chain',
        'Toggle an invalid witness to see Nova reject a bad step',
      ],
    });
  }, [state.badWitnessIndex, state.numSteps, state.phase, state.result, setEntry]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleFoldStep = useCallback(() => dispatch({ type: 'FOLD_STEP' }), []);
  const handleFoldAll = useCallback(() => dispatch({ type: 'FOLD_ALL' }), []);
  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    showToast('Reset to defaults');
  }, []);
  const handleCompleteAction = useCallback(() => {
    if (!state.result) return;
    dispatch({
      type: 'SET_CURRENT_STEP',
      value: state.currentStep >= 0 ? -1 : state.result.steps.length - 1,
    });
  }, [state.currentStep, state.result]);

  const loadAttackState = useCallback((payload: unknown) => {
    const raw = payload && typeof payload === 'object'
      ? payload as { numSteps?: number; baseX?: number; stepDelta?: number; badWitnessIndex?: number | null; runAll?: boolean }
      : {};
    const numSteps = Math.max(MIN_WITNESSES, Math.min(MAX_WITNESSES, raw.numSteps ?? 4));
    const baseX = clampFieldInput(raw.baseX ?? DEFAULT_BASE_X);
    const stepDelta = clampFieldInput(raw.stepDelta ?? DEFAULT_STEP_DELTA);
    const badWitnessIndex = normalizeBadWitnessIndex(raw.badWitnessIndex ?? null, numSteps);
    const xValues = buildArithmeticWitnesses(baseX, stepDelta, numSteps);
    const challenges = buildChallengeList(MAX_WITNESSES - 1);
    if (raw.runAll) {
      const witnesses = buildWitnessVectors(xValues, badWitnessIndex);
      const matrices = buildSimpleCircuit();
      const novaState = runNovaIVC(matrices, witnesses, challenges.slice(0, witnesses.length - 1), FIELD_SIZE);
      dispatch({
        type: 'RESTORE',
        state: {
          matrices,
          numSteps,
          baseX,
          stepDelta,
          customWitnesses: false,
          xValues,
          badWitnessIndex,
          challenges,
          result: novaState,
          currentStep: -1,
          phase: 'complete',
        },
      });
      return;
    }

    dispatch({
      type: 'RESTORE',
      state: {
        matrices: buildSimpleCircuit(),
        numSteps,
        baseX,
        stepDelta,
        customWitnesses: false,
        xValues,
        badWitnessIndex,
        challenges,
        result: null,
        currentStep: -1,
        phase: 'setup',
      },
    });
  }, []);

  useAttackActions(currentDemoAction, useMemo(() => ({
    LOAD_ATTACK_CHAIN: (payload) => loadAttackState(payload),
  }), [loadAttackState]));

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
    const bounds = getNovaSceneBounds(w, h, {
      steps: state.result?.steps ?? [],
      currentStep: state.currentStep,
      fieldSize: FIELD_SIZE,
      phase: state.phase,
      matrices: state.matrices,
    });
    fitCameraToBounds(
      camera,
      canvas,
      bounds,
      options?.instant ? { durationMs: 0, paddingRatio: 0.12 } : { paddingRatio: 0.12 },
    );
  }, [camera, state.currentStep, state.matrices, state.phase, state.result]);

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
      baseX: state.baseX,
      stepDelta: state.stepDelta,
      customWitnesses: state.customWitnesses,
      xValues: state.xValues,
      badWitnessIndex: state.badWitnessIndex,
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
      const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
      const renderState: NovaRenderState = {
        steps: state.result?.steps ?? [],
        currentStep: state.currentStep,
        fieldSize: FIELD_SIZE,
        phase: state.phase,
        matrices: state.matrices,
      };
      renderNova(ctx, frame, renderState, theme, worldMouse.x, worldMouse.y);
    },
    [camera, interaction.mouseX, interaction.mouseY, state, theme],
  );

  // ── Current step details ────────────────────────────────────────────────
  const activeStep: FoldingStep | null =
    state.result
      ? state.currentStep >= 0 && state.currentStep < state.result.steps.length
        ? state.result.steps[state.currentStep]!
        : state.phase === 'complete'
          ? state.result.steps[state.result.steps.length - 1] ?? null
          : null
      : null;

  useEffect(() => {
    if (previousPhaseRef.current !== 'complete' && state.phase === 'complete' && state.result?.steps.length) {
      requestAnimationFrame(() => handleFitToView({ instant: true }));
    }
    previousPhaseRef.current = state.phase;
  }, [handleFitToView, state.phase, state.result]);

  const badWitnessOptions = useMemo(
    () => [
      { value: 'none', label: 'None' },
      ...Array.from({ length: state.numSteps }, (_, index) => ({
        value: String(index),
        label: `Witness ${index + 1} (set y := y + 1)`,
      })),
    ],
    [state.numSteps],
  );

  const witnessSummaries = useMemo(() => (
    state.xValues.map((x, index) => {
      const honest = witnessFromX(x, FIELD_SIZE);
      const corrupted = state.badWitnessIndex === index;
      const displayedY = corrupted ? mod(honest[2]! + 1n, FIELD_SIZE) : honest[2]!;
      return {
        index,
        x,
        t: honest[3]!,
        honestY: honest[2]!,
        displayedY,
        corrupted,
      };
    })
  ), [state.badWitnessIndex, state.xValues]);

  return (
    <DemoLayout
      onEmbedReset={handleReset}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar resetScrollKey={`${state.phase}-${state.currentStep}`}>
        {/* Witnesses */}
        <ControlGroup label="Witnesses">
          <ControlCard>
            <div className="control-kicker">Circuit</div>
            <div className="control-value">f(x) = x² + x + 5</div>
            <div className="control-caption">
              Relaxed R1CS over GF(101). Real Nova uses large prime fields and Pedersen-style commitments; this toy field keeps the fold arithmetic readable.
            </div>
          </ControlCard>
          <SliderControl
            label="Computation steps"
            value={state.numSteps}
            min={MIN_WITNESSES}
            max={MAX_WITNESSES}
            step={1}
            onChange={(v) => dispatch({ type: 'SET_NUM_STEPS', value: v })}
            hint="2–10 witness instances. The cap is pedagogical: Nova's accumulator stays constant-size, but the canvas stays legible."
          />
          <NumberInputControl
            label="x₀ (first witness input)"
            value={state.baseX}
            min={0}
            max={100}
            onChange={(v) => dispatch({ type: 'SET_BASE_X', value: v })}
          />
          <NumberInputControl
            label="Δx (step between witnesses)"
            value={state.stepDelta}
            min={0}
            max={100}
            onChange={(v) => dispatch({ type: 'SET_STEP_DELTA', value: v })}
          />
          <ToggleControl
            label="Custom witness list"
            checked={state.customWitnesses}
            onChange={(value) => dispatch({ type: 'SET_CUSTOM_WITNESSES', value })}
          />
          <ControlNote>
            {state.customWitnesses
              ? 'Manual mode: edit each witness input directly. Turn this off to regenerate xᵢ = x₀ + i·Δx mod 101.'
              : 'Auto-derived witnesses: xᵢ = x₀ + i·Δx mod 101. This makes the arithmetic progression explicit before folding starts.'}
          </ControlNote>
          <SelectControl
            label="Invalid witness mode"
            value={state.badWitnessIndex === null ? 'none' : String(state.badWitnessIndex)}
            options={badWitnessOptions}
            onChange={(value) => dispatch({
              type: 'SET_BAD_WITNESS',
              value: value === 'none' ? null : Number(value),
            })}
          />
          <ControlNote tone={state.badWitnessIndex === null ? 'default' : 'error'}>
            {state.badWitnessIndex === null
              ? 'All witnesses are honest. Toggle one witness to corrupt y by +1 and watch Nova reject that fold.'
              : `Witness ${state.badWitnessIndex + 1} is intentionally invalid: it claims y + 1 instead of x² + x + 5.`}
          </ControlNote>
          {state.customWitnesses ? (
            state.xValues.map((x, index) => (
              <NumberInputControl
                key={index}
                label={`Witness ${index + 1} input x`}
                value={x}
                min={0}
                max={100}
                onChange={(v) => dispatch({ type: 'SET_X_VALUE', index, value: v })}
              />
            ))
          ) : (
            witnessSummaries.map((summary) => (
              <ControlCard key={summary.index} tone={summary.corrupted ? 'error' : 'default'}>
                <div className="control-kicker">Witness {summary.index + 1}</div>
                <div className="control-value">x = {summary.x}</div>
                <div className="control-caption">
                  {summary.corrupted
                    ? `t = ${summary.t}, y = ${summary.displayedY} (honest y = ${summary.honestY})`
                    : `t = ${summary.t}, y = ${summary.displayedY}`}
                </div>
              </ControlCard>
            ))
          )}
        </ControlGroup>

        {/* Protocol */}
        <ControlGroup label="Protocol">
          <ButtonControl
            label={
              canFoldMore
                ? 'Fold Step'
                : state.currentStep >= 0
                  ? 'Show full chain'
                  : 'Review final fold'
            }
            onClick={canFoldMore ? handleFoldStep : handleCompleteAction}
            disabled={!canFoldMore && !state.result}
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
              <div className="control-kicker">Folds completed</div>
              <div className="control-value">
                {state.result.steps.length} / {state.numSteps - 1}
              </div>
              <div className="control-caption">
                {state.phase === 'complete' ? 'IVC chain complete' : 'In progress'}
              </div>
            </ControlCard>
          )}

          <ControlNote>
            {canFoldMore
              ? 'Fold one step at a time to inspect T, or fold all to see the final accumulator summary.'
              : 'The run is complete. Review the final fold, inspect the chain tooltip cards, or change witnesses and reset to rerun.'}
          </ControlNote>
        </ControlGroup>

        {/* Current Step Detail */}
        {activeStep && (
          <ControlGroup label={state.phase === 'complete' && state.currentStep < 0 ? 'Final Fold Detail' : `Step ${activeStep.stepNumber} Detail`}>
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
            <ControlCard>
              <div className="control-kicker">Proof-size intuition</div>
              <div className="control-value">One accumulator, {state.result.steps.length} folds</div>
              <div className="control-caption">
                Nova keeps carrying one folded accumulator even as more steps are added. This demo caps the step slider for readability, not because the protocol stops scaling.
              </div>
            </ControlCard>
          </ControlGroup>
        )}

        <ShareSaveDropdown
          demoId="nova"
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
