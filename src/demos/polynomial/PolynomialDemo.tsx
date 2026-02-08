import { useReducer, useCallback, useState, useRef, useEffect } from 'react';
import type { PolynomialState, EvalPoint } from '@/types/polynomial';
import { AnimatedCanvas } from '@/components/shared/AnimatedCanvas';
import {
  ControlGroup,
  SliderControl,
  ToggleControl,
  ButtonControl,
  TextInput,
} from '@/components/shared/Controls';
import { HashBadge } from '@/components/shared/HashBadge';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
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

// Action types
type PolynomialAction =
  | { type: 'SET_COEFFICIENTS'; coefficients: number[] }
  | { type: 'SET_COEFF'; index: number; value: number }
  | { type: 'SET_MODE'; mode: 'coefficients' | 'lagrange' }
  | { type: 'ADD_LAGRANGE_POINT'; x: number; y: number }
  | { type: 'CLEAR_LAGRANGE' }
  | { type: 'ADD_EVAL_POINT'; point: EvalPoint }
  | { type: 'KZG_COMMIT'; commitment: string }
  | { type: 'KZG_CHALLENGE'; challengeZ: number }
  | { type: 'KZG_REVEAL'; revealedValue: number; quotientPoly: number[]; proofHash: string }
  | { type: 'KZG_VERIFY'; verified: boolean }
  | { type: 'KZG_RESET' }
  | { type: 'SET_VIEW_RANGE'; viewRange: { xMin: number; xMax: number; yMin: number; yMax: number } }
  | { type: 'ADD_TERM' }
  | { type: 'REMOVE_TERM' }
  | { type: 'TOGGLE_COMPARE' }
  | { type: 'SET_COMPARE_COEFFS'; coefficients: number[] };

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
        evalPoints: [...state.evalPoints, action.point],
      };

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

  const interaction = useCanvasInteraction(handleCanvasClick);
  const [evalInput, setEvalInput] = useState('');

  // Draw function
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: { time: number; delta: number; frameCount: number; width: number; height: number }) => {
      canvasSizeRef.current = { width: frame.width, height: frame.height };
      const { hovered } = renderPolynomial(ctx, frame, state, interaction.mouseX, interaction.mouseY, theme);

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
    [state, interaction.mouseX, interaction.mouseY, theme]
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

  const handleKzgChallenge = useCallback(() => {
    const challengeZ = simulateKzgChallenge();
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
  });

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('p');
    url.hash = `polynomial|${encodeStatePlain(buildShareState())}`;
    navigator.clipboard.writeText(url.toString());
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'polynomial');
    url.searchParams.set('p', encodeState(buildShareState()));
    const iframe = `<iframe src="${url.toString()}" width="100%" height="620" style="border:0;border-radius:16px;"></iframe>`;
    navigator.clipboard.writeText(iframe);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-polynomial.png';
    a.click();
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
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
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
    }>(rawHash);

    const raw = decodedHash ? null : getSearchParam('p');
    const decoded = decodeState<{
      mode?: 'coefficients' | 'lagrange';
      coefficients?: number[];
      compareEnabled?: boolean;
      compareCoefficients?: number[];
    }>(raw);

    const payload = decodedHash ?? decoded;
    if (!payload) return;
    if (payload.mode) {
      dispatch({ type: 'SET_MODE', mode: payload.mode });
    }
    if (payload.coefficients && payload.coefficients.length > 0) {
      dispatch({ type: 'SET_COEFFICIENTS', coefficients: payload.coefficients });
    }
    if (payload.compareEnabled) {
      dispatch({ type: 'TOGGLE_COMPARE' });
      if (payload.compareCoefficients && payload.compareCoefficients.length > 0) {
        dispatch({ type: 'SET_COMPARE_COEFFS', coefficients: payload.compareCoefficients });
      }
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
    };
    setSearchParams({ p: encodeState(payload) });
  }, [state.mode, state.coefficients, state.compareEnabled, state.compareCoefficients]);

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
    <div className="flex h-full">
      {/* Controls */}
      <div className="w-72 shrink-0 overflow-y-auto p-5 border-r panel-surface" style={{ borderColor: 'var(--border)' }}>
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
                />
              ))}
              <div className="flex gap-2">
                <ButtonControl label="Add Term" onClick={() => dispatch({ type: 'ADD_TERM' })} />
                <ButtonControl
                  label="Remove Term"
                  onClick={() => dispatch({ type: 'REMOVE_TERM' })}
                  disabled={state.coefficients.length <= 1}
                />
              </div>
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
                <div className="space-y-2">
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
                    />
                  ))}
                </div>
              )}
              {state.compareEnabled && (
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  The intersection count hints at the Schwartz‑Zippel bound.
                </div>
              )}
            </ControlGroup>
          </>
        ) : (
          <ControlGroup label="Lagrange Points">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Click on the canvas to place points. The polynomial will interpolate through all
              points.
            </p>
            <ButtonControl
              label="Clear Points"
              onClick={() => dispatch({ type: 'CLEAR_LAGRANGE' })}
            />
            {state.coefficients.length > 0 && (
              <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <p>Computed coefficients:</p>
                <ul className="mt-1 list-inside list-disc">
                  {state.coefficients.map((c, i) => (
                    <li key={i}>
                      x^{i}: {c.toFixed(3)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ControlGroup>
        )}

        <ControlGroup label="Evaluate">
          <TextInput
            value={evalInput}
            onChange={setEvalInput}
            placeholder="Enter x value"
            onSubmit={() => {
              handleEvaluate(evalInput);
              setEvalInput('');
            }}
          />
        </ControlGroup>

        <ControlGroup label="View">
          <ButtonControl label="Auto Scale" onClick={handleAutoScale} />
        </ControlGroup>

        <ControlGroup label="Share">
          <div className="space-y-2">
            <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
            <ButtonControl label="Copy Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Copy Embed Iframe" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Copy Audit Summary" onClick={handleCopyAuditSummary} variant="secondary" />
          </div>
        </ControlGroup>

          <ControlGroup label="KZG Commitment">
            <div className="space-y-3">
            <ButtonControl
              label="1. Commit"
              onClick={handleKzgCommit}
              disabled={state.coefficients.length === 0}
            />
            {state.kzg.commitment && (
              <div className="rounded bg-blue-500/10 p-2">
                <HashBadge hash={state.kzg.commitment} truncate={8} color="#3b82f6" />
              </div>
            )}

            <ButtonControl
              label="2. Challenge"
              onClick={handleKzgChallenge}
              disabled={state.kzg.currentStep < 1}
            />
            {state.kzg.challengeZ !== null && (
              <p className="text-sm" style={{ color: '#f59e0b' }}>
                z = {state.kzg.challengeZ.toFixed(2)}
              </p>
            )}

            <ButtonControl
              label="3. Reveal & Prove"
              onClick={handleKzgReveal}
              disabled={state.kzg.currentStep < 2}
            />
            {state.kzg.revealedValue !== null && (
              <div className="space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <p>p(z) = {state.kzg.revealedValue.toFixed(4)}</p>
                {state.kzg.proofHash && (
                  <HashBadge hash={state.kzg.proofHash} truncate={8} color="#10b981" />
                )}
              </div>
            )}

            <ButtonControl
              label="4. Verify"
              onClick={handleKzgVerify}
              disabled={state.kzg.currentStep < 3}
            />
            {state.kzg.verified !== null && (
              <p
                className="text-sm font-bold"
                style={{
                  color: state.kzg.verified
                    ? 'var(--status-success)'
                    : 'var(--status-error)',
                }}
              >
                {state.kzg.verified ? '✓ Proof Verified' : '✗ Verification Failed'}
              </p>
            )}

            <ButtonControl label="Reset" onClick={() => dispatch({ type: 'KZG_RESET' })} />
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Schwartz-Zippel intuition: two distinct degree‑d polynomials can agree on at most d points.
            </div>
          </div>
        </ControlGroup>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <AnimatedCanvas draw={draw} onCanvas={(c) => (canvasElRef.current = c)} {...interaction.handlers} />
      </div>
    </div>
  );
}
