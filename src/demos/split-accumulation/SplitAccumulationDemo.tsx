import { useReducer, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea, DemoAside } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  SliderControl,
  ButtonControl,
  ControlCard,
  ControlNote,
  ToggleControl,
} from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { exportCanvasPng } from '@/lib/canvas';
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
import {
  generateClaims,
  buildNaiveSteps,
  buildAccumulatedSteps,
  settleAccumulator,
  getNaiveTotalCost,
  getAccumulatedTotalCost,
  getSavingsRatio,
  type NaiveStep,
  type AccumulatedStep,
  type Settlement,
} from './logic';
import { renderSplitAccumulation, getSplitAccBounds } from './renderer';

// ── State ──────────────────────────────────────────────────────────

interface SplitAccState {
  numSteps: number;
  msmBaseCost: number;
  currentStep: number;
  naiveSteps: NaiveStep[];
  accumulatedSteps: AccumulatedStep[];
  settlement: Settlement | null;
  autoPlaying: boolean;
  speed: number;
  showCostComparison: boolean;
}

type Action =
  | { type: 'SET_NUM_STEPS'; numSteps: number }
  | { type: 'SET_MSM_BASE_COST'; cost: number }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACK' }
  | { type: 'SETTLE' }
  | { type: 'SET_AUTO'; autoPlaying: boolean }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'TOGGLE_COST_COMPARISON' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; numSteps: number; currentStep: number; msmBaseCost: number; showCostComparison: boolean; settled: boolean };

function buildSteps(numSteps: number, msmBaseCost: number) {
  const claims = generateClaims(numSteps);
  return {
    naiveSteps: buildNaiveSteps(claims, msmBaseCost),
    accumulatedSteps: buildAccumulatedSteps(claims, msmBaseCost),
  };
}

function createInitial(numSteps: number, msmBaseCost: number): SplitAccState {
  const { naiveSteps, accumulatedSteps } = buildSteps(numSteps, msmBaseCost);
  return {
    numSteps,
    msmBaseCost,
    currentStep: -1,
    naiveSteps,
    accumulatedSteps,
    settlement: null,
    autoPlaying: false,
    speed: 2,
    showCostComparison: true,
  };
}

function reducer(state: SplitAccState, action: Action): SplitAccState {
  switch (action.type) {
    case 'SET_NUM_STEPS': {
      const n = action.numSteps;
      const { naiveSteps, accumulatedSteps } = buildSteps(n, state.msmBaseCost);
      return { ...state, numSteps: n, naiveSteps, accumulatedSteps, currentStep: -1, settlement: null, autoPlaying: false };
    }
    case 'SET_MSM_BASE_COST': {
      const { naiveSteps, accumulatedSteps } = buildSteps(state.numSteps, action.cost);
      return { ...state, msmBaseCost: action.cost, naiveSteps, accumulatedSteps, currentStep: -1, settlement: null, autoPlaying: false };
    }
    case 'STEP_FORWARD': {
      if (state.currentStep >= state.numSteps - 1) return state;
      const next = state.currentStep + 1;
      // Update statuses
      const naive = state.naiveSteps.map((s, i) => ({
        ...s,
        status: (i < next ? 'verified' : i === next ? 'computing' : 'pending') as NaiveStep['status'],
      }));
      const acc = state.accumulatedSteps.map((s, i) => ({
        ...s,
        status: (i < next ? 'folded' : i === next ? 'folding' : 'pending') as AccumulatedStep['status'],
      }));
      return { ...state, currentStep: next, naiveSteps: naive, accumulatedSteps: acc, settlement: null };
    }
    case 'STEP_BACK': {
      if (state.currentStep < 0) return state;
      const prev = state.currentStep - 1;
      const naive = state.naiveSteps.map((s, i) => ({
        ...s,
        status: (i < prev ? 'verified' : i === prev ? 'computing' : 'pending') as NaiveStep['status'],
      }));
      const acc = state.accumulatedSteps.map((s, i) => ({
        ...s,
        status: (i < prev ? 'folded' : i === prev ? 'folding' : 'pending') as AccumulatedStep['status'],
      }));
      return { ...state, currentStep: prev, naiveSteps: naive, accumulatedSteps: acc, settlement: null, autoPlaying: false };
    }
    case 'SETTLE': {
      if (state.currentStep < state.numSteps - 1) return state;
      return { ...state, settlement: settleAccumulator(state.msmBaseCost, state.numSteps), autoPlaying: false };
    }
    case 'SET_AUTO':
      return { ...state, autoPlaying: action.autoPlaying };
    case 'SET_SPEED':
      return { ...state, speed: action.speed };
    case 'TOGGLE_COST_COMPARISON':
      return { ...state, showCostComparison: !state.showCostComparison };
    case 'RESET': {
      const { naiveSteps, accumulatedSteps } = buildSteps(state.numSteps, state.msmBaseCost);
      return { ...state, currentStep: -1, naiveSteps, accumulatedSteps, settlement: null, autoPlaying: false };
    }
    case 'RESTORE': {
      const { naiveSteps, accumulatedSteps } = buildSteps(action.numSteps, action.msmBaseCost);
      const step = Math.max(-1, Math.min(action.currentStep, action.numSteps - 1));
      const naive = naiveSteps.map((s, i) => ({
        ...s,
        status: (i < step ? 'verified' : i === step ? 'computing' : 'pending') as NaiveStep['status'],
      }));
      const acc = accumulatedSteps.map((s, i) => ({
        ...s,
        status: (i < step ? 'folded' : i === step ? 'folding' : 'pending') as AccumulatedStep['status'],
      }));
      const settlement = action.settled && step >= action.numSteps - 1
        ? settleAccumulator(action.msmBaseCost, action.numSteps)
        : null;
      return {
        numSteps: action.numSteps,
        msmBaseCost: action.msmBaseCost,
        currentStep: step,
        naiveSteps: naive,
        accumulatedSteps: acc,
        settlement,
        autoPlaying: false,
        speed: 2,
        showCostComparison: action.showCostComparison,
      };
    }
    default:
      return state;
  }
}

