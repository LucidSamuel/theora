import { useReducer, useEffect, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import {
  ControlGroup,
  ButtonControl,
  TextInput,
  SelectControl,
} from '@/components/shared/Controls';
import { HashBadge } from '@/components/shared/HashBadge';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import type { MerkleTree, MerkleProof } from '@/types/merkle';
import type { HashFunction } from '@/lib/hash';
import { hashInternal } from '@/lib/hash';
import {
  buildMerkleTree,
  generateProof,
  verifyProof,
  computeTreeLayout,
  getProofSteps,
  getProofPathNodes,
} from './logic';
import { renderMerkleTree } from './renderer';

interface MerkleState {
  leaves: string[];
  tree: MerkleTree | null;
  hashMode: HashFunction;
  isBuilding: boolean;
  selectedLeafIndex: number | null;
  proof: MerkleProof | null;
  proofVerified: boolean | null;
  proofStep: number;
  newLeafInput: string;
  proofProgressHash: string | null;
}

interface MerkleHoverInfo {
  id: string;
  hash: string;
  data?: string;
  inProofPath: boolean;
}

type MerkleAction =
  | { type: 'ADD_LEAF'; text: string }
  | { type: 'SET_LEAVES'; leaves: string[] }
  | { type: 'REMOVE_LEAF'; index: number }
  | { type: 'EDIT_LEAF'; index: number; value: string }
  | { type: 'SET_HASH_MODE'; mode: HashFunction }
  | { type: 'GENERATE_PROOF'; leafIndex: number }
  | { type: 'SET_PROOF_FROM_URL'; proof: MerkleProof; leafIndex: number; proofStep: number }
  | { type: 'VERIFY_PROOF' }
  | { type: 'SET_PROOF_VERIFIED'; verified: boolean | null }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACK' }
  | { type: 'SET_PROOF_STEP'; step: number }
  | { type: 'SET_TREE'; tree: MerkleTree | null }
  | { type: 'SET_BUILDING'; building: boolean }
  | { type: 'SET_NEW_LEAF_INPUT'; text: string }
  | { type: 'SET_PROOF_PROGRESS_HASH'; hash: string | null };

function merkleReducer(state: MerkleState, action: MerkleAction): MerkleState {
  switch (action.type) {
    case 'ADD_LEAF':
      if (!action.text.trim()) return state;
      return {
        ...state,
        leaves: [...state.leaves, action.text.trim()],
        newLeafInput: '',
        proof: null,
        proofVerified: null,
        selectedLeafIndex: null,
        proofProgressHash: null,
      };

    case 'SET_LEAVES':
      return {
        ...state,
        leaves: action.leaves,
        proof: null,
        proofVerified: null,
        selectedLeafIndex: null,
        proofStep: 0,
        proofProgressHash: null,
      };

    case 'REMOVE_LEAF':
      return {
        ...state,
        leaves: state.leaves.filter((_, i) => i !== action.index),
        proof: null,
        proofVerified: null,
        selectedLeafIndex: null,
        proofProgressHash: null,
      };

    case 'EDIT_LEAF':
      return {
        ...state,
        leaves: state.leaves.map((leaf, i) => (i === action.index ? action.value : leaf)),
        proof: null,
        proofVerified: null,
        proofProgressHash: null,
      };

    case 'SET_HASH_MODE':
      return {
        ...state,
        hashMode: action.mode,
        proof: null,
        proofVerified: null,
        proofProgressHash: null,
      };

    case 'GENERATE_PROOF':
      if (!state.tree) return state;
      const proof = generateProof(state.tree, action.leafIndex, state.hashMode);
      return {
        ...state,
        selectedLeafIndex: action.leafIndex,
        proof,
        proofVerified: null,
        proofStep: 0,
        proofProgressHash: proof?.leafHash ?? null,
      };

    case 'SET_PROOF_FROM_URL':
      return {
        ...state,
        selectedLeafIndex: action.leafIndex,
        proof: action.proof,
        proofVerified: null,
        proofStep: action.proofStep,
        proofProgressHash: action.proof.leafHash,
      };

    case 'VERIFY_PROOF':
      return state;

    case 'SET_PROOF_VERIFIED':
      return {
        ...state,
        proofVerified: action.verified,
      };

    case 'STEP_FORWARD':
      if (!state.proof) return state;
      return {
        ...state,
        proofStep: Math.min(state.proofStep + 1, state.proof.siblings.length),
      };

    case 'STEP_BACK':
      return {
        ...state,
        proofStep: Math.max(state.proofStep - 1, 0),
      };

    case 'SET_PROOF_STEP':
      return {
        ...state,
        proofStep: action.step,
      };

    case 'SET_TREE':
      return {
        ...state,
        tree: action.tree,
        isBuilding: false,
      };

    case 'SET_BUILDING':
      return {
        ...state,
        isBuilding: action.building,
      };

    case 'SET_NEW_LEAF_INPUT':
      return {
        ...state,
        newLeafInput: action.text,
      };

    case 'SET_PROOF_PROGRESS_HASH':
      return {
        ...state,
        proofProgressHash: action.hash,
      };

    default:
      return state;
  }
}

const initialState: MerkleState = {
  leaves: ['Alice', 'Bob', 'Charlie', 'David'],
  tree: null,
  hashMode: 'fnv1a',
  isBuilding: false,
  selectedLeafIndex: null,
  proof: null,
  proofVerified: null,
  proofStep: 0,
  newLeafInput: '',
  proofProgressHash: null,
};

export function MerkleDemo() {
  const [state, dispatch] = useReducer(merkleReducer, initialState);
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const interaction = useCanvasInteraction();
  const [positions, setPositions] = useState(new Map<string, { x: number; y: number }>());
  const [hoverInfo, setHoverInfo] = useState<MerkleHoverInfo | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const canvasRef = useRef<{ width: number; height: number }>({ width: 800, height: 600 });
  const buildAbortRef = useRef<AbortController | null>(null);
  const pendingUrlRef = useRef<{ leafIndex: number; proofStep: number } | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-switch to fnv1a for large trees
  useEffect(() => {
    if (state.leaves.length > 64 && state.hashMode === 'sha256') {
      dispatch({ type: 'SET_HASH_MODE', mode: 'fnv1a' });
    }
  }, [state.leaves.length, state.hashMode]);

  // Rebuild tree when leaves or hash mode changes
  useEffect(() => {
    if (buildAbortRef.current) {
      buildAbortRef.current.abort();
    }

    const controller = new AbortController();
    buildAbortRef.current = controller;

    dispatch({ type: 'SET_BUILDING', building: true });

    buildMerkleTree(state.leaves, state.hashMode)
      .then((tree) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'SET_TREE', tree });
          if (tree) {
            setPositions(computeTreeLayout(tree, canvasRef.current.width, canvasRef.current.height));
          }
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to build tree:', err);
          dispatch({ type: 'SET_BUILDING', building: false });
        }
      });

    return () => {
      controller.abort();
    };
  }, [state.leaves, state.hashMode]);

  // Initialize from URL state (hash-only preferred)
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'merkle' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      leaves?: string[];
      hashMode?: HashFunction;
      selectedLeafIndex?: number;
      proofStep?: number;
      proof?: MerkleProof;
    }>(rawHash);

    const raw = decodedHash ? null : getSearchParam('m');
    const decoded = decodeState<{
      leaves?: string[];
      hashMode?: HashFunction;
      selectedLeafIndex?: number;
      proofStep?: number;
      proof?: MerkleProof;
    }>(raw);

    const payload = decodedHash ?? decoded;
    if (!payload) return;

    if (payload.leaves && payload.leaves.length > 0) {
      dispatch({ type: 'SET_LEAVES', leaves: payload.leaves });
    }
    if (payload.hashMode) {
      dispatch({ type: 'SET_HASH_MODE', mode: payload.hashMode });
    }
    if (payload.proof && typeof payload.selectedLeafIndex === 'number') {
      dispatch({
        type: 'SET_PROOF_FROM_URL',
        proof: payload.proof,
        leafIndex: payload.selectedLeafIndex,
        proofStep: Math.max(0, payload.proofStep ?? 0),
      });
    } else if (typeof payload.selectedLeafIndex === 'number') {
      pendingUrlRef.current = {
        leafIndex: payload.selectedLeafIndex,
        proofStep: Math.max(0, payload.proofStep ?? 0),
      };
    }
  }, []);

  // Apply proof from URL once tree is ready
  useEffect(() => {
    if (!state.tree || !pendingUrlRef.current) return;
    const { leafIndex, proofStep } = pendingUrlRef.current;
    const proof = generateProof(state.tree, leafIndex, state.hashMode);
    if (proof) {
      dispatch({ type: 'SET_PROOF_FROM_URL', proof, leafIndex, proofStep });
    }
    pendingUrlRef.current = null;
  }, [state.tree, state.hashMode]);

  // Sync to URL
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'merkle') return;
    const payload = {
      leaves: state.leaves,
      hashMode: state.hashMode,
      selectedLeafIndex: state.selectedLeafIndex ?? undefined,
      proofStep: state.proofStep,
      proof: state.proof ?? undefined,
    };
    setSearchParams({ m: encodeState(payload) });
  }, [state.leaves, state.hashMode, state.selectedLeafIndex, state.proofStep]);

  // Verify proof when proof changes
  useEffect(() => {
    if (state.proof) {
      verifyProof(state.proof, state.hashMode).then((verified) => {
        dispatch({ type: 'SET_PROOF_VERIFIED', verified });
      });
    } else {
      dispatch({ type: 'SET_PROOF_VERIFIED', verified: null });
    }
  }, [state.proof, state.hashMode]);

  // Info panel context
  useEffect(() => {
    if (hoverInfo) {
      setEntry('merkle', {
        title: hoverInfo.data ? 'Leaf node' : 'Internal node',
        body: `${hoverInfo.data ? `Data: ${hoverInfo.data}. ` : ''}Hash: ${hoverInfo.hash.slice(0, 12)}... ${
          hoverInfo.inProofPath ? 'This node is on the proof path.' : 'Not on the proof path.'
        }`,
        nextSteps: [
          hoverInfo.data ? 'Click Prove to build a Merkle proof' : 'Trace this node to its children',
          'Step through the proof to see hash composition',
        ],
      });
      return;
    }

    if (!state.proof || state.selectedLeafIndex === null) {
      setEntry('merkle', {
        title: 'Add leaves to build a tree',
        body: 'Each leaf hash rolls up to the root. Generate a proof to see the O(log n) path.',
        nextSteps: ['Add a new leaf', 'Click Prove on a leaf', 'Switch hash function if needed'],
      });
      return;
    }

    const totalSteps = state.proof.siblings.length;
    const stepLabel = state.proofStep === 0 ? 'ready' : `step ${state.proofStep} of ${totalSteps}`;
    const status = state.proofVerified === null ? 'pending' : state.proofVerified ? 'verified' : 'failed';

    setEntry('merkle', {
      title: `Proof ${stepLabel}`,
      body: `Leaf ${state.selectedLeafIndex} with ${totalSteps} sibling hashes. Verification is ${status}.`,
      nextSteps: [
        state.proofStep < totalSteps ? 'Click Next → to advance hashing' : 'Copy JSON proof for sharing',
        'Click ← Back to review earlier steps',
      ],
    });
  }, [hoverInfo, state.proof, state.selectedLeafIndex, state.proofStep, state.proofVerified, setEntry]);

  // Compute current hash at proof step
  useEffect(() => {
    let active = true;

    async function computeProgressHash() {
      if (!state.proof) {
        dispatch({ type: 'SET_PROOF_PROGRESS_HASH', hash: null });
        return;
      }

      let currentHash = state.proof.leafHash;
      const steps = Math.min(state.proofStep, state.proof.siblings.length);
      for (let i = 0; i < steps; i++) {
        const sibling = state.proof.siblings[i];
        if (!sibling) continue;
        if (sibling.position === 'right') {
          currentHash = await hashInternal(currentHash, sibling.hash, state.hashMode);
        } else {
          currentHash = await hashInternal(sibling.hash, currentHash, state.hashMode);
        }
      }

      if (active) {
        dispatch({ type: 'SET_PROOF_PROGRESS_HASH', hash: currentHash });
      }
    }

    computeProgressHash();
    return () => {
      active = false;
    };
  }, [state.proof, state.proofStep, state.hashMode]);

  // Compute proof path for visualization
  const proofPath = new Set<string>();
  const highlightedEdges = new Set<string>();
  const proofPathNodes =
    state.tree && state.selectedLeafIndex !== null
      ? getProofPathNodes(state.tree, state.selectedLeafIndex)
      : null;
  if (state.tree && state.selectedLeafIndex !== null && state.proof) {
    const leaf = state.tree.leaves[state.selectedLeafIndex];
    if (leaf) {
      // Walk from leaf to root marking nodes
      function markPath(node: any, targetId: string): boolean {
        if (node.id === targetId) {
          proofPath.add(node.id);
          return true;
        }
        if (node.left && markPath(node.left, targetId)) {
          proofPath.add(node.id);
          return true;
        }
        if (node.right && markPath(node.right, targetId)) {
          proofPath.add(node.id);
          return true;
        }
        return false;
      }
      markPath(state.tree.root, leaf.id);
    }
  }

  if (proofPathNodes && state.proofStep > 0) {
    const parentIndex = proofPathNodes.length - 1 - state.proofStep;
    const parent = proofPathNodes[parentIndex];
    if (parent?.left) {
      highlightedEdges.add(`${parent.id}->${parent.left.id}`);
    }
    if (parent?.right) {
      highlightedEdges.add(`${parent.id}->${parent.right.id}`);
    }
  }

  const handleDraw = (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    const { width, height } = canvasRef.current;
    if (width !== frame.width || height !== frame.height) {
      canvasRef.current = { width: frame.width, height: frame.height };
      if (state.tree) {
        const newPositions = computeTreeLayout(state.tree, frame.width, frame.height);
        setPositions(newPositions);
      }
    }

    const { hoveredNode } = renderMerkleTree(
      ctx,
      frame,
      state.tree,
      positions,
      proofPath,
      highlightedEdges,
      state.proofStep,
      interaction.mouseX,
      interaction.mouseY,
      theme
    );

    const nextHover =
      hoveredNode
        ? {
            id: hoveredNode.id,
            hash: hoveredNode.hash,
            data: hoveredNode.data,
            inProofPath: proofPath.has(hoveredNode.id),
          }
        : null;

    const nextKey = nextHover ? `${nextHover.id}-${nextHover.inProofPath ? 'p' : 'n'}` : null;
    if (nextKey !== hoverKeyRef.current) {
      hoverKeyRef.current = nextKey;
      setHoverInfo(nextHover);
    }
  };

  const proofSteps = state.proof ? getProofSteps(state.proof) : [];
  const handleCopyProof = () => {
    if (!state.proof) return;
    const payload = JSON.stringify(state.proof, null, 2);
    navigator.clipboard.writeText(payload);
  };

  const handleDownloadProof = () => {
    if (!state.proof) return;
    const payload = JSON.stringify(state.proof, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merkle-proof-leaf-${state.proof.leafIndex}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildShareState = () => ({
    leaves: state.leaves,
    hashMode: state.hashMode,
    selectedLeafIndex: state.selectedLeafIndex ?? undefined,
    proofStep: state.proofStep,
    proof: state.proof ?? undefined,
  });

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('m');
    url.hash = `merkle|${encodeStatePlain(buildShareState())}`;
    navigator.clipboard.writeText(url.toString());
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'merkle');
    url.searchParams.set('m', encodeState(buildShareState()));
    const iframe = `<iframe src="${url.toString()}" width="100%" height="620" style="border:0;border-radius:16px;"></iframe>`;
    navigator.clipboard.writeText(iframe);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-merkle.png';
    a.click();
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'merkle',
      timestamp: new Date().toISOString(),
      leaves: state.leaves,
      root: state.tree?.root.hash ?? null,
      selectedLeafIndex: state.selectedLeafIndex,
      proof: state.proof,
      verified: state.proofVerified,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return (
    <div className="flex h-full">
      <div
        className="w-72 shrink-0 overflow-y-auto p-5 border-r panel-surface"
        style={{
          borderColor: 'var(--border)',
        }}
      >
        <ControlGroup label="Merkle Tree">
          <div className="space-y-2">
            <TextInput
              value={state.newLeafInput}
              onChange={(value) => dispatch({ type: 'SET_NEW_LEAF_INPUT', text: value })}
              onSubmit={() => dispatch({ type: 'ADD_LEAF', text: state.newLeafInput })}
              placeholder="Enter data..."
            />
            <ButtonControl
              label="Add"
              onClick={() => dispatch({ type: 'ADD_LEAF', text: state.newLeafInput })}
              disabled={!state.newLeafInput.trim()}
            />
          </div>

          <div className="mt-4">
            <SelectControl
              label="Hash Function"
              value={state.hashMode}
              options={[
                { value: 'sha256', label: 'SHA-256' },
                { value: 'fnv1a', label: 'FNV-1a (Fast)' },
              ]}
              onChange={(value) => dispatch({ type: 'SET_HASH_MODE', mode: value as HashFunction })}
            />
          </div>

          {state.leaves.length > 64 && (
            <div className="mt-2 text-xs" style={{ color: '#f59e0b' }}>
              Large tree detected. Using FNV-1a for performance.
            </div>
          )}

          {state.isBuilding && (
            <div className="mt-2 text-xs text-gray-500">Building tree...</div>
          )}
        </ControlGroup>

        <ControlGroup label="Leaves">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.leaves.length === 0 && (
              <div className="text-xs text-gray-500">No leaves yet. Add some above.</div>
            )}
          {state.leaves.map((leaf, index) => (
            <div
              key={index}
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor:
                    state.selectedLeafIndex === index
                      ? 'var(--bg-hover)'
                      : 'transparent',
                }}
              >
                <input
                  type="text"
                  value={leaf}
                  onChange={(e) =>
                    dispatch({ type: 'EDIT_LEAF', index, value: e.target.value })
                  }
                  className="flex-1 px-2 py-1 text-xs rounded bg-transparent border"
                  style={{ borderColor: 'var(--border)' }}
                />
                <button
                  onClick={() => dispatch({ type: 'REMOVE_LEAF', index })}
                  className="px-2 py-1 text-xs rounded hover:bg-red-500/20 text-red-500"
                >
                  ×
                </button>
                <button
                  onClick={() => dispatch({ type: 'GENERATE_PROOF', leafIndex: index })}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                  }}
                  disabled={!state.tree || state.isBuilding}
                >
                  Prove
                </button>
              </div>
            ))}
          </div>
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

        {state.proof && (
          <ControlGroup label="Merkle Proof">
            <div className="space-y-2">
              <div className="text-xs">
                <div className="font-semibold mb-1">Leaf Index: {state.proof.leafIndex}</div>
                <div className="mb-2">
                  <HashBadge hash={state.proof.leafHash} />
                </div>
                <div className="mb-2">
                  <HashBadge hash={state.proof.root} />
                </div>
              </div>

              <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs font-semibold mb-2">
                  Proof Steps ({proofSteps.length})
                </div>
                {proofSteps.map((step, i) => (
                  <div
                    key={i}
                    className="mb-2 p-2 rounded text-xs"
                    style={{
                      backgroundColor:
                        i === state.proofStep ? 'var(--bg-hover)' : 'transparent',
                      opacity: i <= state.proofStep ? 1 : 0.5,
                    }}
                  >
                    <div className="font-semibold">{step.description}</div>
                    <div className="mt-1 space-y-1">
                      <HashBadge hash={step.siblingHash} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <ButtonControl
                  label="← Back"
                  onClick={() => dispatch({ type: 'STEP_BACK' })}
                  disabled={state.proofStep === 0}
                />
                <ButtonControl
                  label="Next →"
                  onClick={() => dispatch({ type: 'STEP_FORWARD' })}
                  disabled={state.proofStep >= proofSteps.length}
                />
              </div>

              <div className="mt-2 rounded p-2 text-xs panel-inset">
                <div className="font-semibold mb-1">Current Hash</div>
                {state.proofProgressHash ? (
                  <HashBadge hash={state.proofProgressHash} />
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>No steps yet</div>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <ButtonControl label="Copy JSON" onClick={handleCopyProof} />
                <ButtonControl label="Download" onClick={handleDownloadProof} variant="secondary" />
              </div>

              {state.proofVerified !== null && (
                <div
                  className="mt-2 rounded p-2 text-xs"
                  style={{
                    backgroundColor: state.proofVerified ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: state.proofVerified ? '#22c55e' : '#ef4444',
                  }}
                >
                  {state.proofVerified ? '✓ Proof verified' : '✗ Proof failed'}
                </div>
              )}
            </div>
          </ControlGroup>
        )}
      </div>

      <div className="flex-1 relative">
        <AnimatedCanvas draw={handleDraw} onCanvas={(c) => (canvasElRef.current = c)} {...interaction.handlers} />
      </div>
    </div>
  );
}
