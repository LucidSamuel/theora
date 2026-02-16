import { useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { AnimatedCanvas } from '@/components/shared/AnimatedCanvas';
import {
  ControlGroup,
  SliderControl,
  ToggleControl,
  ButtonControl,
  TextInput,
} from '@/components/shared/Controls';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import type { RecursiveState, ProofNode, RecursiveMode } from '@/types/recursive';
import {
  buildProofTree,
  getVerificationOrder,
  verifyNode,
  getAllNodes,
  computeTreeLayout,
  buildIvcChain,
  foldIvcStep,
  getConstantProofSize,
} from './logic';
import { renderProofTree, renderIvcChain } from './renderer';
import { copyToClipboard } from '@/lib/clipboard';

type Action =
  | { type: 'SET_MODE'; mode: RecursiveMode }
  | { type: 'SET_DEPTH'; depth: number }
  | { type: 'BUILD_TREE' }
  | { type: 'SET_VERIFICATION'; isRunning: boolean }
  | { type: 'STEP_VERIFY' }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'TOGGLE_PASTA' }
  | { type: 'TOGGLE_PROOF_SIZE' }
  | { type: 'INJECT_BAD_PROOF'; nodeId: string }
  | { type: 'RESET' }
  | { type: 'SET_IVC_LENGTH'; length: number }
  | { type: 'BUILD_IVC' }
  | { type: 'FOLD_IVC' }
  | { type: 'SET_ROOT'; root: ProofNode | null }
  | { type: 'SET_IVC_CHAIN'; chain: any };

function recursiveReducer(state: RecursiveState, action: Action): RecursiveState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode };

    case 'SET_DEPTH':
      return { ...state, treeDepth: action.depth };

    case 'BUILD_TREE': {
      const root = buildProofTree(state.treeDepth, state.badProofTarget);
      const order = getVerificationOrder(root);
      return {
        ...state,
        root,
        verification: {
          ...state.verification,
          order,
          currentIndex: 0,
          isRunning: false,
        },
      };
    }

    case 'SET_VERIFICATION':
      return {
        ...state,
        verification: { ...state.verification, isRunning: action.isRunning },
      };

    case 'STEP_VERIFY': {
      if (!state.root) return state;

      const { order, currentIndex } = state.verification;
      if (currentIndex >= order.length) {
        return {
          ...state,
          verification: { ...state.verification, isRunning: false },
        };
      }

      const nodeId = order[currentIndex];
      if (!nodeId) return state;

      const allNodes = getAllNodes(state.root);
      const node = allNodes.get(nodeId);
      if (!node) return state;

      // Clone the tree immutably, updating the target node's status
      const cloneTree = (n: ProofNode, targetId: string, newStatus: ProofNode['status']): ProofNode => {
        const cloned: ProofNode = {
          ...n,
          children: n.children.map(c => cloneTree(c, targetId, newStatus)),
        };
        if (cloned.id === targetId) {
          cloned.status = newStatus;
        }
        return cloned;
      };

      if (node.status === 'pending') {
        const newRoot = cloneTree(state.root, nodeId, 'verifying');
        return { ...state, root: newRoot };
      } else if (node.status === 'verifying') {
        const finalStatus = verifyNode(node, allNodes);
        const newRoot = cloneTree(state.root, nodeId, finalStatus);
        return {
          ...state,
          root: newRoot,
          verification: {
            ...state.verification,
            currentIndex: currentIndex + 1,
          },
        };
      }

      return state;
    }

    case 'SET_SPEED':
      return {
        ...state,
        verification: { ...state.verification, speed: action.speed },
      };

    case 'TOGGLE_PASTA':
      return { ...state, showPastaCurves: !state.showPastaCurves };

    case 'TOGGLE_PROOF_SIZE':
      return { ...state, showProofSize: !state.showProofSize };

    case 'INJECT_BAD_PROOF':
      return { ...state, badProofTarget: action.nodeId };

    case 'RESET': {
      if (state.mode === 'tree') {
        const root = buildProofTree(state.treeDepth, null);
        const order = getVerificationOrder(root);
        return {
          ...state,
          root,
          badProofTarget: null,
          verification: {
            order,
            currentIndex: 0,
            isRunning: false,
            speed: 500,
          },
        };
      } else {
        const chain = buildIvcChain(state.ivcLength);
        return {
          ...state,
          ivcChain: chain,
        };
      }
    }

    case 'SET_IVC_LENGTH':
      return { ...state, ivcLength: action.length };

    case 'BUILD_IVC': {
      const chain = buildIvcChain(state.ivcLength);
      return { ...state, ivcChain: chain };
    }

    case 'FOLD_IVC': {
      if (!state.ivcChain) return state;
      const chain = foldIvcStep(state.ivcChain);
      return { ...state, ivcChain: chain };
    }

    case 'SET_ROOT':
      return { ...state, root: action.root };

    case 'SET_IVC_CHAIN':
      return { ...state, ivcChain: action.chain };

    default:
      return state;
  }
}

