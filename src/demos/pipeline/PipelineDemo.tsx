import { useReducer, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { useAttack } from '@/modes/attack/AttackProvider';
import { useAttackActions } from '@/modes/attack/useAttackActions';
import {
  ControlGroup,
  SliderControl,
  ButtonControl,
  SelectControl,
  ControlCard,
  ControlNote,
  TextInput,
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
import { startGifRecording, type GifRecorder } from '@/lib/gifExport';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
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
import { buildLinkedDemoTarget, getIssueLabel, getLinkedDemoDescriptor, getPrimaryPipelineIssue, getStageDiagnostic } from './linkedState';
import { renderPipeline, getStagePositions } from './renderer';

// ── State ──────────────────────────────────────────────────────────

interface PipelineState {
  scenarioName: string;
  secretX: number;
  activeStageIdx: number;
  fault: FaultType;
  results: PipelineResults;
  autoPlaying: boolean;
  speed: number;
}

type Action =
  | { type: 'SET_SCENARIO_NAME'; name: string }
  | { type: 'SET_X'; x: number }
  | { type: 'SET_FAULT'; fault: FaultType }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACK' }
  | { type: 'JUMP_TO'; stageIdx: number }
  | { type: 'SET_AUTO'; autoPlaying: boolean }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'RESET' }
  | { type: 'RESTORE_STATE'; scenarioName: string; x: number; fault: FaultType; stageIdx: number };

function recompute(x: number, stageIdx: number, fault: FaultType): PipelineResults {
  const stage = STAGES[stageIdx]!;
  return runPipeline(x, stage, fault);
}

const initialState: PipelineState = {
  scenarioName: 'Honest pipeline trace',
  secretX: 3,
  activeStageIdx: 0,
  fault: 'none',
  results: recompute(3, 0, 'none'),
  autoPlaying: false,
  speed: 2,
};

function reducer(state: PipelineState, action: Action): PipelineState {
  switch (action.type) {
    case 'SET_SCENARIO_NAME':
      return { ...state, scenarioName: action.name };
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
    case 'RESTORE_STATE': {
      const idx = Math.max(0, Math.min(action.stageIdx, STAGES.length - 1));
      return {
        ...state,
        scenarioName: action.scenarioName,
        secretX: action.x,
        fault: action.fault,
        activeStageIdx: idx,
        results: recompute(action.x, idx, action.fault),
        autoPlaying: false,
      };
    }
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
  const gifRecorderRef = useRef<GifRecorder | null>(null);
  const { setEntry } = useInfoPanel();
  const [linkBusy, setLinkBusy] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  // Attack mode bridge
  const { currentDemoAction } = useAttack();
  useAttackActions(currentDemoAction, useMemo(() => ({
    SET_FAULT: (payload) => dispatch({ type: 'SET_FAULT', fault: payload as FaultType }),
  }), []));

  const activeStage = STAGES[state.activeStageIdx]!;
  const linkedDescriptor = useMemo(() => getLinkedDemoDescriptor(activeStage), [activeStage]);
  const primaryIssue = useMemo(() => getPrimaryPipelineIssue(state.results, state.fault), [state.fault, state.results]);
  const buildShareState = useCallback(() => ({
    scenarioName: state.scenarioName,
    x: state.secretX,
    stage: activeStage,
    fault: state.fault,
    activeStageIdx: state.activeStageIdx,
    completedStages: Array.from({ length: state.activeStageIdx }, (_, i) => i),
  }), [activeStage, state.activeStageIdx, state.fault, state.scenarioName, state.secretX]);

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'pipeline' ? hashState.state : null;
    const payload = decodeStatePlain<{
      scenarioName?: string;
      x?: number;
      stage?: PipelineStage;
      fault?: FaultType;
      activeStageIdx?: number;
      completedStages?: number[];
    }>(rawHash);
    const raw = payload ? null : getSearchParam('pl');
    const decoded = decodeState<{
      scenarioName?: string;
      x?: number;
      stage?: PipelineStage;
      fault?: FaultType;
      activeStageIdx?: number;
      completedStages?: number[];
    }>(raw);
    const statePayload = payload ?? decoded;

    if (!statePayload) return;

    const nextStageIdx = typeof statePayload.activeStageIdx === 'number'
      ? Math.max(0, Math.min(statePayload.activeStageIdx, STAGES.length - 1))
      : statePayload.stage ? Math.max(0, STAGES.indexOf(statePayload.stage)) : 0;
    const nextX = typeof statePayload.x === 'number' ? statePayload.x : initialState.secretX;
    const nextFault = statePayload.fault ?? initialState.fault;
    const nextName = statePayload.scenarioName ?? initialState.scenarioName;

    dispatch({ type: 'RESTORE_STATE', scenarioName: nextName, x: nextX, fault: nextFault, stageIdx: nextStageIdx });
  }, []);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'pipeline') return;
    setSearchParams({ pl: encodeState(buildShareState()) });
  }, [buildShareState]);

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

      const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
      renderPipeline(ctx, frame, activeStage, state.results, state.fault, isDark, worldMouse.x, worldMouse.y);
    },
    [camera, interaction, theme, activeStage, state.results, state.fault]
  );

  // Stop GIF recording when auto-play ends
  useEffect(() => {
    if (!state.autoPlaying && gifRecorderRef.current) {
      gifRecorderRef.current.stop();
      gifRecorderRef.current = null;
    }
  }, [state.autoPlaying]);

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

  const openLinkedDemo = useCallback(async () => {
    const target = await buildLinkedDemoTarget(activeStage, state.results, state.fault, {
      x: state.secretX,
      stage: activeStage,
      fault: state.fault,
      scenarioName: state.scenarioName,
    });
    if (!target) return;
    setLinkBusy(true);
    window.location.hash = target.hash;
  }, [activeStage, state.fault, state.results, state.secretX]);

  const copyLinkedDemoUrl = useCallback(async () => {
    const target = await buildLinkedDemoTarget(activeStage, state.results, state.fault, {
      x: state.secretX,
      stage: activeStage,
      fault: state.fault,
      scenarioName: state.scenarioName,
    });
    if (!target) return;
    const url = new URL(window.location.href);
    url.hash = target.hash;
    copyToClipboard(url.toString());
    showToast('Deep link copied', `Open ${target.label} with the current pipeline state`);
  }, [activeStage, state.fault, state.results, state.secretX]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (rect.width || 800) / 2;
    const positions = getStagePositions(cx);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of positions.values()) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + pos.w > maxX) maxX = pos.x + pos.w;
      if (pos.y + pos.h > maxY) maxY = pos.y + pos.h;
    }
    // Include the detail panel (x=40, width=canvasWidth-80, bottom ≈ DETAIL_TOP+220)
    minX = Math.min(minX, 40);
    maxX = Math.max(maxX, cx * 2 - 40);
    maxY = Math.max(maxY, 528);
    fitCameraToBounds(camera, canvas, { minX, minY, maxX, maxY }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  // Fit all nodes on mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    requestAnimationFrame(() => handleFitToView({ instant: true }));
  }, [handleFitToView]);

  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  }, []);

  const handleCopyHashUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('pl');
    url.hash = `pipeline|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  }, [buildShareState]);

  const handleCopyEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'pipeline');
    url.searchParams.set('pl', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [buildShareState]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-pipeline.png', showDownloadToast);
  }, [camera, handleFitToView]);

  const handleExportGif = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    dispatch({ type: 'RESET' });
    gifRecorderRef.current = startGifRecording({
      canvas,
      camera,
      fitToView: handleFitToView,
      filename: 'theora-pipeline.gif',
      onDone: () => showDownloadToast('theora-pipeline.gif'),
    });
    dispatch({ type: 'SET_AUTO', autoPlaying: true });
  }, [camera, handleFitToView]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!camera.shouldHandleClick()) return;
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wx = (sx - camera.panX) / camera.zoom;
    const wy = (sy - camera.panY) / camera.zoom;

    const cx = rect.width / 2;
    const positions = getStagePositions(cx);
    for (const [stage, pos] of positions.entries()) {
      if (wx >= pos.x && wx <= pos.x + pos.w && wy >= pos.y && wy <= pos.y + pos.h) {
        const idx = STAGES.indexOf(stage);
        dispatch({ type: 'JUMP_TO', stageIdx: idx });
        return;
      }
    }
  }, [camera]);

  const handleCopyAuditSummary = useCallback(() => {
    const payload = {
      demo: 'pipeline',
      timestamp: new Date().toISOString(),
      scenarioName: state.scenarioName,
      secretX: state.secretX,
      activeStage: activeStage,
      activeStageIdx: state.activeStageIdx,
      fault: state.fault,
      results: {
        witness: state.results.witness,
        constraints: state.results.constraints,
        polynomial: state.results.polynomial,
        commit: state.results.commit,
        challenge: state.results.challenge,
        open: state.results.open,
        verify: state.results.verify,
      },
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Pipeline stage, fault, witness & verification data');
  }, [state, activeStage]);

  return (
    <DemoLayout
      onEmbedPlay={() => dispatch({ type: 'SET_AUTO', autoPlaying: !state.autoPlaying })}
      embedPlaying={state.autoPlaying}
      onEmbedReset={() => dispatch({ type: 'RESET' })}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>

        <ControlGroup label="Computation">
          <TextInput
            value={state.scenarioName}
            onChange={(value) => dispatch({ type: 'SET_SCENARIO_NAME', name: value })}
            placeholder="Scenario name"
          />
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
            hint="Slow → Fast"
          />
        </ControlGroup>

        <ControlGroup label="Fault Injection">
          <SelectControl
            label="Inject fault"
            value={state.fault}
            options={faultOptions}
            onChange={(v) => {
              dispatch({ type: 'SET_FAULT', fault: v as FaultType });
              if (v !== state.fault) showToast('Pipeline reset to Stage 1', v === 'none' ? 'Fault cleared' : 'Fault injected');
            }}
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
              const diagnostic = getStageDiagnostic(stage, state.results, state.fault);
              const hasError = diagnostic.severity === 'error';
              const hasWarning = diagnostic.severity === 'warning';

              return (
                <button
                  key={stage}
                  className={[
                    'control-choice-button',
                    isCurrent ? 'is-active' : '',
                    isComplete && !hasError ? 'is-complete' : '',
                    hasError ? 'is-error' : '',
                    hasWarning ? 'is-warning' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => dispatch({ type: 'JUMP_TO', stageIdx: i })}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{i + 1}. {STAGE_LABELS[stage]}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {hasError ? '✗' : hasWarning ? '!' : isComplete ? '✓' : '·'}
                    </span>
                  </div>
                  <div className="control-caption" style={{ marginTop: 4 }}>
                    {diagnostic.summary}
                  </div>
                </button>
              );
            })}
          </div>
        </ControlGroup>

        <ControlGroup label="Linked Trace">
          {primaryIssue ? (
            <ControlNote tone={primaryIssue.severity === 'warning' ? 'default' : 'error'}>
              First divergence: {getIssueLabel(primaryIssue)}
            </ControlNote>
          ) : (
            <ControlNote tone="success">
              No divergence so far. The current trace is internally consistent through {STAGE_LABELS[activeStage]}.
            </ControlNote>
          )}

          {linkedDescriptor ? (
            <>
              <ControlCard>
                <span className="control-kicker">Underlying demo</span>
                <div className="control-value">{linkedDescriptor.label}</div>
                <div className="control-caption">{linkedDescriptor.description}</div>
                <div className="control-caption" style={{ marginTop: 6 }}>
                  {linkedDescriptor.exact ? 'Exact state handoff' : 'Analogous handoff'}
                </div>
                <div className="control-caption" style={{ marginTop: 6 }}>
                  Scenario: {state.scenarioName || 'Untitled scenario'}
                </div>
              </ControlCard>
              <div className="control-button-row">
                <ButtonControl
                  label={linkBusy ? 'Opening…' : `Open ${linkedDescriptor.label}`}
                  onClick={() => {
                    setLinkBusy(true);
                    void openLinkedDemo().finally(() => setLinkBusy(false));
                  }}
                  disabled={linkBusy}
                />
                <ButtonControl
                  label="Copy Deep Link"
                  onClick={() => void copyLinkedDemoUrl()}
                  variant="secondary"
                />
              </div>
            </>
          ) : (
            <ControlNote>No linked demo is defined for this stage yet.</ControlNote>
          )}
        </ControlGroup>

        <ShareSaveDropdown
          demoId="pipeline"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onExportGif={handleExportGif}
          onCopyAudit={handleCopyAuditSummary}
        />
        <ButtonControl label="Reset" onClick={() => dispatch({ type: 'RESET' })} variant="secondary" />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={handleDraw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
          onClick={handleCanvasClick}
        />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:pipeline" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Proof Pipeline" />
    </DemoLayout>
  );
}
