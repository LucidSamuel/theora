import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import {
  ControlGroup,
  ToggleControl,
  ButtonControl,
  TextInput,
} from '@/components/shared/Controls';
import { HashBadge } from '@/components/shared/HashBadge';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { createSpring2D, spring2DStep, spring2DSetTarget } from '@/lib/animation';
import { isPrime } from '@/lib/math';
import type { AccumulatorState, AccElement, HistoryEntry } from '@/types/accumulator';
import { renderAccumulator } from './renderer';
import {
  ACC_N,
  ACC_G,
  addElement,
  removeElement,
  batchAdd,
  computeWitness,
  verifyWitness,
  computeNonMembershipWitness,
  verifyNonMembershipWitness,
  randomPrime,
  getOrbitalParams,
} from './logic';

type Action =
  | { type: 'ADD_ELEMENT'; prime: bigint }
  | { type: 'REMOVE_ELEMENT'; index: number }
  | { type: 'BATCH_ADD'; primes: bigint[] }
  | { type: 'SELECT_ELEMENT'; index: number | null }
  | { type: 'COMPUTE_WITNESS' }
  | { type: 'VERIFY_WITNESS' }
  | { type: 'SET_NON_MEMBERSHIP_TARGET'; target: bigint | null }
  | { type: 'COMPUTE_NON_MEMBERSHIP' }
  | { type: 'VERIFY_NON_MEMBERSHIP' }
  | { type: 'SET_BATCH_MODE'; enabled: boolean }
  | { type: 'SET_BATCH_PRIMES'; primes: string }
  | { type: 'ADD_HISTORY'; entry: HistoryEntry }
  | { type: 'CLEAR' }
  | { type: 'UPDATE_SPRINGS'; centerX: number; centerY: number; delta: number };