// ── URL serialization ──────────────────────────────────────────────

interface UrlState {
  numSteps: number;
  currentStep: number;
  msmBaseCost: number;
  showCostComparison: boolean;
  settled?: boolean;
}

function serializeState(state: SplitAccState): UrlState {
  return {
    numSteps: state.numSteps,
    currentStep: state.currentStep,
    msmBaseCost: state.msmBaseCost,
    showCostComparison: state.showCostComparison,
    settled: state.settlement !== null,
  };
}

// ── Component ──────────────────────────────────────────────────────

export function SplitAccumulationDemo() {
  const [state, dispatch] = useReducer(reducer, null, () => createInitial(6, 200));
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = useMemo(() => mergeCanvasHandlers(interaction, camera), [interaction, camera]);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDark = theme === 'dark';

  // -- Restore from URL --
  useEffect(() => {
    const hashState = getHashState();
    const raw = hashState?.demo === 'split-accumulation' ? decodeStatePlain<UrlState>(hashState.state) : null;
    const fromSearch = raw ?? decodeState<UrlState>(getSearchParam('sa'));
    if (fromSearch && typeof fromSearch.numSteps === 'number') {
      dispatch({
        type: 'RESTORE',
        numSteps: fromSearch.numSteps,
        currentStep: fromSearch.currentStep ?? -1,
        msmBaseCost: fromSearch.msmBaseCost ?? 200,
        showCostComparison: fromSearch.showCostComparison ?? true,
        settled: fromSearch.settled ?? false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Sync to URL --
  useEffect(() => {
    setSearchParams({ sa: encodeState(serializeState(state)) });
  }, [state.numSteps, state.currentStep, state.msmBaseCost, state.showCostComparison, state.settlement]);

  // -- Info panel context --
  useEffect(() => {
    const step = state.currentStep;
    const naiveCost = getNaiveTotalCost(state.naiveSteps, step);
    const accCost = getAccumulatedTotalCost(state.accumulatedSteps, step, state.settlement);
    const ratio = getSavingsRatio(naiveCost, accCost);

    setEntry('split-accumulation', {
      title: 'Split Accumulation',
      body: 'Compares naive recursion (full MSM per step) vs split accumulation (cheap folds + one final MSM).',
      glossary: [
        { term: 'MSM', definition: `Multi-scalar multiplication: ${state.msmBaseCost} gates per invocation.` },
        { term: 'Fold', definition: `Random linear combination: ~10 field ops per step.` },
        { term: 'Savings', definition: step >= 0 ? `${ratio.toFixed(1)}x at step ${step + 1}` : 'Step forward to see' },
      ],
    });
  }, [state, setEntry]);

  // -- Auto-play --
  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!state.autoPlaying) return;

    const delay = [1200, 800, 500, 300, 150][state.speed - 1] ?? 500;
    autoTimerRef.current = setInterval(() => {
      dispatch({ type: 'STEP_FORWARD' });
    }, delay);

    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [state.autoPlaying, state.speed]);

  // Stop auto when we reach the end
  useEffect(() => {
    if (state.autoPlaying && state.currentStep >= state.numSteps - 1) {
      if (!state.settlement) {
        dispatch({ type: 'SETTLE' });
      }
      dispatch({ type: 'SET_AUTO', autoPlaying: false });
    }
  }, [state.currentStep, state.numSteps, state.autoPlaying, state.settlement]);

  // -- Fit to view --
  const fitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const bounds = getSplitAccBounds(canvas.getBoundingClientRect().width, state.numSteps, state.settlement, state.showCostComparison);
    fitCameraToBounds(camera, canvas, bounds, { paddingRatio: 0.08, durationMs: options?.instant ? 0 : undefined });
  }, [camera, state.numSteps, state.settlement, state.showCostComparison]);

  // Fit on mount
  useEffect(() => { fitToView(); }, [fitToView]);

  // -- Draw --
  const handleDraw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderSplitAccumulation(
      ctx, frame,
      state.naiveSteps,
      state.accumulatedSteps,
      state.currentStep,
      state.settlement,
      state.msmBaseCost,
      state.showCostComparison,
      isDark
    );
  }, [state, isDark]);

  // -- Share helpers --
  const shareState = useMemo(() => serializeState(state), [state]);

  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the current recursion trace');
  }, []);

  const handleCopyHash = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('sa');
    url.hash = `split-accumulation|${encodeStatePlain(shareState)}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State lives entirely in the fragment');
  }, [shareState]);

  const handleOpenEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'split-accumulation');
    url.searchParams.set('sa', encodeState(shareState));
    url.hash = '';
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [shareState]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, fitToView, 'theora-split-accumulation.png', showDownloadToast);
  }, [camera, fitToView]);

  const handleExportJson = useCallback(() => {
    copyToClipboard(JSON.stringify({ version: 1, demo: 'split-accumulation', state: shareState }, null, 2));
    showToast('Audit JSON copied');
  }, [shareState]);

  // -- Embed handlers --
  const handleEmbedPlay = useCallback(() => {
    if (state.autoPlaying) {
      dispatch({ type: 'SET_AUTO', autoPlaying: false });
    } else if (state.currentStep >= state.numSteps - 1) {
      dispatch({ type: 'RESET' });
      setTimeout(() => dispatch({ type: 'SET_AUTO', autoPlaying: true }), 100);
    } else {
      dispatch({ type: 'SET_AUTO', autoPlaying: true });
    }
  }, [state.autoPlaying, state.currentStep, state.numSteps]);

  const handleEmbedReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // -- Costs for display --
  const naiveCost = getNaiveTotalCost(state.naiveSteps, state.currentStep);
  const accCost = getAccumulatedTotalCost(state.accumulatedSteps, state.currentStep, state.settlement);
  const ratio = getSavingsRatio(naiveCost, accCost);
  const allStepped = state.currentStep >= state.numSteps - 1;
  const canSettle = allStepped && !state.settlement;
  const currentNaiveStep = state.currentStep >= 0 ? state.naiveSteps[state.currentStep] ?? null : null;
  const currentAccumulatedStep = state.currentStep >= 0 ? state.accumulatedSteps[state.currentStep] ?? null : null;

  return (
    <DemoLayout
      onEmbedPlay={handleEmbedPlay}
      embedPlaying={state.autoPlaying}
      onEmbedReset={handleEmbedReset}
      onEmbedFitToView={fitToView}
    >
      <DemoSidebar width="compact">
        <ControlGroup label="Configuration">
          <SliderControl
            label="Recursive steps"
            min={3} max={8} step={1}
            value={state.numSteps}
            onChange={(v) => dispatch({ type: 'SET_NUM_STEPS', numSteps: v })}
          />
          <SliderControl
            label="MSM base cost (gates)"
            min={50} max={500} step={10}
            value={state.msmBaseCost}
            onChange={(v) => dispatch({ type: 'SET_MSM_BASE_COST', cost: v })}
          />
        </ControlGroup>

        <ControlGroup label="Stepping">
          <ControlCard>
            <div className="control-kicker">Progress</div>
            <div className="control-value" style={{ fontSize: 18 }}>
              {state.currentStep < 0 ? 'Ready' : `Step ${state.currentStep + 1} / ${state.numSteps}`}
            </div>
            {state.settlement && (
              <div className="control-caption" style={{ color: 'var(--status-success)' }}>Settled</div>
            )}
          </ControlCard>
          <div className="control-button-row">
            <ButtonControl
              label="Back"
              onClick={() => dispatch({ type: 'STEP_BACK' })}
              disabled={state.currentStep < 0}
            />
            <ButtonControl
              label="Next"
              onClick={() => dispatch({ type: 'STEP_FORWARD' })}
              disabled={allStepped}
            />
          </div>
          <div className="control-button-row">
            <ButtonControl
              label={state.autoPlaying ? 'Pause' : 'Auto-play'}
              onClick={() => dispatch({ type: 'SET_AUTO', autoPlaying: !state.autoPlaying })}
              disabled={allStepped && !state.autoPlaying}
            />
            <ButtonControl
              label="Replay"
              onClick={() => dispatch({ type: 'RESET' })}
            />
          </div>
          <SliderControl
            label="Speed"
            min={1} max={5} step={1}
            value={state.speed}
            onChange={(v) => dispatch({ type: 'SET_SPEED', speed: v })}
          />
          {canSettle && (
            <ButtonControl
              label="Settle Accumulator (final MSM)"
              onClick={() => dispatch({ type: 'SETTLE' })}
            />
          )}
        </ControlGroup>

        <ControlGroup label="Display">
          <ToggleControl
            label="Cost comparison"
            checked={state.showCostComparison}
            onChange={() => dispatch({ type: 'TOGGLE_COST_COMPARISON' })}
          />
        </ControlGroup>

        <ShareSaveDropdown
          demoId="split-accumulation"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHash}
          onCopyEmbed={handleOpenEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleExportJson}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={handleDraw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
        />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:split-accumulation" onReset={fitToView} />
      </DemoCanvasArea>

      <DemoAside width="narrow">
        <ControlGroup label="Cost Analysis">
          {currentNaiveStep && (
            <ControlCard>
              <div className="control-kicker">Current naive circuit</div>
              <div className="control-value" style={{ color: '#ef4444', fontSize: 20 }}>
                {currentNaiveStep.circuitCost} gates
              </div>
              <div className="control-caption">
                {currentNaiveStep.embeddedVerifierCount} MSM-heavy verifier layer{currentNaiveStep.embeddedVerifierCount === 1 ? '' : 's'}
              </div>
            </ControlCard>
          )}
          <ControlCard>
            <div className="control-kicker">Naive total</div>
            <div className="control-value" style={{ color: '#ef4444' }}>
              {state.currentStep >= 0 ? `${naiveCost} gates` : '\u2014'}
            </div>
            <div className="control-caption">
              {state.currentStep >= 0 ? `${state.currentStep + 1} recursive verifier step${state.currentStep === 0 ? '' : 's'}` : 'Step to compute'}
            </div>
          </ControlCard>
          {currentAccumulatedStep && (
            <ControlCard>
              <div className="control-kicker">Running accumulator</div>
              <div className="control-value" style={{ color: '#22c55e', fontSize: 20 }}>
                {currentAccumulatedStep.accumulator.foldedCount} folded
              </div>
              <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                r = 0x{currentAccumulatedStep.challenge.slice(0, 8)}
              </div>
            </ControlCard>
          )}
          <ControlCard>
            <div className="control-kicker">Accumulated total</div>
            <div className="control-value" style={{ color: '#22c55e' }}>
              {state.currentStep >= 0 ? `${accCost} gates` : '\u2014'}
            </div>
            <div className="control-caption">
              {state.currentStep >= 0
                ? state.settlement
                  ? `${state.currentStep + 1} folds + 1 MSM`
                  : `${state.currentStep + 1} folds (MSM deferred)`
                : 'Step to compute'}
            </div>
          </ControlCard>
          {state.currentStep >= 0 && accCost > 0 && (
            <ControlCard>
              <div className="control-kicker">Savings</div>
              <div className="control-value" style={{ color: '#a78bfa', fontSize: 20 }}>
                {ratio.toFixed(1)}x
              </div>
              <div className="control-caption">cheaper with accumulation</div>
            </ControlCard>
          )}
        </ControlGroup>

        <ControlNote>
          Naive recursion keeps dragging MSM-heavy verification logic forward, so later recursive circuits get bigger and bigger.
          Split accumulation keeps each fold cheap, grows only the accumulator state, and pays for a single MSM at the end.
          That is the core trick behind Halo-style recursion without pairings.
        </ControlNote>
      </DemoAside>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Split Accumulation"
      />
    </DemoLayout>
  );
}
