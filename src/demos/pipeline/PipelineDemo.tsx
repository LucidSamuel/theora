import { useReducer, useCallback, useRef } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  SliderControl,
  ButtonControl,
  SelectControl,
  ControlCard,
  ControlNote,
} from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import {
  STAGES,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  FAULT_LABELS,
  runPipeline,
  type PipelineStage,
  type FaultType,
  type PipelineResults,
} from './logic';
import { renderPipeline } from './renderer';

// ── State ──────────────────────────────────────────────────────────

interface PipelineState {
  secretX: number;
  activeStageIdx: number;
  fault: FaultType;
  results: PipelineResults;
  autoPlaying: boolean;
  speed: number;
}

type Action =
  | { type: 'SET_X'; x: number }
  | { type: 'SET_FAULT'; fault: FaultType }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_TO'; stageIdx: number }
  | { type: 'SET_AUTO'; autoPlaying: boolean }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'RESET' };

function recompute(x: number, stageIdx: number, fault: FaultType): PipelineResults {
  const stage = STAGES[stageIdx]!;
  return runPipeline(x, stage, fault);
}

const initialState: PipelineState = {
  secretX: 3,
  activeStageIdx: 0,
  fault: 'none',
  results: recompute(3, 0, 'none'),
  autoPlaying: false,
  speed: 2,
};

function reducer(state: PipelineState, action: Action): PipelineState {
  switch (action.type) {
    case 'SET_X': {
      const x = action.x;
      return {
        ...state,
        secretX: x,
        activeStageIdx: 0,
        results: recompute(x, 0, state.fault),
        autoPlaying: false,
      };
    }
    case 'SET_FAULT': {
      return {
        ...state,
        fault: action.fault,
        activeStageIdx: 0,
        results: recompute(state.secretX, 0, action.fault),
        autoPlaying: false,
      };
    }
    case 'STEP_FORWARD': {
      const nextIdx = Math.min(state.activeStageIdx + 1, STAGES.length - 1);
      return {
        ...state,
        activeStageIdx: nextIdx,
        results: recompute(state.secretX, nextIdx, state.fault),
        autoPlaying: nextIdx < STAGES.length - 1 ? state.autoPlaying : false,
      };
    }
    case 'STEP_BACK': {
      const prevIdx = Math.max(state.activeStageIdx - 1, 0);
      return {
        ...state,
        activeStageIdx: prevIdx,
        results: recompute(state.secretX, prevIdx, state.fault),
        autoPlaying: false,
      };
    }
    case 'JUMP_TO': {
      const idx = Math.max(0, Math.min(action.stageIdx, STAGES.length - 1));
      return {
        ...state,
        activeStageIdx: idx,
        results: recompute(state.secretX, idx, state.fault),
        autoPlaying: false,
      };
    }
    case 'SET_AUTO':
      return { ...state, autoPlaying: action.autoPlaying };
    case 'SET_SPEED':
      return { ...state, speed: action.speed };
    case 'RESET':
      return initialState;
  }
}

// ── Component ──────────────────────────────────────────────────────

