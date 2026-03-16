import { useReducer, useCallback, useState, useRef, useEffect } from 'react';
import type { PolynomialState, EvalPoint } from '@/types/polynomial';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  SliderControl,
  ToggleControl,
  ButtonControl,
  TextInput,
  ControlCard,
  ControlNote,
} from '@/components/shared/Controls';
import { HashBadge } from '@/components/shared/HashBadge';
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
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { EmbedModal } from '@/components/shared/EmbedModal';

// Action types
type PolynomialAction =
  | { type: 'SET_COEFFICIENTS'; coefficients: number[] }
  | { type: 'SET_COEFF'; index: number; value: number }
  | { type: 'SET_MODE'; mode: 'coefficients' | 'lagrange' }
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
  | { type: 'SET_EVAL_POINTS'; points: EvalPoint[] };

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
        lagrangePoints: [],
        coefficients: action.mode === 'coefficients' ? state.coefficients : [],
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
        kzg: action.kzg,
      };

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

  // Draw function
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      canvasSizeRef.current = { width: frame.width, height: frame.height };
      const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
      const { hovered } = renderPolynomial(ctx, frame, state, worldMouse.x, worldMouse.y, theme);

      let nextHover: { key: string; title: string; body: string } | null = null;
      if (hovered?.type === 'eval') {
        nextHover = {
          key: `eval-${hovered.x}-${hovered.y}`,
          title: 'Evaluation point',
          body: `${hovered.label}`,
        };
      } else if (hovered?.type === 'lagrange') {
        nextHover = {
          key: `lagrange-${hovered.x}-${hovered.y}`,
          title: 'Interpolation point',
          body: `Point (${hovered.x.toFixed(2)}, ${hovered.y.toFixed(2)}) constrains the polynomial.`,
        };
      } else if (hovered?.type === 'challenge') {
        nextHover = {
          key: `challenge-${hovered.z}`,
          title: 'KZG challenge z',
          body: `Verifier’s random evaluation point used to open the commitment.`,
        };
      }

      if (nextHover?.key !== hoverKeyRef.current) {
        hoverKeyRef.current = nextHover?.key ?? null;
        setHoverInfo(nextHover);
      }
    },
    [state, interaction.mouseX, interaction.mouseY, camera, theme]
  );

  // Handlers
  const handleModeToggle = useCallback((checked: boolean) => {
    dispatch({ type: 'SET_MODE', mode: checked ? 'lagrange' : 'coefficients' });
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

  const buildShareState = () => ({
    mode: state.mode,
    coefficients: state.coefficients,
    compareEnabled: state.compareEnabled,
    compareCoefficients: state.compareCoefficients,
    kzg: state.kzg.currentStep > 0 ? state.kzg : undefined,
    evalPoints: state.evalPoints.length > 0 ? state.evalPoints : undefined,
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
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-polynomial.png';
    a.click();
    showDownloadToast('theora-polynomial.png');
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
      mode?: 'coefficients' | 'lagrange';
      coefficients?: number[];
      compareEnabled?: boolean;
      compareCoefficients?: number[];
      kzg?: PolynomialState['kzg'];
      evalPoints?: EvalPoint[];
      pipelineHash?: string;
    }>(rawHash);

    const raw = decodedHash ? null : getSearchParam('p');
    const decoded = decodeState<{
      mode?: 'coefficients' | 'lagrange';
      coefficients?: number[];
      compareEnabled?: boolean;
      compareCoefficients?: number[];
      kzg?: PolynomialState['kzg'];
      evalPoints?: EvalPoint[];
      pipelineHash?: string;
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
    };
    setSearchParams({ p: encodeState(payload) });
  }, [state.mode, state.coefficients, state.compareEnabled, state.compareCoefficients, state.kzg, state.evalPoints]);

  useEffect(() => {
    if (hoverInfo) {
      setEntry('polynomial', {
        title: hoverInfo.title,
        body: hoverInfo.body,
        nextSteps: ['Add more points or evaluate another x', 'Continue the KZG flow below'],
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
  }, [hoverInfo, state.mode, state.lagrangePoints.length, state.kzg.currentStep, state.kzg.verified, setEntry]);

  return (
    <DemoLayout>
      <DemoSidebar width="compact">
        <ControlGroup label="Polynomial Mode">
          <ToggleControl
            label="Lagrange Interpolation"
            checked={state.mode === 'lagrange'}
            onChange={handleModeToggle}
          />
        </ControlGroup>

        {state.mode === 'coefficients' ? (
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
                label="− Remove Term"
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
                  The intersection count hints at the Schwartz‑Zippel bound.
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
                    <li key={i}>({pt.x}, {pt.y})</li>
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

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <div className="control-button-grid">
            <ButtonControl label="Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Embed" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Audit JSON" onClick={handleCopyAuditSummary} variant="secondary" />
          </div>
        </ControlGroup>

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
                {state.kzg.verified ? '✓ Proof Verified' : '✗ Verification Failed'}
              </ControlNote>
            )}

            <ButtonControl label="Reset" onClick={() => dispatch({ type: 'KZG_RESET' })} />
            <ControlNote>
              Schwartz-Zippel intuition: two distinct degree‑d polynomials can agree on at most d points.
            </ControlNote>
        </ControlGroup>
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:polynomial" />
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
