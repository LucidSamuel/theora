import { useReducer, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { PolynomialState, EvalPoint, NTTState, IPADemoState, BatchOpeningDemoState } from '@/types/polynomial';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { useAttack } from '@/modes/attack/AttackProvider';
import { useAttackActions } from '@/modes/attack/useAttackActions';
import {
  ControlGroup,
  SliderControl,
  ToggleControl,
  ButtonControl,
  TextInput,
  NumberInputControl,
  SelectControl,
  ControlCard,
  ControlNote,
} from '@/components/shared/Controls';
import { HashBadge } from '@/components/shared/HashBadge';
import { SaveToGitHub } from '@/components/shared/SaveToGitHub';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import {
  evaluatePolynomial,
  fitLagrangePolynomial,
  autoScale,
  simulateKzgCommit,
  simulateKzgChallenge,
  simulateKzgProof,
  simulateKzgVerify,
} from './logic';
import { renderPolynomial, canvasToMath } from './renderer';
import { renderNTT } from './nttRenderer';
import { renderIPA } from './ipaRenderer';
import { renderBatch } from './batchRenderer';
import { batchOpen } from './batchOpening';
import type { BatchOpeningResult } from './batchOpening';
import { NTT_PRESETS, nttForward, nttInverse } from './ntt';
import type { ButterflyLayer } from './ntt';
import { buildIpaChallenges, generateGenerators, ipaCommit, evaluatePolyForIPA, ipaProve, ipaVerify } from './ipa';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';

// Action types
type PolynomialAction =
  | { type: 'SET_COEFFICIENTS'; coefficients: number[] }
  | { type: 'SET_COEFF'; index: number; value: number }
  | { type: 'SET_MODE'; mode: 'coefficients' | 'lagrange' | 'ntt' | 'ipa' | 'batch' }
  | { type: 'ADD_LAGRANGE_POINT'; x: number; y: number }
  | { type: 'CLEAR_LAGRANGE' }
  | { type: 'ADD_EVAL_POINT'; point: EvalPoint }
  | { type: 'CLEAR_EVAL_POINTS' }
  | { type: 'KZG_COMMIT'; commitment: string }
  | { type: 'KZG_CHALLENGE'; challengeZ: number }
  | { type: 'KZG_REVEAL'; revealedValue: number; quotientPoly: number[]; proofHash: string }
  | { type: 'KZG_VERIFY'; verified: boolean }
  | { type: 'KZG_RESET' }
  | { type: 'SET_VIEW_RANGE'; viewRange: { xMin: number; xMax: number; yMin: number; yMax: number } }
  | { type: 'ADD_TERM' }
  | { type: 'REMOVE_TERM' }
  | { type: 'TOGGLE_COMPARE' }
  | { type: 'SET_COMPARE_COEFFS'; coefficients: number[] }
  | { type: 'SET_KZG_STATE'; kzg: PolynomialState['kzg'] }
  | { type: 'SET_EVAL_POINTS'; points: EvalPoint[] }
  | { type: 'SET_NTT_COEFFICIENTS'; coefficients: bigint[] }
  | { type: 'SET_NTT_COEFF'; index: number; value: bigint }
  | { type: 'SET_NTT_SIZE'; n: number }
  | { type: 'SET_NTT_DIRECTION'; direction: 'forward' | 'inverse' }
  | { type: 'SET_NTT_ACTIVE_LAYER'; layer: number }
  | { type: 'NTT_STEP' }
  | { type: 'NTT_RESET' }
  | { type: 'SET_NTT_STATE'; ntt: NTTState }
  | { type: 'IPA_SET_COEFFICIENTS'; coefficients: bigint[] }
  | { type: 'IPA_SET_COEFF'; index: number; value: bigint }
  | { type: 'IPA_SET_EVAL_POINT'; point: bigint }
  | { type: 'IPA_PROVE'; challenges: bigint[] }
  | { type: 'IPA_VERIFY' }
  | { type: 'IPA_RESET' }
  | { type: 'IPA_SET_ACTIVE_ROUND'; round: number }
  | { type: 'SET_IPA_STATE'; ipa: IPADemoState }
  | { type: 'BATCH_SET_EVAL_POINT'; evalPoint: bigint }
  | { type: 'BATCH_SET_GAMMA'; gamma: bigint }
  | { type: 'BATCH_ADD_POLY' }
  | { type: 'BATCH_REMOVE_POLY'; index: number }
  | { type: 'BATCH_SET_COEFF'; polyIndex: number; coeffIndex: number; value: bigint }
  | { type: 'BATCH_COMPUTE'; result: BatchOpeningResult }
  | { type: 'BATCH_RESET' }
  | { type: 'SET_BATCH_STATE'; batch: BatchOpeningDemoState }
  | { type: 'RESET' };

// NTT helpers
function computeNTT(coefficients: bigint[], omega: bigint, fieldSize: bigint, direction: 'forward' | 'inverse'): { evaluations: bigint[]; layers: ButterflyLayer[] } {
  if (direction === 'forward') {
    const result = nttForward(coefficients, omega, fieldSize);
    return { evaluations: result.output, layers: result.layers };
  } else {
    const result = nttInverse(coefficients, omega, fieldSize);
    return { evaluations: result.output, layers: result.layers };
  }
}

const IPA_FIELD = 101n;
const IPA_N = 4; // 4 coefficients = 2 halving rounds

function buildInitialIPA(): IPADemoState {
  const coefficients = [3n, 1n, 4n, 1n];
  const generators = generateGenerators(IPA_N, IPA_FIELD);
  const commitment = ipaCommit(coefficients, generators, IPA_FIELD);
  const evalPoint = 7n;
  const evalValue = evaluatePolyForIPA(coefficients, evalPoint, IPA_FIELD);
  return {
    coefficients,
    generators,
    commitment,
    fieldSize: IPA_FIELD,
    evalPoint,
    evalValue,
    rounds: [],
    currentRound: -1,
    phase: 'committed',
  };
}

function buildInitialBatch(): BatchOpeningDemoState {
  return {
    polynomials: [[3n, 1n, 4n], [1n, 5n, 9n]], // two degree-2 polys
    evalPoint: 7n,
    gamma: 3n,
    result: null,
    fieldSize: 101n,
  };
}

interface SerializedIPAState {
  coefficients?: number[];
  evalPoint?: number;
  phase?: IPADemoState['phase'];
  currentRound?: number;
}

interface SerializedBatchState {
  polynomials?: number[][];
  evalPoint?: number;
  gamma?: number;
  fieldSize?: number;
  computed?: boolean;
  activeStep?: number;
}

function clampBatchStep(value: number | undefined, maxIndex: number): number {
  if (maxIndex < 0) return 0;
  if (typeof value !== 'number' || Number.isNaN(value)) return maxIndex;
  return Math.max(0, Math.min(value, maxIndex));
}

function restoreIpaState(payload: SerializedIPAState): IPADemoState {
  const base = buildInitialIPA();
  const coefficients = payload.coefficients && payload.coefficients.length > 0
    ? payload.coefficients.map(BigInt)
    : base.coefficients;
  const evalPoint = payload.evalPoint !== undefined ? BigInt(payload.evalPoint) : base.evalPoint;
  const generators = generateGenerators(coefficients.length, base.fieldSize);
  const commitment = ipaCommit(coefficients, generators, base.fieldSize);
  const evalValue = evaluatePolyForIPA(coefficients, evalPoint, base.fieldSize);
  const hasProof = payload.phase === 'proving' || payload.phase === 'verified' || payload.phase === 'failed';
  const rounds = hasProof
    ? ipaProve(
      coefficients,
      generators,
      commitment,
      evalPoint,
      evalValue,
      buildIpaChallenges(coefficients.length),
      base.fieldSize,
    )
    : [];
  const maxRound = rounds.length > 0 ? rounds.length - 1 : -1;

  return {
    coefficients,
    generators,
    commitment,
    fieldSize: base.fieldSize,
    evalPoint,
    evalValue,
    rounds,
    currentRound: Math.max(-1, Math.min(payload.currentRound ?? -1, maxRound)),
    phase: payload.phase ?? 'committed',
  };
}

function restoreBatchState(payload: SerializedBatchState): {
  batch: BatchOpeningDemoState;
  activeStep: number;
} {
  const base = buildInitialBatch();
  const batch: BatchOpeningDemoState = {
    polynomials: payload.polynomials
      ? payload.polynomials.map((poly) => poly.map(BigInt))
      : base.polynomials,
    evalPoint: payload.evalPoint !== undefined ? BigInt(payload.evalPoint) : base.evalPoint,
    gamma: payload.gamma !== undefined ? BigInt(payload.gamma) : base.gamma,
    fieldSize: payload.fieldSize !== undefined ? BigInt(payload.fieldSize) : base.fieldSize,
    result: null,
  };

  if (!payload.computed) {
    return { batch, activeStep: 0 };
  }

  try {
    const result = batchOpen({
      polynomials: batch.polynomials,
      evalPoint: batch.evalPoint,
      gamma: batch.gamma,
      fieldSize: batch.fieldSize,
    });
    return {
      batch: { ...batch, result },
      activeStep: clampBatchStep(payload.activeStep, result.steps.length - 1),
    };
  } catch {
    return { batch, activeStep: 0 };
  }
}

function buildInitialNTT(): NTTState {
  const preset = NTT_PRESETS[1]!; // n=8, p=257
  const coefficients = [1n, 2n, 3n, 0n, 0n, 0n, 0n, 0n];
  const { evaluations, layers } = computeNTT(coefficients, preset.omega, preset.p, 'forward');
  return {
    coefficients,
    evaluations,
    layers,
    omega: preset.omega,
    fieldSize: preset.p,
    n: preset.n,
    direction: 'forward',
    activeLayer: -1,
  };
}

// Initial state
const initialState: PolynomialState = {
  coefficients: [0, 0, 1], // x^2
  compareEnabled: false,
  compareCoefficients: [],
  mode: 'coefficients',
  lagrangePoints: [],
  evalPoints: [],
  kzg: {
    commitment: null,
    challengeZ: null,
    revealedValue: null,
    quotientPoly: null,
    proofHash: null,
    verified: null,
    currentStep: 0,
  },
  viewRange: {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 25,
  },
  ntt: buildInitialNTT(),
  ipa: buildInitialIPA(),
  batch: buildInitialBatch(),
};

function makeCompareCoefficients(base: number[]): number[] {
  return base.map((c, i) => c + (i % 2 === 0 ? 0.6 : -0.4));
}

// Reducer
function polynomialReducer(state: PolynomialState, action: PolynomialAction): PolynomialState {
  switch (action.type) {
    case 'SET_COEFFICIENTS':
      return {
        ...state,
        coefficients: action.coefficients,
        compareCoefficients: state.compareEnabled ? makeCompareCoefficients(action.coefficients) : state.compareCoefficients,
      };

    case 'SET_COEFF': {
      const newCoeffs = [...state.coefficients];
      newCoeffs[action.index] = action.value;
      return {
        ...state,
        coefficients: newCoeffs,
        compareCoefficients: state.compareEnabled ? makeCompareCoefficients(newCoeffs) : state.compareCoefficients,
      };
    }

    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        lagrangePoints: action.mode === 'lagrange' ? [] : state.lagrangePoints,
        coefficients: action.mode === 'lagrange' ? [] : state.coefficients,
      };

    case 'ADD_LAGRANGE_POINT': {
      const newPoints = [...state.lagrangePoints, { x: action.x, y: action.y }];
      const coefficients = newPoints.length >= 2 ? fitLagrangePolynomial(newPoints) : [];
      return {
        ...state,
        lagrangePoints: newPoints,
        coefficients,
      };
    }

    case 'CLEAR_LAGRANGE':
      return {
        ...state,
        lagrangePoints: [],
        coefficients: [],
      };

    case 'ADD_EVAL_POINT':
      return {
        ...state,
        evalPoints: [...state.evalPoints, action.point].slice(-20),
      };

    case 'CLEAR_EVAL_POINTS':
      return { ...state, evalPoints: [] };

    case 'SET_EVAL_POINTS':
      return { ...state, evalPoints: action.points.slice(-20) };

    case 'KZG_COMMIT':
      return {
        ...state,
        kzg: {
          commitment: action.commitment,
          challengeZ: null,
          revealedValue: null,
          quotientPoly: null,
          proofHash: null,
          verified: null,
          currentStep: 1,
        },
      };

    case 'KZG_CHALLENGE':
      return {
        ...state,
        kzg: {
          ...state.kzg,
          challengeZ: action.challengeZ,
          currentStep: 2,
        },
      };

    case 'KZG_REVEAL':
      return {
        ...state,
        kzg: {
          ...state.kzg,
          revealedValue: action.revealedValue,
          quotientPoly: action.quotientPoly,
          proofHash: action.proofHash,
          currentStep: 3,
        },
      };

    case 'KZG_VERIFY':
      return {
        ...state,
        kzg: {
          ...state.kzg,
          verified: action.verified,
          currentStep: 4,
        },
      };

    case 'KZG_RESET':
      return {
        ...state,
        kzg: {
          commitment: null,
          challengeZ: null,
          revealedValue: null,
          quotientPoly: null,
          proofHash: null,
          verified: null,
          currentStep: 0,
        },
      };

    case 'SET_VIEW_RANGE':
      return {
        ...state,
        viewRange: action.viewRange,
      };

    case 'ADD_TERM':
      return {
        ...state,
        coefficients: [...state.coefficients, 0],
        compareCoefficients: state.compareEnabled ? makeCompareCoefficients([...state.coefficients, 0]) : state.compareCoefficients,
      };

    case 'REMOVE_TERM':
      if (state.coefficients.length <= 1) return state;
      return {
        ...state,
        coefficients: state.coefficients.slice(0, -1),
        compareCoefficients: state.compareEnabled ? makeCompareCoefficients(state.coefficients.slice(0, -1)) : state.compareCoefficients,
      };

    case 'TOGGLE_COMPARE': {
      const nextEnabled = !state.compareEnabled;
      return {
        ...state,
        compareEnabled: nextEnabled,
        compareCoefficients: nextEnabled ? makeCompareCoefficients(state.coefficients) : [],
      };
    }

    case 'SET_COMPARE_COEFFS':
      return {
        ...state,
        compareCoefficients: action.coefficients,
      };

    case 'SET_KZG_STATE':
      return {
        ...state,
        kzg: {
          commitment: action.kzg.commitment ?? null,
          challengeZ: action.kzg.challengeZ ?? null,
          revealedValue: action.kzg.revealedValue ?? null,
          quotientPoly: action.kzg.quotientPoly ?? null,
          proofHash: action.kzg.proofHash ?? null,
          verified: action.kzg.verified ?? null,
          currentStep: action.kzg.currentStep ?? 0,
        },
      };

    case 'SET_NTT_COEFFICIENTS': {
      const nttResult = computeNTT(action.coefficients, state.ntt.omega, state.ntt.fieldSize, state.ntt.direction);
      return { ...state, ntt: { ...state.ntt, coefficients: action.coefficients, ...nttResult } };
    }

    case 'SET_NTT_COEFF': {
      const newNttCoeffs = [...state.ntt.coefficients];
      newNttCoeffs[action.index] = action.value;
      const nttResult2 = computeNTT(newNttCoeffs, state.ntt.omega, state.ntt.fieldSize, state.ntt.direction);
      return { ...state, ntt: { ...state.ntt, coefficients: newNttCoeffs, ...nttResult2 } };
    }

    case 'SET_NTT_SIZE': {
      const preset = NTT_PRESETS.find((p) => p.n === action.n);
      if (!preset) return state;
      const newCoeffs = new Array(action.n).fill(0n);
      // Copy existing coefficients that fit
      for (let i = 0; i < Math.min(state.ntt.coefficients.length, action.n); i++) {
        newCoeffs[i] = state.ntt.coefficients[i]!;
      }
      const nttResult3 = computeNTT(newCoeffs, preset.omega, preset.p, state.ntt.direction);
      return {
        ...state,
        ntt: {
          ...state.ntt,
          coefficients: newCoeffs,
          omega: preset.omega,
          fieldSize: preset.p,
          n: action.n,
          activeLayer: -1,
          ...nttResult3,
        },
      };
    }

    case 'SET_NTT_DIRECTION': {
      const nttResult4 = computeNTT(state.ntt.coefficients, state.ntt.omega, state.ntt.fieldSize, action.direction);
      return { ...state, ntt: { ...state.ntt, direction: action.direction, activeLayer: -1, ...nttResult4 } };
    }

    case 'SET_NTT_ACTIVE_LAYER':
      return { ...state, ntt: { ...state.ntt, activeLayer: action.layer } };

    case 'NTT_STEP': {
      const maxLayer = Math.log2(state.ntt.n) - 1;
      const nextLayer = state.ntt.activeLayer < maxLayer ? state.ntt.activeLayer + 1 : -1;
      return { ...state, ntt: { ...state.ntt, activeLayer: nextLayer } };
    }

    case 'NTT_RESET':
      return { ...state, ntt: { ...state.ntt, activeLayer: -1 } };

    case 'SET_NTT_STATE':
      return { ...state, ntt: action.ntt };

    case 'IPA_SET_COEFFICIENTS': {
      const newGens = generateGenerators(action.coefficients.length, state.ipa.fieldSize);
      const newCommit = ipaCommit(action.coefficients, newGens, state.ipa.fieldSize);
      const newEvalVal = evaluatePolyForIPA(action.coefficients, state.ipa.evalPoint, state.ipa.fieldSize);
      return { ...state, ipa: { ...state.ipa, coefficients: action.coefficients, generators: newGens, commitment: newCommit, evalValue: newEvalVal, rounds: [], currentRound: -1, phase: 'committed' } };
    }

    case 'IPA_SET_COEFF': {
      const newIpaCoeffs = [...state.ipa.coefficients];
      newIpaCoeffs[action.index] = action.value;
      const updatedCommit = ipaCommit(newIpaCoeffs, state.ipa.generators, state.ipa.fieldSize);
      const updatedEvalVal = evaluatePolyForIPA(newIpaCoeffs, state.ipa.evalPoint, state.ipa.fieldSize);
      return { ...state, ipa: { ...state.ipa, coefficients: newIpaCoeffs, commitment: updatedCommit, evalValue: updatedEvalVal, rounds: [], currentRound: -1, phase: 'committed' } };
    }

    case 'IPA_SET_EVAL_POINT': {
      const newVal = evaluatePolyForIPA(state.ipa.coefficients, action.point, state.ipa.fieldSize);
      return { ...state, ipa: { ...state.ipa, evalPoint: action.point, evalValue: newVal, rounds: [], currentRound: -1, phase: 'committed' } };
    }

    case 'IPA_PROVE': {
      const rounds = ipaProve(state.ipa.coefficients, state.ipa.generators, state.ipa.commitment, state.ipa.evalPoint, state.ipa.evalValue, action.challenges, state.ipa.fieldSize);
      return { ...state, ipa: { ...state.ipa, rounds, currentRound: -1, phase: 'proving' } };
    }

    case 'IPA_VERIFY': {
      const passed = ipaVerify(state.ipa.commitment, state.ipa.evalPoint, state.ipa.evalValue, state.ipa.rounds, state.ipa.generators, state.ipa.fieldSize);
      return { ...state, ipa: { ...state.ipa, phase: passed ? 'verified' : 'failed' } };
    }

    case 'IPA_RESET':
      return { ...state, ipa: buildInitialIPA() };

    case 'IPA_SET_ACTIVE_ROUND':
      return { ...state, ipa: { ...state.ipa, currentRound: action.round } };

    case 'SET_IPA_STATE':
      return { ...state, ipa: action.ipa };

    case 'BATCH_SET_EVAL_POINT':
      return { ...state, batch: { ...state.batch, evalPoint: action.evalPoint, result: null } };

    case 'BATCH_SET_GAMMA':
      return { ...state, batch: { ...state.batch, gamma: action.gamma, result: null } };

    case 'BATCH_ADD_POLY': {
      if (state.batch.polynomials.length >= 5) return state;
      return { ...state, batch: { ...state.batch, polynomials: [...state.batch.polynomials, [0n, 1n]], result: null } };
    }

    case 'BATCH_REMOVE_POLY': {
      if (state.batch.polynomials.length <= 1) return state;
      const newPolys = state.batch.polynomials.filter((_, i) => i !== action.index);
      return { ...state, batch: { ...state.batch, polynomials: newPolys, result: null } };
    }

    case 'BATCH_SET_COEFF': {
      const polys = state.batch.polynomials.map((p, pi) => {
        if (pi !== action.polyIndex) return p;
        const newPoly = [...p];
        // Extend if needed
        while (newPoly.length <= action.coeffIndex) newPoly.push(0n);
        newPoly[action.coeffIndex] = action.value;
        return newPoly;
      });
      return { ...state, batch: { ...state.batch, polynomials: polys, result: null } };
    }

    case 'BATCH_COMPUTE':
      return { ...state, batch: { ...state.batch, result: action.result } };

    case 'BATCH_RESET':
      return { ...state, batch: buildInitialBatch() };

    case 'SET_BATCH_STATE':
      return { ...state, batch: action.batch };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

export function PolynomialDemo() {
  const [state, dispatch] = useReducer(polynomialReducer, initialState);
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const [hoverInfo, setHoverInfo] = useState<{
    key: string;
    title: string;
    body: string;
  } | null>(null);
  const [pipelineHash, setPipelineHash] = useState<string | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas size ref for coordinate transforms
  const canvasSizeRef = useRef({ width: 800, height: 600 });

  // Attack mode bridge
  const { currentDemoAction } = useAttack();
  useAttackActions(currentDemoAction, useMemo(() => ({
    KZG_RESET: () => dispatch({ type: 'KZG_RESET' }),
    TOGGLE_COMPARE: () => dispatch({ type: 'TOGGLE_COMPARE' }),
    KZG_RUN_COMMIT: () => {
      simulateKzgCommit(state.coefficients).then((commitment) => {
        dispatch({ type: 'KZG_COMMIT', commitment });
      });
    },
    KZG_RUN_OPEN: () => {
      if (state.kzg.challengeZ == null) {
        const challengeZ = simulateKzgChallenge();
        dispatch({ type: 'KZG_CHALLENGE', challengeZ });
        simulateKzgProof(state.coefficients, challengeZ).then(({ revealedValue, quotientPoly, proofHash }) => {
          dispatch({ type: 'KZG_REVEAL', revealedValue, quotientPoly, proofHash });
        });
      } else {
        simulateKzgProof(state.coefficients, state.kzg.challengeZ).then(({ revealedValue, quotientPoly, proofHash }) => {
          dispatch({ type: 'KZG_REVEAL', revealedValue, quotientPoly, proofHash });
        });
      }
    },
  }), [state.coefficients, state.kzg.challengeZ]));

  // Canvas interaction
  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      if (state.mode === 'lagrange') {
        const { mx, my } = canvasToMath(x, y, state.viewRange, canvasSizeRef.current.width, canvasSizeRef.current.height);
        dispatch({ type: 'ADD_LAGRANGE_POINT', x: mx, y: my });
      }
    },
    [state.mode, state.viewRange]
  );

  const camera = useCanvasCamera();
  const handleCanvasClickWorld = useCallback(
    (x: number, y: number) => {
      const world = camera.toWorld(x, y);
      handleCanvasClick(world.x, world.y);
    },
    [handleCanvasClick]
  );
  const interaction = useCanvasInteraction(handleCanvasClickWorld);
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const [evalInput, setEvalInput] = useState('');
  const [lagrangeInput, setLagrangeInput] = useState('');
  const [challengeInput, setChallengeInput] = useState('');
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [batchActiveStep, setBatchActiveStep] = useState(0);

  // Draw function
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      canvasSizeRef.current = { width: frame.width, height: frame.height };

      if (state.mode === "ntt") {
        renderNTT(ctx, frame, {
          coefficients: state.ntt.coefficients,
          evaluations: state.ntt.evaluations,
          layers: state.ntt.layers,
          omega: state.ntt.omega,
          fieldSize: state.ntt.fieldSize,
          n: state.ntt.n,
          direction: state.ntt.direction,
          activeLayer: state.ntt.activeLayer,
        }, theme);
        return;
      }

      if (state.mode === "ipa") {
        renderIPA(ctx, frame, {
          coefficients: state.ipa.coefficients,
          generators: state.ipa.generators,
          commitment: state.ipa.commitment,
          evalPoint: state.ipa.evalPoint,
          evalValue: state.ipa.evalValue,
          rounds: state.ipa.rounds,
          currentRound: state.ipa.currentRound,
          phase: state.ipa.phase,
          fieldSize: state.ipa.fieldSize,
        }, theme);
        return;
      }

      if (state.mode === "batch") {
        renderBatch(ctx, frame, {
          polynomials: state.batch.polynomials,
          evalPoint: state.batch.evalPoint,
          gamma: state.batch.gamma,
          result: state.batch.result,
          fieldSize: state.batch.fieldSize,
          activeStep: batchActiveStep,
        }, theme);
        return;
      }

      const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
      const { hovered } = renderPolynomial(ctx, frame, state, worldMouse.x, worldMouse.y, theme);

      let nextHover: { key: string; title: string; body: string } | null = null;
      if (hovered?.type === "eval") {
        nextHover = {
          key: `eval-${hovered.x}-${hovered.y}`,
          title: "Evaluation point",
          body: `${hovered.label}`,
        };
      } else if (hovered?.type === "lagrange") {
        nextHover = {
          key: `lagrange-${hovered.x}-${hovered.y}`,
          title: "Interpolation point",
          body: `Point (${hovered.x.toFixed(2)}, ${hovered.y.toFixed(2)}) constrains the polynomial.`,
        };
      } else if (hovered?.type === "challenge") {
        nextHover = {
          key: "challenge-" + hovered.z,
          title: "KZG challenge z",
          body: "Verifier\u0027s random evaluation point used to open the commitment.",
        };
      }

      if (nextHover?.key !== hoverKeyRef.current) {
        hoverKeyRef.current = nextHover?.key ?? null;
        setHoverInfo(nextHover);
      }
    },
    [state, interaction.mouseX, interaction.mouseY, camera, theme, batchActiveStep]
  );

  // Handlers
  const handleModeChange = useCallback((mode: 'coefficients' | 'lagrange' | 'ntt' | 'ipa' | 'batch') => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const handleCoeffChange = useCallback((index: number, value: number) => {
    dispatch({ type: 'SET_COEFF', index, value });
  }, []);

  const handleToggleCompare = useCallback(() => {
    dispatch({ type: 'TOGGLE_COMPARE' });
  }, []);

  const handleResampleCompare = useCallback(() => {
    const next = state.coefficients.map((c, i) => c + (Math.random() - 0.5) * (i + 1) * 0.6);
    dispatch({ type: 'SET_COMPARE_COEFFS', coefficients: next });
  }, [state.coefficients]);

  const handleAddLagrangePoint = useCallback(
    (input: string) => {
      const parts = input.split(',').map((s) => s.trim());
      if (parts.length !== 2) return;
      const x = parseFloat(parts[0]!);
      const y = parseFloat(parts[1]!);
      if (isNaN(x) || isNaN(y)) return;
      dispatch({ type: 'ADD_LAGRANGE_POINT', x, y });
      setLagrangeInput('');
    },
    []
  );

  const handleEvaluate = useCallback(
    (xStr: string) => {
      const x = parseFloat(xStr);
      if (isNaN(x) || state.coefficients.length === 0) return;

      const y = evaluatePolynomial(state.coefficients, x);
      dispatch({
        type: 'ADD_EVAL_POINT',
        point: { x, y, label: `p(${x}) = ${y.toFixed(2)}` },
      });
    },
    [state.coefficients]
  );

  const handleKzgCommit = useCallback(async () => {
    if (state.coefficients.length === 0) return;
    const commitment = await simulateKzgCommit(state.coefficients);
    dispatch({ type: 'KZG_COMMIT', commitment });
  }, [state.coefficients]);

  const handleKzgChallenge = useCallback((fixedZ?: number) => {
    const challengeZ = simulateKzgChallenge(fixedZ);
    dispatch({ type: 'KZG_CHALLENGE', challengeZ });
  }, []);

  const handleKzgReveal = useCallback(async () => {
    if (state.kzg.challengeZ === null) return;
    const result = await simulateKzgProof(state.coefficients, state.kzg.challengeZ);
    dispatch({
      type: 'KZG_REVEAL',
      revealedValue: result.revealedValue,
      quotientPoly: result.quotientPoly,
      proofHash: result.proofHash,
    });
  }, [state.coefficients, state.kzg.challengeZ]);

  const handleKzgVerify = useCallback(async () => {
    if (
      !state.kzg.commitment ||
      state.kzg.challengeZ === null ||
      state.kzg.revealedValue === null ||
      !state.kzg.proofHash
    ) {
      return;
    }

    const verified = await simulateKzgVerify(
      state.kzg.commitment,
      state.kzg.challengeZ,
      state.kzg.revealedValue,
      state.kzg.proofHash,
      state.coefficients
    );

    dispatch({ type: 'KZG_VERIFY', verified });
  }, [state.kzg, state.coefficients]);

  const handleAutoScale = useCallback(() => {
    if (state.coefficients.length === 0) return;
    const newRange = autoScale(state.coefficients, [state.viewRange.xMin, state.viewRange.xMax]);
    dispatch({ type: 'SET_VIEW_RANGE', viewRange: newRange });
  }, [state.coefficients, state.viewRange.xMin, state.viewRange.xMax]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvasSizeRef.current.width || 800;
    const height = rect.height || canvasSizeRef.current.height || 600;
    fitCameraToBounds(camera, canvas, {
      minX: 24,
      minY: 24,
      maxX: width - 24,
      maxY: height - 24,
    }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  const handleEmbedPlay = useCallback(async () => {
    if (state.kzg.currentStep === 0) {
      await handleKzgCommit();
      return;
    }
    if (state.kzg.currentStep === 1) {
      handleKzgChallenge();
      return;
    }
    if (state.kzg.currentStep === 2) {
      await handleKzgReveal();
      return;
    }
    if (state.kzg.currentStep === 3) {
      await handleKzgVerify();
      return;
    }
    dispatch({ type: 'KZG_RESET' });
  }, [handleKzgChallenge, handleKzgCommit, handleKzgReveal, handleKzgVerify, state.kzg.currentStep]);

  const buildShareState = () => ({
    mode: state.mode,
    coefficients: state.coefficients,
    compareEnabled: state.compareEnabled,
    compareCoefficients: state.compareCoefficients,
    kzg: state.kzg.currentStep > 0 ? state.kzg : undefined,
    evalPoints: state.evalPoints.length > 0 ? state.evalPoints : undefined,
    ntt: state.mode === 'ntt' ? {
      coefficients: state.ntt.coefficients.map(Number),
      n: state.ntt.n,
      direction: state.ntt.direction,
      activeLayer: state.ntt.activeLayer,
    } : undefined,
    ipa: state.mode === 'ipa' ? {
      coefficients: state.ipa.coefficients.map(Number),
      evalPoint: Number(state.ipa.evalPoint),
      phase: state.ipa.phase,
      currentRound: state.ipa.currentRound,
    } : undefined,
    batch: state.mode === 'batch' ? {
      polynomials: state.batch.polynomials.map(p => p.map(Number)),
      evalPoint: Number(state.batch.evalPoint),
      gamma: Number(state.batch.gamma),
      fieldSize: Number(state.batch.fieldSize),
      computed: state.batch.result ? true : undefined,
      activeStep: state.batch.result ? batchActiveStep : undefined,
    } : undefined,
  });

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('p');
    url.hash = `polynomial|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'polynomial');
    url.searchParams.set('p', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-polynomial.png', showDownloadToast);
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'polynomial',
      timestamp: new Date().toISOString(),
      mode: state.mode,
      coefficients: state.coefficients,
      compareEnabled: state.compareEnabled,
      compareCoefficients: state.compareCoefficients,
      kzg: state.kzg,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Polynomial coefficients, KZG proof & session metadata');
  };

  // Initialize from URL state (hash-only preferred)
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'polynomial' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      mode?: 'coefficients' | 'lagrange' | 'ntt' | 'ipa' | 'batch';
      coefficients?: number[];
      compareEnabled?: boolean;
      compareCoefficients?: number[];
      kzg?: PolynomialState['kzg'];
      evalPoints?: EvalPoint[];
      pipelineHash?: string;
      ntt?: { coefficients?: number[]; n?: number; direction?: 'forward' | 'inverse'; activeLayer?: number };
      ipa?: SerializedIPAState;
      batch?: SerializedBatchState;
    }>(rawHash);

    const raw = decodedHash ? null : getSearchParam('p');
    const decoded = decodeState<{
      mode?: 'coefficients' | 'lagrange' | 'ntt' | 'ipa' | 'batch';
      coefficients?: number[];
      compareEnabled?: boolean;
      compareCoefficients?: number[];
      kzg?: PolynomialState['kzg'];
      evalPoints?: EvalPoint[];
      pipelineHash?: string;
      ntt?: { coefficients?: number[]; n?: number; direction?: 'forward' | 'inverse'; activeLayer?: number };
      ipa?: SerializedIPAState;
      batch?: SerializedBatchState;
    }>(raw);

    const payload = decodedHash ?? decoded;
    if (!payload) return;
    if (payload.mode) {
      dispatch({ type: 'SET_MODE', mode: payload.mode });
    }
    if (payload.coefficients && payload.coefficients.length > 0) {
      dispatch({ type: 'SET_COEFFICIENTS', coefficients: payload.coefficients.slice(0, 20) });
    }
    if (payload.compareEnabled) {
      dispatch({ type: 'TOGGLE_COMPARE' });
      if (payload.compareCoefficients && payload.compareCoefficients.length > 0) {
        dispatch({ type: 'SET_COMPARE_COEFFS', coefficients: payload.compareCoefficients });
      }
    }
    if (payload.kzg) {
      dispatch({ type: 'SET_KZG_STATE', kzg: payload.kzg });
    }
    if (payload.evalPoints && payload.evalPoints.length > 0) {
      dispatch({ type: 'SET_EVAL_POINTS', points: payload.evalPoints });
    }
    if (typeof payload.pipelineHash === 'string') {
      setPipelineHash(payload.pipelineHash);
    }
    if (payload.ntt) {
      const nttPayload = payload.ntt;
      // Restore NTT size first if different
      if (nttPayload.n && nttPayload.n !== 8) {
        dispatch({ type: 'SET_NTT_SIZE', n: nttPayload.n });
      }
      if (nttPayload.direction) {
        dispatch({ type: 'SET_NTT_DIRECTION', direction: nttPayload.direction });
      }
      if (nttPayload.coefficients && nttPayload.coefficients.length > 0) {
        dispatch({ type: 'SET_NTT_COEFFICIENTS', coefficients: nttPayload.coefficients.map(BigInt) });
      }
      if (nttPayload.activeLayer !== undefined && nttPayload.activeLayer !== -1) {
        dispatch({ type: 'SET_NTT_ACTIVE_LAYER', layer: nttPayload.activeLayer });
      }
    }
    if (payload.ipa) {
      dispatch({ type: 'SET_IPA_STATE', ipa: restoreIpaState(payload.ipa) });
    }
    if (payload.batch) {
      const restoredBatch = restoreBatchState(payload.batch);
      dispatch({ type: 'SET_BATCH_STATE', batch: restoredBatch.batch });
      setBatchActiveStep(restoredBatch.activeStep);
    }
  }, []);

  // Sync to URL
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'polynomial') return;
    const payload = {
      mode: state.mode,
      coefficients: state.coefficients,
      compareEnabled: state.compareEnabled,
      compareCoefficients: state.compareCoefficients,
      kzg: state.kzg.currentStep > 0 ? state.kzg : undefined,
      evalPoints: state.evalPoints.length > 0 ? state.evalPoints : undefined,
      ntt: state.mode === 'ntt' ? {
        coefficients: state.ntt.coefficients.map(Number),
        n: state.ntt.n,
        direction: state.ntt.direction,
        activeLayer: state.ntt.activeLayer,
      } : undefined,
      ipa: state.mode === 'ipa' ? {
        coefficients: state.ipa.coefficients.map(Number),
        evalPoint: Number(state.ipa.evalPoint),
        phase: state.ipa.phase,
        currentRound: state.ipa.currentRound,
      } : undefined,
      batch: state.mode === 'batch' ? {
        polynomials: state.batch.polynomials.map(p => p.map(Number)),
        evalPoint: Number(state.batch.evalPoint),
        gamma: Number(state.batch.gamma),
        fieldSize: Number(state.batch.fieldSize),
        computed: state.batch.result ? true : undefined,
        activeStep: state.batch.result ? batchActiveStep : undefined,
      } : undefined,
    };
    setSearchParams({ p: encodeState(payload) });
  }, [state.mode, state.coefficients, state.compareEnabled, state.compareCoefficients, state.kzg, state.evalPoints, state.ntt, state.ipa, state.batch, batchActiveStep]);

  useEffect(() => {
    if (hoverInfo) {
      setEntry('polynomial', {
        title: hoverInfo.title,
        body: hoverInfo.body,
        nextSteps: ['Add more points or evaluate another x', 'Continue the KZG flow below'],
      });
      return;
    }

    if (state.mode === 'ntt') {
      const logn = Math.log2(state.ntt.n);
      const layerLabel = state.ntt.activeLayer === -1 ? 'all layers' : `layer ${state.ntt.activeLayer} of ${logn}`;
      setEntry('polynomial', {
        title: 'Number Theoretic Transform',
        body: `${state.ntt.direction === 'forward' ? 'Forward' : 'Inverse'} NTT over GF(${state.ntt.fieldSize}), n=${state.ntt.n}. Viewing ${layerLabel}.`,
        nextSteps: ['Step through butterfly layers', 'Change size or direction', 'Edit coefficients in the sidebar'],
      });
      return;
    }

    if (state.mode === 'ipa') {
      const phaseLabel = state.ipa.phase === 'committed' ? 'Ready to prove' : state.ipa.phase === 'proving' ? 'Proof generated' : state.ipa.phase === 'verified' ? 'Verified' : 'Failed';
      setEntry('polynomial', {
        title: 'Inner Product Argument',
        body: `IPA over GF(${state.ipa.fieldSize}), n=${state.ipa.coefficients.length}. ${phaseLabel}. ${state.ipa.rounds.length} halving rounds.`,
        nextSteps: ['Press Prove to run the halving protocol', 'Press Verify to check the folded commitment', 'Edit coefficients to change the polynomial'],
      });
      return;
    }

    if (state.mode === 'batch') {
      const resultInfo = state.batch.result
        ? (state.batch.result.consistent ? 'Consistent.' : 'Inconsistent!')
        : 'Not yet computed.';
      setEntry('polynomial', {
        title: 'Batch Opening',
        body: `${state.batch.polynomials.length} polynomials over GF(${state.batch.fieldSize}), z=${state.batch.evalPoint}, \u03b3=${state.batch.gamma}. ${resultInfo}`,
        nextSteps: ['Edit polynomials and parameters', 'Press Compute to run the batch opening', 'Step through the result stages'],
      });
      return;
    }

    if (state.mode === 'lagrange') {
      setEntry('polynomial', {
        title: 'Lagrange interpolation',
        body: `Place points to fit a polynomial. Current points: ${state.lagrangePoints.length}.`,
        nextSteps: ['Click the canvas to add points', 'Clear points to restart'],
      });
      return;
    }

    let body = 'Adjust coefficients to reshape the curve and explore evaluations.';
    if (state.kzg.currentStep === 1) body = 'Commitment fixed. Next: choose a challenge point z.';
    if (state.kzg.currentStep === 2) body = 'Challenge chosen. Reveal p(z) and the quotient proof.';
    if (state.kzg.currentStep === 3) body = 'Proof computed. Verify to check binding.';
    if (state.kzg.currentStep === 4) body = state.kzg.verified ? 'Verification passed.' : 'Verification failed.';

    setEntry('polynomial', {
      title: 'KZG flow',
      body,
      nextSteps:
        state.kzg.currentStep === 0
          ? ['Click Commit to lock the polynomial', 'Evaluate at a test x']
          : state.kzg.currentStep === 1
            ? ['Click Challenge to pick z']
            : state.kzg.currentStep === 2
              ? ['Reveal & Prove the opening']
              : state.kzg.currentStep === 3
                ? ['Verify the proof']
        : ['Reset to try another polynomial'],
    });
  }, [hoverInfo, state.mode, state.lagrangePoints.length, state.kzg.currentStep, state.kzg.verified, state.ntt, state.ipa, state.batch, setEntry]);

  const handleResetToDefaults = useCallback((showFeedback = false) => {
    dispatch({ type: 'RESET' });
    setEvalInput('');
    setLagrangeInput('');
    setChallengeInput('');
    if (showFeedback) {
      showToast('Reset to defaults');
    }
  }, []);

  return (
    <DemoLayout
      onEmbedPlay={state.mode === 'coefficients' || state.mode === 'lagrange' ? handleEmbedPlay : undefined}
      onEmbedReset={() => handleResetToDefaults()}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar width="compact">
        <ControlGroup label="Polynomial Mode">
          <SelectControl
            label="Mode"
            value={state.mode}
            options={[
              { value: 'coefficients', label: 'Coefficients' },
              { value: 'lagrange', label: 'Lagrange' },
              { value: 'ntt', label: 'NTT' },
              { value: 'ipa', label: 'IPA' },
              { value: 'batch', label: 'Batch' },
            ]}
            onChange={(v) => handleModeChange(v as 'coefficients' | 'lagrange' | 'ntt' | 'ipa' | 'batch')}
          />
        </ControlGroup>

        {state.mode === 'ntt' ? (
          <>
            <ControlGroup label="NTT Transform">
              <SelectControl
                label="Size (n)"
                value={String(state.ntt.n)}
                options={NTT_PRESETS.map((p) => ({ value: String(p.n), label: `n = ${p.n}` }))}
                onChange={(v) => dispatch({ type: 'SET_NTT_SIZE', n: parseInt(v) })}
              />
              <div className="control-button-row">
                <ButtonControl
                  label="Forward"
                  onClick={() => dispatch({ type: 'SET_NTT_DIRECTION', direction: 'forward' })}
                  variant={state.ntt.direction === 'forward' ? 'primary' : 'secondary'}
                />
                <ButtonControl
                  label="Inverse"
                  onClick={() => dispatch({ type: 'SET_NTT_DIRECTION', direction: 'inverse' })}
                  variant={state.ntt.direction === 'inverse' ? 'primary' : 'secondary'}
                />
              </div>
              <ControlNote>
                GF({Number(state.ntt.fieldSize)}), {'\u03c9'} = {Number(state.ntt.omega)}
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Coefficients">
              {state.ntt.coefficients.map((coeff, index) => (
                <NumberInputControl
                  key={`ntt-coeff-${index}`}
                  label={`a${index}`}
                  value={Number(coeff)}
                  min={0}
                  max={Number(state.ntt.fieldSize) - 1}
                  step={1}
                  onChange={(v) => dispatch({ type: 'SET_NTT_COEFF', index, value: BigInt(Math.round(v)) })}
                />
              ))}
            </ControlGroup>

            <ControlGroup label="Step Through">
              <ButtonControl
                label="Step"
                onClick={() => dispatch({ type: 'NTT_STEP' })}
              />
              <ButtonControl
                label="Reset"
                onClick={() => dispatch({ type: 'NTT_RESET' })}
                variant="secondary"
              />
              <ControlNote>
                {state.ntt.activeLayer === -1
                  ? 'All layers'
                  : `Layer ${state.ntt.activeLayer} of ${Math.log2(state.ntt.n)}`}
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Why NTT?" collapsible defaultCollapsed>
              <ControlCard>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: '1.5' }}>
                  Multiplication in coefficient form is O(n{'\u00b2'}). In evaluation form it is O(n) — just multiply pointwise. NTT converts between them in O(n log n). Every ZK prover does this repeatedly.
                </span>
              </ControlCard>
            </ControlGroup>
          </>
        ) : state.mode === 'ipa' ? (
          <>
            <ControlGroup label="IPA Commitment">
              <ControlNote>
                Transparent polynomial commitment (no trusted setup). Proof is O(log n).
              </ControlNote>
              <ControlCard>
                <span className="control-kicker">Commitment</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  C = {Number(state.ipa.commitment)}
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">Evaluation</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  p({Number(state.ipa.evalPoint)}) = {Number(state.ipa.evalValue)}
                </div>
              </ControlCard>
            </ControlGroup>

            <ControlGroup label="Coefficients">
              {state.ipa.coefficients.map((coeff, index) => (
                <NumberInputControl
                  key={`ipa-coeff-${index}`}
                  label={`a${index}`}
                  value={Number(coeff)}
                  min={0}
                  max={Number(state.ipa.fieldSize) - 1}
                  step={1}
                  onChange={(v) => dispatch({ type: 'IPA_SET_COEFF', index, value: BigInt(Math.round(v)) })}
                />
              ))}
              <NumberInputControl
                label="Eval point z"
                value={Number(state.ipa.evalPoint)}
                min={0}
                max={Number(state.ipa.fieldSize) - 1}
                step={1}
                onChange={(v) => dispatch({ type: 'IPA_SET_EVAL_POINT', point: BigInt(Math.round(v)) })}
              />
            </ControlGroup>

            <ControlGroup label="Protocol">
              <ButtonControl
                label="Prove"
                onClick={() => {
                  const challenges = buildIpaChallenges(state.ipa.coefficients.length);
                  dispatch({ type: 'IPA_PROVE', challenges });
                }}
                disabled={state.ipa.phase !== 'committed'}
              />
              <ButtonControl
                label="Verify"
                onClick={() => dispatch({ type: 'IPA_VERIFY' })}
                disabled={state.ipa.rounds.length === 0 || state.ipa.phase === 'verified' || state.ipa.phase === 'failed'}
              />
              <ButtonControl
                label="Reset"
                onClick={() => dispatch({ type: 'IPA_RESET' })}
                variant="secondary"
              />
              {state.ipa.phase === 'verified' && (
                <ControlNote tone="success">Proof verified — folded commitment matches.</ControlNote>
              )}
              {state.ipa.phase === 'failed' && (
                <ControlNote tone="error">Verification failed.</ControlNote>
              )}
            </ControlGroup>

            {state.ipa.rounds.length > 0 && (
              <ControlGroup label="Halving Rounds">
                {state.ipa.rounds.map((round, i) => (
                  <ControlCard key={i}>
                    <span className="control-kicker">Round {round.roundNumber}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      L = {Number(round.L)}, R = {Number(round.R)}<br />
                      u = {Number(round.challenge)}<br />
                      C' = {Number(round.newCommitment)}
                    </div>
                  </ControlCard>
                ))}
              </ControlGroup>
            )}

            <ControlGroup label="Why IPA?" collapsible defaultCollapsed>
              <ControlCard>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: '1.5' }}>
                  Inner Product Arguments need no trusted setup — anyone can verify. The proof shrinks the commitment logarithmically by halving the vector each round. Used in Bulletproofs, Halo, and Ragu.
                </span>
              </ControlCard>
            </ControlGroup>
          </>
        ) : state.mode === 'batch' ? (
          <>
            <ControlGroup label="Polynomials">
              {state.batch.polynomials.map((poly, pi) => (
                <ControlCard key={`batch-poly-${pi}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span className="control-kicker" style={{ margin: 0 }}>f{pi + 1}(x)</span>
                    {state.batch.polynomials.length > 1 && (
                      <ButtonControl
                        label="Remove"
                        onClick={() => dispatch({ type: 'BATCH_REMOVE_POLY', index: pi })}
                        variant="secondary"
                      />
                    )}
                  </div>
                  {poly.map((coeff, ci) => (
                    <NumberInputControl
                      key={`batch-${pi}-${ci}`}
                      label={ci === 0 ? 'const' : `x^${ci}`}
                      value={Number(coeff)}
                      min={0}
                      max={Number(state.batch.fieldSize) - 1}
                      step={1}
                      onChange={(v) => dispatch({ type: 'BATCH_SET_COEFF', polyIndex: pi, coeffIndex: ci, value: BigInt(Math.round(v)) })}
                    />
                  ))}
                </ControlCard>
              ))}
              <ButtonControl
                label="+ Add Polynomial"
                onClick={() => dispatch({ type: 'BATCH_ADD_POLY' })}
                variant="secondary"
                disabled={state.batch.polynomials.length >= 5}
              />
            </ControlGroup>

            <ControlGroup label="Parameters">
              <NumberInputControl
                label="Eval point z"
                value={Number(state.batch.evalPoint)}
                min={0}
                max={Number(state.batch.fieldSize) - 1}
                step={1}
                onChange={(v) => dispatch({ type: 'BATCH_SET_EVAL_POINT', evalPoint: BigInt(Math.round(v)) })}
              />
              <NumberInputControl
                label={'\u03b3 (gamma)'}
                value={Number(state.batch.gamma)}
                min={1}
                max={Number(state.batch.fieldSize) - 1}
                step={1}
                onChange={(v) => dispatch({ type: 'BATCH_SET_GAMMA', gamma: BigInt(Math.round(v)) })}
              />
              <ButtonControl
                label="Compute Batch Opening"
                onClick={() => {
                  const result = batchOpen({
                    polynomials: state.batch.polynomials,
                    evalPoint: state.batch.evalPoint,
                    gamma: state.batch.gamma,
                    fieldSize: state.batch.fieldSize,
                  });
                  dispatch({ type: 'BATCH_COMPUTE', result });
                  setBatchActiveStep(0);
                }}
              />
              <ControlNote>
                GF({Number(state.batch.fieldSize)})
              </ControlNote>
            </ControlGroup>

            {state.batch.result && (
              <ControlGroup label="Result">
                <ControlCard>
                  <span className="control-kicker">Individual evaluations</span>
                  {state.batch.result.individualEvals.map((v, i) => (
                    <div key={i} className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      f{i + 1}(z) = {v.toString()}
                    </div>
                  ))}
                </ControlCard>
                <ControlCard>
                  <span className="control-kicker">Combined eval</span>
                  <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    h(z) = {state.batch.result.combinedEval.toString()}
                  </div>
                </ControlCard>
                <ControlNote tone={state.batch.result.consistent ? 'success' : 'error'}>
                  {state.batch.result.consistent ? 'Consistency check passed' : 'Consistency check failed'}
                </ControlNote>

                <ControlCard>
                  <span className="control-kicker">Steps</span>
                  {state.batch.result.steps.map((step, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '4px 0',
                        cursor: 'pointer',
                        fontWeight: batchActiveStep === i ? 700 : 400,
                        color: batchActiveStep === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                      }}
                      onClick={() => setBatchActiveStep(i)}
                    >
                      {i + 1}. {step.stepName}: {step.description}
                    </div>
                  ))}
                </ControlCard>
              </ControlGroup>
            )}

            <ButtonControl
              label="Reset Batch"
              onClick={() => {
                dispatch({ type: 'BATCH_RESET' });
                setBatchActiveStep(0);
              }}
              variant="secondary"
            />

            <ControlGroup label="Why Batch Opening?" collapsible defaultCollapsed>
              <ControlCard>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: '1.5' }}>
                  Opening k commitments individually requires k separate proofs. Batch opening combines them into one using a random challenge {'\u03b3'}, amortizing the cost. The verifier checks h(z) = {'\u03a3'} {'\u03b3'}{'\u2071'}{'\u00b7'}f{'\u1d62'}(z) in a single operation.
                </span>
              </ControlCard>
            </ControlGroup>
          </>
        ) : state.mode === 'coefficients' ? (
          <>
            <ControlGroup label="Coefficients">
              {state.coefficients.map((coeff, index) => (
                <SliderControl
                  key={index}
                  label={`x^${index}`}
                  value={coeff}
                  min={-10}
                  max={10}
                  step={0.1}
                  onChange={(value) => handleCoeffChange(index, value)}
                  editable
                />
              ))}
              <ButtonControl label="+ Add Term" onClick={() => dispatch({ type: 'ADD_TERM' })} variant="secondary" />
              <ButtonControl
                label="- Remove Term"
                onClick={() => dispatch({ type: 'REMOVE_TERM' })}
                disabled={state.coefficients.length <= 1}
                variant="secondary"
              />
            </ControlGroup>

            <ControlGroup label="Compare Polynomials">
              <ToggleControl
                label="Enable Comparison"
                checked={Boolean(state.compareEnabled)}
                onChange={handleToggleCompare}
              />
              {state.compareEnabled && (
                <ButtonControl label="Resample Compare" onClick={handleResampleCompare} variant="secondary" />
              )}
              {state.compareEnabled && state.compareCoefficients && state.compareCoefficients.length > 0 && (
                <>
                  {state.compareCoefficients.map((coeff, index) => (
                    <SliderControl
                      key={`compare-${index}`}
                      label={`g(x) x^${index}`}
                      value={coeff}
                      min={-10}
                      max={10}
                      step={0.1}
                      onChange={(value) => {
                        const next = [...(state.compareCoefficients ?? [])];
                        next[index] = value;
                        dispatch({ type: 'SET_COMPARE_COEFFS', coefficients: next });
                      }}
                      accentColor="#8b5a3c"
                      editable
                    />
                  ))}
                </>
              )}
              {state.compareEnabled && (
                <ControlNote>
                  The intersection count hints at the Schwartz-Zippel bound.
                </ControlNote>
              )}
            </ControlGroup>
          </>
        ) : (
          <ControlGroup label="Lagrange Points">
            <ControlNote>
              Click on the canvas or type exact coordinates below.
            </ControlNote>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput
                  value={lagrangeInput}
                  onChange={setLagrangeInput}
                  placeholder="x, y (e.g. 2, 7)"
                  onSubmit={() => handleAddLagrangePoint(lagrangeInput)}
                />
              </div>
              <ButtonControl
                label="Add"
                onClick={() => handleAddLagrangePoint(lagrangeInput)}
                disabled={!lagrangeInput.includes(',')}
              />
            </div>
            {state.lagrangePoints.length > 0 && (
              <ControlCard>
                <span className="control-kicker">Points ({state.lagrangePoints.length})</span>
                <ul className="mt-1 list-inside list-disc" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {state.lagrangePoints.map((pt, i) => (
                    <li key={i}>({pt.x.toFixed(2)}, {pt.y.toFixed(2)})</li>
                  ))}
                </ul>
              </ControlCard>
            )}
            {state.coefficients.length > 0 && (
              <ControlCard>
                <span className="control-kicker">Computed coefficients</span>
                <ul className="mt-1 list-inside list-disc" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {state.coefficients.map((c, i) => (
                    <li key={i}>
                      x^{i}: {c.toFixed(3)}
                    </li>
                  ))}
                </ul>
              </ControlCard>
            )}
            <ButtonControl
              label="Clear Points"
              onClick={() => dispatch({ type: 'CLEAR_LAGRANGE' })}
              variant="secondary"
              disabled={state.lagrangePoints.length === 0}
            />
          </ControlGroup>
        )}

        {state.mode !== 'ntt' && state.mode !== 'ipa' && state.mode !== 'batch' && (
          <>
            <ControlGroup label="Evaluate">
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    value={evalInput}
                    onChange={setEvalInput}
                    placeholder="Enter x value"
                    onSubmit={() => {
                      handleEvaluate(evalInput);
                      setEvalInput('');
                    }}
                  />
                </div>
                <ButtonControl
                  label="Eval"
                  onClick={() => {
                    handleEvaluate(evalInput);
                    setEvalInput('');
                  }}
                  disabled={evalInput === ''}
                />
              </div>
              {state.evalPoints.length > 0 && (
                <ControlCard>
                  <span className="control-kicker">Results ({state.evalPoints.length})</span>
                  <ul className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {state.evalPoints.map((pt, i) => (
                      <li key={i} style={{ color: 'var(--text-secondary)', padding: '1px 0' }}>{pt.label}</li>
                    ))}
                  </ul>
                </ControlCard>
              )}
              {state.evalPoints.length > 0 && (
                <ButtonControl
                  label="Clear Evaluations"
                  onClick={() => dispatch({ type: 'CLEAR_EVAL_POINTS' })}
                  variant="secondary"
                />
              )}
            </ControlGroup>

            <ControlGroup label="View">
              {pipelineHash && (
                <ButtonControl
                  label="Back to Pipeline"
                  onClick={() => { window.location.hash = pipelineHash; }}
                  variant="secondary"
                />
              )}
              <ButtonControl label="Auto Scale" onClick={handleAutoScale} />
            </ControlGroup>
          </>
        )}

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <SaveToGitHub demoId="polynomial" />
          <div className="control-button-grid">
            <ButtonControl label="Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Embed" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Audit JSON" onClick={handleCopyAuditSummary} variant="secondary" />
          </div>
        </ControlGroup>

        {state.mode !== 'ntt' && state.mode !== 'ipa' && state.mode !== 'batch' && (
          <ControlGroup label="KZG Commitment">
            <ButtonControl
              label="1. Commit"
              onClick={handleKzgCommit}
              disabled={state.coefficients.length === 0}
            />
            {state.kzg.commitment && (
              <ControlCard>
                <HashBadge hash={state.kzg.commitment} truncate={8} color="#3b82f6" />
              </ControlCard>
            )}

            {state.kzg.currentStep < 2 && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    value={challengeInput}
                    onChange={setChallengeInput}
                    placeholder="z (or leave blank for random)"
                    onSubmit={() => {
                      const z = challengeInput ? parseFloat(challengeInput) : undefined;
                      handleKzgChallenge(z !== undefined && !isNaN(z) ? z : undefined);
                      setChallengeInput('');
                    }}
                  />
                </div>
                <ButtonControl
                  label="2. Challenge"
                  onClick={() => {
                    const z = challengeInput ? parseFloat(challengeInput) : undefined;
                    handleKzgChallenge(z !== undefined && !isNaN(z) ? z : undefined);
                    setChallengeInput('');
                  }}
                  disabled={state.kzg.currentStep < 1}
                />
              </div>
            )}
            {state.kzg.currentStep >= 2 && (
              <ButtonControl
                label="2. Challenge"
                onClick={() => handleKzgChallenge()}
                disabled
              />
            )}
            {state.kzg.challengeZ !== null && (
              <ControlCard>
                <span className="control-kicker">Challenge point</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                z = {state.kzg.challengeZ}
                </div>
              </ControlCard>
            )}

            <ButtonControl
              label="3. Reveal & Prove"
              onClick={handleKzgReveal}
              disabled={state.kzg.currentStep < 2}
            />
            {state.kzg.revealedValue !== null && (
              <ControlCard>
                <span className="control-kicker">Opening</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  p(z) = {state.kzg.revealedValue.toFixed(4)}
                </div>
                {state.kzg.proofHash && (
                  <HashBadge hash={state.kzg.proofHash} truncate={8} color="#10b981" />
                )}
              </ControlCard>
            )}
            {state.kzg.quotientPoly && (
              <ControlCard>
                <span className="control-kicker">Quotient q(x)</span>
                <ul className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {state.kzg.quotientPoly.map((c, i) => (
                    <li key={i} style={{ color: 'var(--text-secondary)', padding: '1px 0' }}>
                      x^{i}: {Number.isInteger(c) ? c : c.toFixed(4)}
                    </li>
                  ))}
                </ul>
              </ControlCard>
            )}

            <ButtonControl
              label="4. Verify"
              onClick={handleKzgVerify}
              disabled={state.kzg.currentStep < 3}
            />
            {state.kzg.verified !== null && (
              <ControlNote tone={state.kzg.verified ? 'success' : 'error'}>
                {state.kzg.verified ? 'Proof Verified' : 'Verification Failed'}
              </ControlNote>
            )}

            <ButtonControl label="Reset KZG" onClick={() => dispatch({ type: 'KZG_RESET' })} variant="secondary" />
            <ControlNote>
              Schwartz-Zippel intuition: two distinct degree-d polynomials can agree on at most d points.
            </ControlNote>
          </ControlGroup>
        )}

        <ButtonControl label="Reset to Defaults" onClick={() => handleResetToDefaults(true)} variant="secondary" />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:polynomial" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="KZG Commitments"
      />
    </DemoLayout>
  );
}