export function PipelineDemo() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { theme } = useTheme();
  const interaction = useCanvasInteraction();
  const camera = useCanvasCamera();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const { setEntry } = useInfoPanel();

  const activeStage = STAGES[state.activeStageIdx]!;

  // Auto-play timer
  const lastAutoStepRef = useRef(0);
  const autoPlayingRef = useRef(state.autoPlaying);
  autoPlayingRef.current = state.autoPlaying;
  const speedRef = useRef(state.speed);
  speedRef.current = state.speed;

  // Update info panel
  const updateInfoPanel = useCallback((stage: PipelineStage) => {
    const stageIdx = STAGES.indexOf(stage);
    const glossary = [
      { term: 'Witness', definition: 'The full assignment of values to all circuit wires.' },
      { term: 'R1CS', definition: 'Rank-1 Constraint System: quadratic constraints over wire values.' },
      { term: 'Commitment', definition: 'A binding handle that hides the polynomial but locks its value.' },
      { term: 'Fiat-Shamir', definition: 'Deriving verifier randomness by hashing the transcript.' },
      { term: 'Quotient', definition: 'q(x) proving that (x−z) divides (p(x)−p(z)).' },
    ];

    const nextSteps = stageIdx < STAGES.length - 1
      ? [`Step to ${STAGE_LABELS[STAGES[stageIdx + 1]!]}`, 'Try injecting a fault', 'Change the secret input']
      : ['Inject a fault and re-run', 'Change x to see different proofs', 'Compare honest vs. broken runs'];

    setEntry('pipeline', {
      title: `Stage ${stageIdx + 1}: ${STAGE_LABELS[stage]}`,
      body: STAGE_DESCRIPTIONS[stage],
      glossary,
      nextSteps,
    });
  }, [setEntry]);

  // Draw callback
  const handleDraw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      const isDark = theme === 'dark';

      // Auto-play
      if (autoPlayingRef.current) {
        const interval = (6 - speedRef.current) * 0.5; // speed 1=2.5s, speed 5=0.5s
        if (frame.time - lastAutoStepRef.current > interval) {
          lastAutoStepRef.current = frame.time;
          dispatch({ type: 'STEP_FORWARD' });
        }
      }

      renderPipeline(ctx, frame, activeStage, state.results, state.fault, isDark);
    },
    [theme, activeStage, state.results, state.fault]
  );

  // Update info panel on stage change
  const prevStageRef = useRef(activeStage);
  if (prevStageRef.current !== activeStage) {
    prevStageRef.current = activeStage;
    updateInfoPanel(activeStage);
  }

  const faultOptions = Object.entries(FAULT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <DemoLayout>
      <DemoSidebar>

        <ControlGroup label="Computation">
          <ControlCard>
            <span className="control-kicker">Circuit relation</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
              f(x) = x² + x + 5
            </div>
            <div className="control-caption">The pipeline encodes this computation, commits to it, then verifies the opening.</div>
          </ControlCard>
          <SliderControl
            label="Secret witness x"
            value={state.secretX}
            min={1}
            max={20}
            step={1}
            onChange={(v) => dispatch({ type: 'SET_X', x: v })}
          />
          {state.results.witness && (
            <ControlCard>
              <span className="control-kicker">Public output</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                y = {state.results.witness.y}
              </div>
            </ControlCard>
          )}
        </ControlGroup>

        <ControlGroup label="Pipeline">
          <ControlCard>
            <span className="control-kicker">Current stage</span>
            <div className="control-value">
              Stage {state.activeStageIdx + 1}/{STAGES.length}: {STAGE_LABELS[activeStage]}
            </div>
            <div className="control-caption">{STAGE_DESCRIPTIONS[activeStage]}</div>
          </ControlCard>
          <div className="control-button-row">
            <ButtonControl
              label="◀ Back"
              onClick={() => dispatch({ type: 'STEP_BACK' })}
              disabled={state.activeStageIdx === 0}
              variant="secondary"
            />
            <ButtonControl
              label="Next ▶"
              onClick={() => dispatch({ type: 'STEP_FORWARD' })}
              disabled={state.activeStageIdx === STAGES.length - 1}
            />
          </div>
          <ButtonControl
            label={state.autoPlaying ? '⏸ Pause' : '▶ Auto-play'}
            onClick={() => dispatch({ type: 'SET_AUTO', autoPlaying: !state.autoPlaying })}
            variant="secondary"
          />
          <SliderControl
            label="Speed"
            value={state.speed}
            min={1}
            max={5}
            step={1}
            onChange={(v) => dispatch({ type: 'SET_SPEED', speed: v })}
          />
        </ControlGroup>

        <ControlGroup label="Fault Injection">
          <SelectControl
            label="Inject fault"
            value={state.fault}
            options={faultOptions}
            onChange={(v) => dispatch({ type: 'SET_FAULT', fault: v as FaultType })}
          />
          {state.fault !== 'none' && (
            <ControlNote tone="error">
              Fault active — step through to see where verification breaks
            </ControlNote>
          )}
        </ControlGroup>

        <ControlGroup label="Stage Map">
          <div className="control-choice-list">
            {STAGES.map((stage, i) => {
              const isCurrent = i === state.activeStageIdx;
              const isComplete = i < state.activeStageIdx;
              const hasError =
                (stage === 'constraints' && state.results.constraints && !state.results.constraints.allSatisfied) ||
                (stage === 'verify' && state.results.verify && !state.results.verify.passed);

              return (
                <button
                  key={stage}
                  className={[
                    'control-choice-button',
                    isCurrent ? 'is-active' : '',
                    isComplete && !hasError ? 'is-complete' : '',
                    hasError ? 'is-error' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => dispatch({ type: 'JUMP_TO', stageIdx: i })}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{i + 1}. {STAGE_LABELS[stage]}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {isComplete && !hasError ? '✓' : hasError ? '✗' : '·'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ControlGroup>

        <ControlGroup label="Actions">
          <ButtonControl label="Reset" onClick={() => dispatch({ type: 'RESET' })} />
        </ControlGroup>
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={handleDraw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
        />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:pipeline" />
      </DemoCanvasArea>
    </DemoLayout>
  );
}