function reducer(state: AccumulatorState, action: Action): AccumulatorState {
  switch (action.type) {
    case 'ADD_ELEMENT': {
      const { prime } = action;
      const accBefore = state.accValue;
      const accAfter = addElement(state.accValue, prime, ACC_N);

      const orbitalParams = getOrbitalParams(state.elements.length, state.elements.length + 1);

      const newElement: AccElement = {
        prime,
        label: `e${state.elements.length}`,
        orbitRadius: orbitalParams.radius,
        orbitSpeed: orbitalParams.speed,
        orbitAngle: orbitalParams.angle,
        spring: createSpring2D(0, 0, { damping: 0.7, stiffness: 0.05 }),
        opacity: 0,
      };

      return {
        ...state,
        elements: [...state.elements, newElement],
        accValue: accAfter,
        witness: null,
        nonMembership: null,
        selectedIndex: null,
        history: [
          {
            operation: 'add' as const,
            detail: `Added prime ${prime}`,
            accBefore: accBefore.toString(),
            accAfter: accAfter.toString(),
            timestamp: Date.now(),
          },
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'REMOVE_ELEMENT': {
      const { index } = action;
      if (index < 0 || index >= state.elements.length) return state;

      const accBefore = state.accValue;
      const removedPrime = state.elements[index]?.prime;
      const elementPrimes = state.elements.map(el => el.prime);
      const accAfter = removeElement(elementPrimes, index, ACC_G, ACC_N);

      return {
        ...state,
        elements: state.elements.filter((_, i) => i !== index),
        accValue: accAfter,
        witness: null,
        nonMembership: null,
        selectedIndex: null,
        history: [
          {
            operation: 'remove' as const,
            detail: `Removed prime ${removedPrime}`,
            accBefore: accBefore.toString(),
            accAfter: accAfter.toString(),
            timestamp: Date.now(),
          },
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'BATCH_ADD': {
      const { primes } = action;
      if (primes.length === 0) return state;

      const accBefore = state.accValue;
      const accAfter = batchAdd(state.accValue, primes, ACC_N);

      const newElements: AccElement[] = primes.map((prime, i) => {
        const totalIndex = state.elements.length + i;
        const orbitalParams = getOrbitalParams(totalIndex, state.elements.length + primes.length);

        return {
          prime,
          label: `e${totalIndex}`,
          orbitRadius: orbitalParams.radius,
          orbitSpeed: orbitalParams.speed,
          orbitAngle: orbitalParams.angle,
          spring: createSpring2D(0, 0, { damping: 0.7, stiffness: 0.05 }),
          opacity: 0,
        };
      });

      return {
        ...state,
        elements: [...state.elements, ...newElements],
        accValue: accAfter,
        witness: null,
        nonMembership: null,
        selectedIndex: null,
        batchPrimes: '',
        history: [
          {
            operation: 'batch-add' as const,
            detail: `Added ${primes.length} primes in batch`,
            accBefore: accBefore.toString(),
            accAfter: accAfter.toString(),
            timestamp: Date.now(),
          },
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'SELECT_ELEMENT':
      return {
        ...state,
        selectedIndex: action.index,
        witness: null,
        nonMembership: null,
      };

    case 'COMPUTE_WITNESS': {
      if (state.selectedIndex === null) return state;

      const elementPrimes = state.elements.map(el => el.prime);
      const witness = computeWitness(elementPrimes, state.selectedIndex, ACC_G, ACC_N);
      const element = state.elements[state.selectedIndex];

      if (!element) return state;

      return {
        ...state,
        witness: {
          elementIndex: state.selectedIndex,
          witness,
          element: element.prime,
          accValue: state.accValue,
          verified: null,
        },
      };
    }

    case 'VERIFY_WITNESS': {
      if (!state.witness) return state;

      const verified = verifyWitness(
        state.witness.witness,
        state.witness.element,
        state.accValue,
        ACC_N
      );

      return {
        ...state,
        witness: {
          ...state.witness,
          verified,
        },
        history: [
          {
            operation: 'verify' as const,
            detail: verified ? 'Witness verified ✓' : 'Witness verification failed ✗',
            accBefore: state.accValue.toString(),
            accAfter: state.accValue.toString(),
            timestamp: Date.now(),
          },
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'SET_BATCH_MODE':
      return {
        ...state,
        batchMode: action.enabled,
        batchPrimes: '',
      };

    case 'SET_NON_MEMBERSHIP_TARGET':
      return {
        ...state,
        nonMembership: action.target
          ? {
              target: action.target,
              witness: 0n,
              b: 0n,
              verified: null,
            }
          : null,
      };

    case 'COMPUTE_NON_MEMBERSHIP': {
      if (!state.nonMembership) return state;
      const elementPrimes = state.elements.map(el => el.prime);
      const result = computeNonMembershipWitness(elementPrimes, state.nonMembership.target, ACC_G, ACC_N);
      if (!result) return state;
      return {
        ...state,
        nonMembership: {
          ...state.nonMembership,
          witness: result.witness,
          b: result.b,
          verified: null,
        },
      };
    }

    case 'VERIFY_NON_MEMBERSHIP': {
      if (!state.nonMembership) return state;
      const verified = verifyNonMembershipWitness(
        state.nonMembership.witness,
        state.nonMembership.b,
        state.nonMembership.target,
        state.accValue,
        ACC_G,
        ACC_N
      );
      return {
        ...state,
        nonMembership: {
          ...state.nonMembership,
          verified,
        },
        history: [
          {
            operation: 'verify' as const,
            detail: verified ? 'Non-membership verified ✓' : 'Non-membership failed ✗',
            accBefore: state.accValue.toString(),
            accAfter: state.accValue.toString(),
            timestamp: Date.now(),
          },
          ...state.history,
        ].slice(0, 50),
      };
    }

    case 'SET_BATCH_PRIMES':
      return {
        ...state,
        batchPrimes: action.primes,
      };

    case 'CLEAR':
      return {
        elements: [],
        accValue: ACC_G,
        n: ACC_N,
        g: ACC_G,
        selectedIndex: null,
        witness: null,
        nonMembership: null,
        history: [
          {
            operation: 'add' as const,
            detail: 'Accumulator cleared',
            accBefore: state.accValue.toString(),
            accAfter: ACC_G.toString(),
            timestamp: Date.now(),
          },
          ...state.history,
        ].slice(0, 50),
        batchMode: false,
        batchPrimes: '',
      };

    case 'UPDATE_SPRINGS': {
      const { centerX, centerY, delta } = action;

      return {
        ...state,
        elements: state.elements.map((element) => {
          const angle = element.orbitAngle + performance.now() / 1000 * element.orbitSpeed;
          const targetX = centerX + Math.cos(angle) * element.orbitRadius;
          const targetY = centerY + Math.sin(angle) * element.orbitRadius;

          let spring = spring2DSetTarget(element.spring, targetX, targetY);
          spring = spring2DStep(spring, delta);

          // Fade in opacity
          const newOpacity = Math.min(1, element.opacity + delta * 1.5);

          return {
            ...element,
            spring,
            opacity: newOpacity,
          };
        }),
      };
    }

    default:
      return state;
  }
}

const initialState: AccumulatorState = {
  elements: [],
  accValue: ACC_G,
  n: ACC_N,
  g: ACC_G,
  selectedIndex: null,
  witness: null,
  nonMembership: null,
  history: [],
  batchMode: false,
  batchPrimes: '',
};

export function AccumulatorDemo() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const [primeInput, setPrimeInput] = useState('');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [nonMemberInput, setNonMemberInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const hoveredIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 3000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  const handleCanvasClick = useCallback((_x: number, _y: number) => {
    if (hoveredIndexRef.current !== null) {
      dispatch({ type: 'SELECT_ELEMENT', index: hoveredIndexRef.current });
    }
  }, []);

  const interaction = useCanvasInteraction(handleCanvasClick);

  const handleDraw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      const centerX = frame.width / 2;
      const centerY = frame.height / 2;

      // Update spring positions
      dispatch({
        type: 'UPDATE_SPRINGS',
        centerX,
        centerY,
        delta: frame.delta,
      });

      const { hoveredIndex } = renderAccumulator(
        ctx,
        frame,
        state.elements,
        state.accValue,
        state.selectedIndex,
        state.witness,
        state.nonMembership,
        interaction.mouseX,
        interaction.mouseY,
        theme
      );

      if (hoveredIndex !== hoveredIndexRef.current) {
        hoveredIndexRef.current = hoveredIndex;
        setHoverIndex(hoveredIndex);
      }
    },
    [state.elements, state.accValue, state.selectedIndex, state.witness, interaction.mouseX, interaction.mouseY, theme]
  );

  const handleAddPrime = useCallback(() => {
    const num = parseInt(primeInput, 10);
    if (isNaN(num) || !isPrime(num)) {
      setErrorMsg('Please enter a valid prime number');
      return;
    }
    dispatch({ type: 'ADD_ELEMENT', prime: BigInt(num) });
    setPrimeInput('');
  }, [primeInput]);

  const handleRandomPrime = useCallback(() => {
    const prime = randomPrime();
    dispatch({ type: 'ADD_ELEMENT', prime: BigInt(prime) });
  }, []);

  const handleBatchAdd = useCallback(() => {
    const primeStrings = state.batchPrimes.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const primes: bigint[] = [];

    for (const str of primeStrings) {
      const num = parseInt(str, 10);
      if (isNaN(num) || !isPrime(num)) {
        setErrorMsg(`Invalid prime: ${str}`);
        return;
      }
      primes.push(BigInt(num));
    }

    if (primes.length === 0) {
      setErrorMsg('Please enter at least one prime');
      return;
    }

    dispatch({ type: 'BATCH_ADD', primes });
  }, [state.batchPrimes]);

  const handleNonMemberSet = useCallback(() => {
    const num = parseInt(nonMemberInput, 10);
    if (isNaN(num) || !isPrime(num)) {
      setErrorMsg('Please enter a valid prime number');
      return;
    }
    dispatch({ type: 'SET_NON_MEMBERSHIP_TARGET', target: BigInt(num) });
    setNonMemberInput('');
  }, [nonMemberInput]);

  const handleNonMemberCompute = useCallback(() => {
    dispatch({ type: 'COMPUTE_NON_MEMBERSHIP' });
  }, []);

  const handleNonMemberVerify = useCallback(() => {
    dispatch({ type: 'VERIFY_NON_MEMBERSHIP' });
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Initialize from URL state (hash-only preferred)
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'accumulator' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      elements?: number[];
      selectedIndex?: number | null;
      nonMemberTarget?: number | null;
    }>(rawHash);

    const raw = decodedHash ? null : getSearchParam('a');
    const decoded = decodeState<{
      elements?: number[];
      selectedIndex?: number | null;
      nonMemberTarget?: number | null;
    }>(raw);

    const payload = decodedHash ?? decoded;
    if (!payload) return;
    if (payload.elements && payload.elements.length > 0) {
      payload.elements.forEach((prime) => {
        if (typeof prime === 'number' && isPrime(prime)) {
          dispatch({ type: 'ADD_ELEMENT', prime: BigInt(prime) });
        }
      });
    }
    if (typeof payload.selectedIndex === 'number') {
      dispatch({ type: 'SELECT_ELEMENT', index: payload.selectedIndex });
    }
    if (typeof payload.nonMemberTarget === 'number') {
      dispatch({ type: 'SET_NON_MEMBERSHIP_TARGET', target: BigInt(payload.nonMemberTarget) });
    }
  }, []);

  // Sync to URL
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'accumulator') return;
    const payload = {
      elements: state.elements.map((el) => Number(el.prime)),
      selectedIndex: state.selectedIndex,
      nonMemberTarget: state.nonMembership?.target ? Number(state.nonMembership.target) : null,
    };
    setSearchParams({ a: encodeState(payload) });
  }, [state.elements, state.selectedIndex, state.nonMembership]);

  useEffect(() => {
    if (hoverIndex !== null) {
      const element = state.elements[hoverIndex];
      if (element) {
        setEntry('accumulator', {
          title: `Hovering ${element.label}`,
          body: `Prime ${element.prime.toString()}. Click to select and compute a witness.`,
          nextSteps: ['Click to select this element', 'Compute a witness for membership'],
        });
        return;
      }
    }

    if (state.batchMode) {
      setEntry('accumulator', {
        title: 'Batch add mode',
        body: 'Enter primes separated by commas. They will be multiplied into the accumulator in one step.',
        nextSteps: ['Paste primes (e.g., 3,5,7)', 'Click Batch Add'],
      });
      return;
    }

    if (state.nonMembership) {
      const status =
        state.nonMembership.verified === null
          ? 'pending'
          : state.nonMembership.verified
            ? 'verified'
            : 'failed';
      setEntry('accumulator', {
        title: 'Non-membership witness',
        body: `Target ${state.nonMembership.target.toString()} is ${status}. Check w^x · acc^b = g (mod n).`,
        nextSteps: [state.nonMembership.verified === null ? 'Click Verify' : 'Try another prime'],
      });
      return;
    }

    if (state.witness) {
      const status =
        state.witness.verified === null
          ? 'pending'
          : state.witness.verified
            ? 'verified'
            : 'failed';
      setEntry('accumulator', {
        title: 'Membership witness',
        body: `Element e${state.witness.elementIndex} is ${status}. Check that witness^element = accumulator (mod n).`,
        nextSteps: [state.witness.verified === null ? 'Click Verify' : 'Select another element'],
      });
      return;
    }

    setEntry('accumulator', {
      title: 'Add primes to the set',
      body: `Current set size: ${state.elements.length}. Each prime exponentiates the accumulator.`,
      nextSteps: ['Add a prime', 'Select an element to compute a witness'],
    });
  }, [hoverIndex, state.batchMode, state.witness, state.nonMembership, state.elements.length, state.elements, setEntry]);

  const buildShareState = () => ({
    elements: state.elements.map((el: AccElement) => Number(el.prime)),
    selectedIndex: state.selectedIndex,
    nonMemberTarget: state.nonMembership?.target ? Number(state.nonMembership.target) : null,
  });

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('a');
    url.hash = `accumulator|${encodeStatePlain(buildShareState())}`;
    navigator.clipboard.writeText(url.toString());
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'accumulator');
    url.searchParams.set('a', encodeState(buildShareState()));
    const iframe = `<iframe src="${url.toString()}" width="100%" height="620" style="border:0;border-radius:16px;"></iframe>`;
    navigator.clipboard.writeText(iframe);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-accumulator.png';
    a.click();
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'accumulator',
      timestamp: new Date().toISOString(),
      elements: state.elements.map((el: AccElement) => el.prime.toString()),
      accValue: state.accValue.toString(),
      witness: state.witness
        ? {
            elementIndex: state.witness.elementIndex,
            element: state.witness.element.toString(),
            witness: state.witness.witness.toString(),
            verified: state.witness.verified,
          }
        : null,
      nonMembership: state.nonMembership
        ? {
            target: state.nonMembership.target.toString(),
            witness: state.nonMembership.witness.toString(),
            b: state.nonMembership.b.toString(),
            verified: state.nonMembership.verified,
          }
        : null,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return (
    <div className="flex h-full">
      {/* Left Controls Panel */}
      <div className="w-72 shrink-0 overflow-y-auto p-5 border-r panel-surface" style={{ borderColor: 'var(--border)' }}>
        {errorMsg && (
          <div className="mb-3 rounded px-3 py-2 text-xs" style={{
            backgroundColor: 'rgba(239,68,68,0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)',
          }}>
            {errorMsg}
          </div>
        )}

        <ControlGroup label="Add Element">
          <TextInput
            value={primeInput}
            onChange={setPrimeInput}
            placeholder="Enter prime"
            onSubmit={handleAddPrime}
          />
          <div className="flex gap-2 mt-2">
            <ButtonControl onClick={handleAddPrime} label="Add" />
            <ButtonControl onClick={handleRandomPrime} label="Random" />
          </div>
        </ControlGroup>

        <ControlGroup label="Batch Mode">
          <ToggleControl
            checked={state.batchMode}
            onChange={(enabled) => dispatch({ type: 'SET_BATCH_MODE', enabled })}
            label="Enable Batch"
          />

          {state.batchMode && (
            <>
              <textarea
                value={state.batchPrimes}
                onChange={(e) => dispatch({ type: 'SET_BATCH_PRIMES', primes: e.target.value })}
                placeholder="Enter primes separated by commas (e.g., 3,5,7,11)"
                className="w-full h-20 px-3 py-2 text-xs rounded resize-none mt-2"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              />
              <ButtonControl onClick={handleBatchAdd} label="Batch Add" />
            </>
          )}
        </ControlGroup>

        <ControlGroup label="Elements">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {state.elements.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No elements yet</p>
            )}
            {state.elements.map((element, index) => (
              <div
                key={index}
                className="p-2 rounded border"
                style={{
                  borderColor: state.selectedIndex === index
                    ? '#f59e0b'
                    : 'var(--surface-element-border)',
                  backgroundColor: state.selectedIndex === index
                    ? 'rgba(245,158,11,0.1)'
                    : 'transparent',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                    {element.prime.toString()}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => dispatch({ type: 'SELECT_ELEMENT', index })}
                      className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                    >
                      Select
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_ELEMENT', index })}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ControlGroup>

        {state.selectedIndex !== null && (
          <ControlGroup label="Witness">
            <div className="space-y-2">
              <ButtonControl
                onClick={() => dispatch({ type: 'COMPUTE_WITNESS' })}
                label="Compute Witness"
              />
              {state.witness && (
                <>
                  <ButtonControl
                    onClick={() => dispatch({ type: 'VERIFY_WITNESS' })}
                    label="Verify"
                  />
                  {state.witness.verified !== null && (
                    <div
                      className="p-2 rounded text-sm"
                      style={{
                        backgroundColor: state.witness.verified
                          ? 'var(--status-success-bg)'
                          : 'var(--status-error-bg)',
                        color: state.witness.verified
                          ? 'var(--status-success)'
                          : 'var(--status-error)',
                      }}
                    >
                      {state.witness.verified ? '✓ Verified' : '✗ Failed'}
                    </div>
                  )}
                </>
              )}
            </div>
          </ControlGroup>
        )}

        <ControlGroup label="Non-Membership">
          <TextInput
            value={nonMemberInput}
            onChange={setNonMemberInput}
            placeholder="Prime not in set"
            onSubmit={handleNonMemberSet}
          />
          <div className="flex gap-2">
            <ButtonControl onClick={handleNonMemberSet} label="Set Target" />
            <ButtonControl onClick={handleNonMemberCompute} label="Compute" variant="secondary" />
          </div>
          {state.nonMembership && (
            <ButtonControl onClick={handleNonMemberVerify} label="Verify" />
          )}
          {state.nonMembership && state.nonMembership.verified !== null && (
            <div
              className="p-2 rounded text-sm"
              style={{
                backgroundColor: state.nonMembership.verified
                  ? 'var(--status-success-bg)'
                  : 'var(--status-error-bg)',
                color: state.nonMembership.verified
                  ? 'var(--status-success)'
                  : 'var(--status-error)',
              }}
            >
              {state.nonMembership.verified ? '✓ Non-member verified' : '✗ Verification failed'}
            </div>
          )}
        </ControlGroup>

        <ControlGroup label="Parameters">
          <div className="space-y-2">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Modulus (n):</p>
              <HashBadge hash={state.n.toString()} truncate={10} color="blue" />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Generator (g):</p>
              <HashBadge hash={state.g.toString()} truncate={10} color="purple" />
            </div>
          </div>
        </ControlGroup>

        <ControlGroup label="Actions">
          <ButtonControl
            onClick={() => dispatch({ type: 'CLEAR' })}
            label="Clear All"
          />
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
      </div>

      {/* Center Canvas */}
      <div className="flex-1 relative">
        <AnimatedCanvas
          draw={handleDraw}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...interaction.handlers}
        />
      </div>

      {/* Right History Panel */}
      <div className="w-56 shrink-0 overflow-y-auto p-5 border-l panel-surface" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#f59e0b' }}>History</h3>
        <div className="space-y-2">
          {state.history.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No history yet</p>
          )}
          {state.history.map((entry, index) => (
            <div
              key={index}
              className="p-2 rounded border"
              style={{
                backgroundColor: 'var(--surface-element)',
                borderColor: 'var(--surface-element-border)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-semibold"
                  style={{
                    color: entry.operation === 'verify'
                      ? '#a855f7'
                      : '#f59e0b',
                  }}
                >
                  {entry.operation.toUpperCase()}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{entry.detail}</p>
              <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                <div>Before: ...{entry.accBefore.slice(-8)}</div>
                <div>After: ...{entry.accAfter.slice(-8)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