const initialState: RecursiveState = {
  mode: 'tree',
  treeDepth: 3,
  root: null,
  verification: {
    order: [],
    currentIndex: 0,
    isRunning: false,
    speed: 500,
  },
  ivcLength: 5,
  ivcChain: null,
  showPastaCurves: true,
  showProofSize: true,
  badProofTarget: null,
};

export function RecursiveDemo(): JSX.Element {
  const [state, dispatch] = useReducer(recursiveReducer, initialState);
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const interaction = useCanvasInteraction();
  const camera = useCanvasCamera();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const [hoverInfo, setHoverInfo] = useState<{ key: string; title: string; body: string } | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const [badProofInput, setBadProofInput] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-build tree on mount
  useEffect(() => {
    dispatch({ type: 'BUILD_TREE' });
  }, []);

  // Auto-verify effect
  useEffect(() => {
    if (!state.verification.isRunning || state.mode !== 'tree') return;

    const interval = setInterval(() => {
      dispatch({ type: 'STEP_VERIFY' });
    }, state.verification.speed);

    return () => clearInterval(interval);
  }, [state.verification.isRunning, state.verification.speed, state.mode]);

  // Compute layout for tree mode
  const positions = useMemo(() => {
    if (state.mode === 'tree' && state.root) {
      return computeTreeLayout(state.root, canvasSize.width, canvasSize.height);
    }
    return new Map();
  }, [state.root, state.mode, canvasSize]);

  // Draw callback
  const handleDraw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: any) => {
      // Update canvas size
      if (frame.width !== canvasSize.width || frame.height !== canvasSize.height) {
        setCanvasSize({ width: frame.width, height: frame.height });
      }

      const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);

      if (state.mode === 'tree') {
        const { hovered } = renderProofTree(
          ctx,
          frame,
          state.root,
          positions,
          state.verification,
          state.showPastaCurves,
          state.showProofSize,
          worldMouse.x,
          worldMouse.y,
          theme
        );

        const nextHover = hovered
          ? {
              key: hovered.id,
              title: `${hovered.label} (${hovered.curve})`,
              body: `Status: ${hovered.status}. Hovering a proof node.`,
            }
          : null;

        if (nextHover?.key !== hoverKeyRef.current) {
          hoverKeyRef.current = nextHover?.key ?? null;
          setHoverInfo(nextHover);
        }
      } else {
        const { hovered } = renderIvcChain(
          ctx,
          frame,
          state.ivcChain,
          state.showPastaCurves,
          worldMouse.x,
          worldMouse.y,
          theme
        );

        const nextHover = hovered
          ? {
              key: hovered.id,
              title: `${hovered.label} (${hovered.curve})`,
              body: 'Each fold compresses one more step into the accumulator.',
            }
          : null;

        if (nextHover?.key !== hoverKeyRef.current) {
          hoverKeyRef.current = nextHover?.key ?? null;
          setHoverInfo(nextHover);
        }
      }
    },
    [
      state.mode,
      state.root,
      state.ivcChain,
      state.verification,
      state.showPastaCurves,
      state.showProofSize,
      positions,
      interaction.mouseX,
      interaction.mouseY,
      theme,
      canvasSize,
    ]
  );

  // Stats calculation
  const stats = useMemo(() => {
    if (state.mode === 'tree' && state.root) {
      const allNodes = getAllNodes(state.root);
      let verified = 0;
      let failed = 0;
      allNodes.forEach((node) => {
        if (node.status === 'verified') verified++;
        if (node.status === 'failed') failed++;
      });
      return {
        totalNodes: allNodes.size,
        verified,
        failed,
        currentStep: state.verification.currentIndex,
      };
    } else if (state.mode === 'ivc' && state.ivcChain) {
      const folded = state.ivcChain.steps.filter((s) => s.folded).length;
      const currentHash =
        state.ivcChain.steps[state.ivcChain.currentFoldIndex]?.accumulatorHash ?? 'N/A';
      return {
        totalSteps: state.ivcChain.steps.length,
        folded,
        currentHash: currentHash.slice(0, 12) + '...',
      };
    }
    return null;
  }, [state.mode, state.root, state.ivcChain, state.verification.currentIndex]);

  const proofSize = getConstantProofSize();

  // Initialize from URL state (hash-only preferred)
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'recursive' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      mode?: RecursiveMode;
      depth?: number;
      ivcLength?: number;
      showPasta?: boolean;
      showProofSize?: boolean;
    }>(rawHash);

    const raw = decodedHash ? null : getSearchParam('r');
    const decoded = decodeState<{
      mode?: RecursiveMode;
      depth?: number;
      ivcLength?: number;
      showPasta?: boolean;
      showProofSize?: boolean;
    }>(raw);

    const payload = decodedHash ?? decoded;
    if (!payload) return;
    if (payload.mode) dispatch({ type: 'SET_MODE', mode: payload.mode });
    if (typeof payload.depth === 'number') dispatch({ type: 'SET_DEPTH', depth: payload.depth });
    if (typeof payload.ivcLength === 'number') dispatch({ type: 'SET_IVC_LENGTH', length: payload.ivcLength });
    if (typeof payload.showPasta === 'boolean' && payload.showPasta !== initialState.showPastaCurves) {
      dispatch({ type: 'TOGGLE_PASTA' });
    }
    if (typeof payload.showProofSize === 'boolean' && payload.showProofSize !== initialState.showProofSize) {
      dispatch({ type: 'TOGGLE_PROOF_SIZE' });
    }
    if (payload.mode === 'tree') dispatch({ type: 'BUILD_TREE' });
    if (payload.mode === 'ivc') dispatch({ type: 'BUILD_IVC' });
  }, []);

  // Sync to URL
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'recursive') return;
    const payload = {
      mode: state.mode,
      depth: state.treeDepth,
      ivcLength: state.ivcLength,
      showPasta: state.showPastaCurves,
      showProofSize: state.showProofSize,
    };
    setSearchParams({ r: encodeState(payload) });
  }, [state.mode, state.treeDepth, state.ivcLength, state.showPastaCurves, state.showProofSize]);

  const buildShareState = () => ({
    mode: state.mode,
    depth: state.treeDepth,
    ivcLength: state.ivcLength,
    showPasta: state.showPastaCurves,
    showProofSize: state.showProofSize,
  });

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('r');
    url.hash = `recursive|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'recursive');
    url.searchParams.set('r', encodeState(buildShareState()));
    const iframe = `<iframe src="${url.toString()}" width="100%" height="620" style="border:0;border-radius:16px;"></iframe>`;
    copyToClipboard(iframe);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-recursive.png';
    a.click();
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'recursive',
      timestamp: new Date().toISOString(),
      mode: state.mode,
      depth: state.treeDepth,
      ivcLength: state.ivcLength,
      badProofTarget: state.badProofTarget,
      showPasta: state.showPastaCurves,
      showProofSize: state.showProofSize,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
  };

  useEffect(() => {
    if (hoverInfo) {
      setEntry('recursive', {
        title: hoverInfo.title,
        body: hoverInfo.body,
        nextSteps: ['Run auto-verify or step manually', 'Toggle Pasta curves'],
      });
      return;
    }

    if (state.mode === 'ivc') {
      setEntry('recursive', {
        title: 'IVC chain mode',
        body: `Fold steps to compress a long computation. Length: ${state.ivcLength}.`,
        nextSteps: ['Build a new chain', 'Click Fold Step'],
      });
      return;
    }

    if (state.badProofTarget) {
      setEntry('recursive', {
        title: 'Bad proof injected',
        body: `Node ${state.badProofTarget} will fail verification and propagate upward.`,
        nextSteps: ['Run auto-verify to see failure', 'Clear and rebuild the tree'],
      });
      return;
    }

    setEntry('recursive', {
      title: state.verification.isRunning ? 'Auto-verify running' : 'Tree verification',
      body: `Depth ${state.treeDepth}. Verification proceeds bottom-up with constant proof size.`,
      nextSteps: ['Click Auto to animate verification', 'Inject a bad proof to see failure'],
    });
  }, [hoverInfo, state.mode, state.ivcLength, state.badProofTarget, state.verification.isRunning, state.treeDepth, setEntry]);

  return (
    <div className="flex h-full">
      {/* Controls */}
      <div className="w-72 shrink-0 overflow-y-auto p-5 border-r panel-surface" style={{ borderColor: 'var(--border)' }}>

        <ControlGroup label="Mode">
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_MODE', mode: 'tree' })}
              className="flex-1 rounded px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: state.mode === 'tree' ? '#3b82f6' : 'var(--surface-element)',
                color: state.mode === 'tree' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              Tree
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_MODE', mode: 'ivc' })}
              className="flex-1 rounded px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: state.mode === 'ivc' ? '#3b82f6' : 'var(--surface-element)',
                color: state.mode === 'ivc' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              IVC
            </button>
          </div>
        </ControlGroup>

        {state.mode === 'tree' && (
          <>
            <ControlGroup label="Tree Configuration">
              <SliderControl
                label="Depth"
                value={state.treeDepth}
                min={2}
                max={5}
                step={1}
                onChange={(value) => dispatch({ type: 'SET_DEPTH', depth: value })}
              />
              <ButtonControl label="Build Tree" onClick={() => dispatch({ type: 'BUILD_TREE' })} />
            </ControlGroup>

            <ControlGroup label="Verification">
              <div className="flex gap-2">
                <ButtonControl
                  label={state.verification.isRunning ? '⏸ Pause' : '▶ Auto'}
                  onClick={() =>
                    dispatch({
                      type: 'SET_VERIFICATION',
                      isRunning: !state.verification.isRunning,
                    })
                  }
                />
                <ButtonControl
                  label="Step"
                  onClick={() => dispatch({ type: 'STEP_VERIFY' })}
                  disabled={state.verification.isRunning}
                />
              </div>
              <SliderControl
                label={`Speed (${state.verification.speed}ms)`}
                value={1100 - state.verification.speed}
                min={100}
                max={1000}
                step={100}
                onChange={(value) => dispatch({ type: 'SET_SPEED', speed: 1100 - value })}
              />
            </ControlGroup>

            <ControlGroup label="Bad Proof Injection">
              <TextInput
                value={badProofInput}
                onChange={setBadProofInput}
                placeholder="e.g. node_2_1"
              />
              <ButtonControl
                label="Inject"
                onClick={() => {
                  dispatch({ type: 'INJECT_BAD_PROOF', nodeId: badProofInput });
                  dispatch({ type: 'BUILD_TREE' });
                  setBadProofInput('');
                }}
              />
            </ControlGroup>
          </>
        )}

        {state.mode === 'ivc' && (
          <ControlGroup label="IVC Configuration">
            <SliderControl
              label="Chain Length"
              value={state.ivcLength}
              min={3}
              max={10}
              step={1}
              onChange={(value) => dispatch({ type: 'SET_IVC_LENGTH', length: value })}
            />
            <ButtonControl label="Build Chain" onClick={() => dispatch({ type: 'BUILD_IVC' })} />
            <ButtonControl
              label="Fold Step"
              onClick={() => dispatch({ type: 'FOLD_IVC' })}
              disabled={
                !state.ivcChain ||
                state.ivcChain.currentFoldIndex >= state.ivcChain.steps.length - 1
              }
            />
          </ControlGroup>
        )}

        <ControlGroup label="Display Options">
          <ToggleControl
            label="Show Pasta Curves"
            checked={state.showPastaCurves}
            onChange={() => dispatch({ type: 'TOGGLE_PASTA' })}
          />
          {state.mode === 'tree' && (
            <ToggleControl
              label="Show Proof Size"
              checked={state.showProofSize}
              onChange={() => dispatch({ type: 'TOGGLE_PROOF_SIZE' })}
            />
          )}
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

        <ControlGroup label="Actions">
          <ButtonControl label="Reset" onClick={() => dispatch({ type: 'RESET' })} />
        </ControlGroup>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <AnimatedCanvas draw={handleDraw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
      </div>

      {/* Stats Panel */}
      <div className="w-48 shrink-0 overflow-y-auto p-5 border-l panel-surface" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#22c55e' }}>
          Statistics
        </h3>

        {state.mode === 'tree' && stats && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Nodes</div>
              <div className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {stats.totalNodes}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Verified</div>
              <div className="font-mono" style={{ color: 'var(--status-success)' }}>{stats.verified}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Failed</div>
              <div className="font-mono" style={{ color: 'var(--status-error)' }}>{stats.failed}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Current Step</div>
              <div className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {stats.currentStep} / {state.verification.order.length}
              </div>
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Proof Size</div>
              <div className="font-mono font-bold" style={{ color: '#3b82f6' }}>
                {proofSize.description}
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Constant regardless of depth
              </div>
            </div>
          </div>
        )}

        {state.mode === 'ivc' && stats && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Steps</div>
              <div className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {stats.totalSteps}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Folded</div>
              <div className="font-mono" style={{ color: 'var(--status-success)' }}>{stats.folded}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Accumulator</div>
              <div className="break-all font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                {stats.currentHash}
              </div>
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Proof Size</div>
              <div className="font-mono font-bold" style={{ color: '#3b82f6' }}>
                {proofSize.description}
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Constant per fold
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
