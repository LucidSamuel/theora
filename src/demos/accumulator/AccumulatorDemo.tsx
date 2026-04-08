import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea, DemoAside } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  ToggleControl,
  ButtonControl,
  TextInput,
  ControlCard,
  ControlNote,
} from '@/components/shared/Controls';
import { HashBadge } from '@/components/shared/HashBadge';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { useMode } from '@/modes/ModeProvider';
import { useAttack } from '@/modes/attack/AttackProvider';
import { useAttackActions } from '@/modes/attack/useAttackActions';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { createSpring2D, spring2DStep, spring2DSetTarget } from '@/lib/animation';
import { isPrime } from '@/lib/math';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
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
  pickRandomAvailablePrime,
  forgeToyMembershipWitness,
  getOrbitalParams,
  computeWitnessCascade,
} from './logic';

type AttackForgeryState = {
  target: bigint;
  witness: bigint | null;
  verified: boolean | null;
};

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
  | { type: 'CLEAR' };

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
      const nextElements = [...state.elements, newElement];

      return {
        ...state,
        elements: nextElements,
        accValue: accAfter,
        witness: null,
        nonMembership: null,
        selectedIndex: null,
        witnessCascade: computeWitnessCascade(
          state.elements.map((element) => ({ label: element.label, prime: element.prime })),
          nextElements.map((element) => ({ label: element.label, prime: element.prime })),
          ACC_G,
          ACC_N
        ),
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
      const nextElements = state.elements.filter((_, i) => i !== index);

      return {
        ...state,
        elements: nextElements,
        accValue: accAfter,
        witness: null,
        nonMembership: null,
        selectedIndex: null,
        witnessCascade: computeWitnessCascade(
          state.elements.map((element) => ({ label: element.label, prime: element.prime })),
          nextElements.map((element) => ({ label: element.label, prime: element.prime })),
          ACC_G,
          ACC_N
        ),
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
      const nextElements = [...state.elements, ...newElements];

      return {
        ...state,
        elements: nextElements,
        accValue: accAfter,
        witness: null,
        nonMembership: null,
        selectedIndex: null,
        witnessCascade: computeWitnessCascade(
          state.elements.map((element) => ({ label: element.label, prime: element.prime })),
          nextElements.map((element) => ({ label: element.label, prime: element.prime })),
          ACC_G,
          ACC_N
        ),
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
        witnessCascade: [],
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
  witnessCascade: [],
  history: [],
  batchMode: false,
  batchPrimes: '',
};

export function AccumulatorDemo() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { theme } = useTheme();
  const { mode } = useMode();
  const { currentDemoAction } = useAttack();
  const { setEntry } = useInfoPanel();
  const [primeInput, setPrimeInput] = useState('');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [nonMemberInput, setNonMemberInput] = useState('');
  const [attackForgery, setAttackForgery] = useState<AttackForgeryState | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const hoveredIndexRef = useRef<number | null>(null);
  const springsRef = useRef<{ spring: ReturnType<typeof createSpring2D>; opacity: number }[]>([]);


  const handleCanvasClick = useCallback((_x: number, _y: number) => {
    if (hoveredIndexRef.current !== null) {
      dispatch({ type: 'SELECT_ELEMENT', index: hoveredIndexRef.current });
    }
  }, []);

  const interaction = useCanvasInteraction(handleCanvasClick);
  const camera = useCanvasCamera();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);

  const applyAttackChallenge = useCallback((payload?: { primes?: number[]; target?: number }) => {
    const primes = (payload?.primes ?? [3, 5, 11, 13])
      .filter((prime) => isPrime(prime))
      .map((prime) => BigInt(prime));
    const target = BigInt(payload?.target ?? 17);
    dispatch({ type: 'CLEAR' });
    if (primes.length > 0) {
      dispatch({ type: 'BATCH_ADD', primes });
    }
    setAttackForgery({
      target,
      witness: null,
      verified: null,
    });
    setPrimeInput('');
    setNonMemberInput('');
  }, []);

  const handleForgeMembershipAttack = useCallback(() => {
    if (!attackForgery) return;
    const witness = forgeToyMembershipWitness(state.accValue, attackForgery.target);
    setAttackForgery({
      ...attackForgery,
      witness,
      verified: witness ? verifyWitness(witness, attackForgery.target, state.accValue, ACC_N) : false,
    });
  }, [attackForgery, state.accValue]);

  useAttackActions(currentDemoAction, {
    LOAD_FORGERY_CHALLENGE: (payload) => {
      applyAttackChallenge(payload as { primes?: number[]; target?: number } | undefined);
    },
    FORGE_MEMBERSHIP_WITNESS: () => handleForgeMembershipAttack(),
  });

  const handleDraw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      const centerX = frame.width / 2;
      const centerY = frame.height / 2;
      const springs = springsRef.current;

      // Sync springs array length with elements
      while (springs.length < state.elements.length) {
        springs.push({
          spring: createSpring2D(0, 0, { damping: 0.7, stiffness: 0.05 }),
          opacity: 0,
        });
      }
      springs.length = state.elements.length;

      // Update springs directly in the ref (no dispatch) and build patched elements
      const now = performance.now() / 1000;
      const elementsWithSprings = state.elements.map((element, i) => {
        const s = springs[i]!;
        const angle = element.orbitAngle + now * element.orbitSpeed;
        const targetX = centerX + Math.cos(angle) * element.orbitRadius;
        const targetY = centerY + Math.sin(angle) * element.orbitRadius;

        s.spring = spring2DStep(spring2DSetTarget(s.spring, targetX, targetY), frame.delta);
        s.opacity = Math.min(1, s.opacity + frame.delta * 1.5);

        return { ...element, spring: s.spring, opacity: s.opacity };
      });

      // Transform mouse coords from screen space to world space
      const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);

      const { hoveredIndex } = renderAccumulator(
        ctx,
        frame,
        elementsWithSprings,
        state.accValue,
        state.selectedIndex,
        state.witness,
        state.nonMembership,
        worldMouse.x,
        worldMouse.y,
        theme
      );

      if (hoveredIndex !== hoveredIndexRef.current) {
        hoveredIndexRef.current = hoveredIndex;
        setHoverIndex(hoveredIndex);
      }
    },
    [state.elements, state.accValue, state.selectedIndex, state.witness, state.nonMembership, interaction, theme]
  );

  useEffect(() => {
    if (mode !== 'attack' && attackForgery) {
      setAttackForgery(null);
    }
  }, [attackForgery, mode]);

  const handleAddPrime = useCallback(() => {
    if (attackForgery) {
      showToast('Attack mode locks the victim set', 'error');
      return;
    }
    if (!primeInput.trim()) {
      showToast('Enter a prime number', 'error');
      return;
    }
    const num = parseInt(primeInput, 10);
    if (isNaN(num) || !isPrime(num)) {
      showToast(`${primeInput.trim()} is not prime`, 'error');
      return;
    }
    const bn = BigInt(num);
    if (state.elements.some((el) => el.prime === bn)) {
      showToast(`${num} is already in the set`, 'error');
      return;
    }
    dispatch({ type: 'ADD_ELEMENT', prime: bn });
    setPrimeInput('');
  }, [attackForgery, primeInput, state.elements]);

  const handleRandomPrime = useCallback(() => {
    if (attackForgery) {
      showToast('Attack mode locks the victim set', 'error');
      return;
    }
    const prime = pickRandomAvailablePrime(state.elements.map((element) => element.prime));
    if (prime === null) {
      showToast('All demo primes are already in the set', 'error');
      return;
    }
    dispatch({ type: 'ADD_ELEMENT', prime: BigInt(prime) });
  }, [attackForgery, state.elements]);

  const handleBatchAdd = useCallback(() => {
    if (attackForgery) {
      showToast('Attack mode locks the victim set', 'error');
      return;
    }
    const primeStrings = state.batchPrimes.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const primes: bigint[] = [];
    const existingPrimes = new Set(state.elements.map((el) => el.prime));

    for (const str of primeStrings) {
      const num = parseInt(str, 10);
      if (isNaN(num) || !isPrime(num)) {
        showToast(`Invalid prime: ${str}`, 'error');
        return;
      }
      const bn = BigInt(num);
      if (existingPrimes.has(bn)) {
        showToast(`${num} is already in the set`, 'error');
        return;
      }
      if (primes.includes(bn)) {
        showToast(`Duplicate prime ${num} in batch`, 'error');
        return;
      }
      primes.push(bn);
    }

    if (primes.length === 0) {
      showToast('Enter at least one prime', 'error');
      return;
    }

    dispatch({ type: 'BATCH_ADD', primes });
  }, [attackForgery, state.batchPrimes, state.elements]);

  const handleRemoveElement = useCallback((index: number) => {
    if (attackForgery) {
      showToast('Attack mode locks the victim set', 'error');
      return;
    }
    dispatch({ type: 'REMOVE_ELEMENT', index });
  }, [attackForgery]);

  const handleNonMemberSet = useCallback(() => {
    const num = parseInt(nonMemberInput, 10);
    if (isNaN(num) || !isPrime(num)) {
      showToast('Enter a valid prime number', 'error');
      return;
    }
    const bn = BigInt(num);
    if (state.elements.some((el) => el.prime === bn)) {
      showToast(`${num} is in the set — use membership proof instead`, 'error');
      return;
    }
    dispatch({ type: 'SET_NON_MEMBERSHIP_TARGET', target: bn });
    setNonMemberInput('');
  }, [nonMemberInput, state.elements]);

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
      const validPrimes = payload.elements.slice(0, 64)
        .filter((p): p is number => typeof p === 'number' && isPrime(p))
        .map((p) => BigInt(p));
      if (validPrimes.length > 0) {
        dispatch({ type: 'BATCH_ADD', primes: validPrimes });
      }
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

    if (attackForgery) {
      const status =
        attackForgery.verified === null
          ? 'pending'
          : attackForgery.verified
            ? 'valid'
            : 'failed';
      setEntry('accumulator', {
        title: 'Toy root-extraction attack',
        body: `Target ${attackForgery.target.toString()} is not in the set, yet the forged membership witness is ${status}. Over the toy modulus you can factor n, invert x modulo φ(n), and compute an x-th root of the accumulator.`,
        nextSteps: [attackForgery.witness ? 'Compare this with the strong RSA note' : 'Advance the attack scenario to forge the witness'],
      });
      return;
    }

    if (state.batchMode) {
      setEntry('accumulator', {
        title: 'Batch add mode',
        body: 'Enter primes separated by commas. They will be multiplied into the accumulator in one step.',
        nextSteps: ['Paste primes (e.g., 3,5,7)', 'Click Batch Add'],
      });
      return;
    }

    if (state.witnessCascade.length > 0) {
      const changedCount = state.witnessCascade.filter((entry) => entry.changed).length;
      setEntry('accumulator', {
        title: 'Witness cascade',
        body: `${changedCount} witnesses changed after the latest accumulator mutation. Every surviving member generally needs a fresh witness.`,
        nextSteps: ['Inspect the cascade list', 'Select an element', 'Verify one updated witness'],
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
  }, [hoverIndex, state.batchMode, state.witnessCascade, state.witness, state.nonMembership, attackForgery, state.elements.length, state.elements, setEntry]);

  const buildShareState = () => ({
    elements: state.elements.map((el: AccElement) => Number(el.prime)),
    selectedIndex: state.selectedIndex,
    nonMemberTarget: state.nonMembership?.target ? Number(state.nonMembership.target) : null,
  });

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('a');
    url.hash = `accumulator|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'accumulator');
    url.searchParams.set('a', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-accumulator.png', showDownloadToast);
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
      attackForgery: attackForgery
        ? {
            target: attackForgery.target.toString(),
            witness: attackForgery.witness?.toString() ?? null,
            verified: attackForgery.verified,
          }
        : null,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Accumulator value, witnesses & membership proofs');
  };

  const handleClearAll = useCallback(() => {
    if (attackForgery) {
      applyAttackChallenge({
        primes: state.elements.map((element) => Number(element.prime)),
        target: Number(attackForgery.target),
      });
      return;
    }
    dispatch({ type: 'CLEAR' });
  }, [applyAttackChallenge, attackForgery, state.elements]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const elementRadius = 25;
    const maxOrbit = state.elements.reduce((max, element) => Math.max(max, element.orbitRadius), 120);

    let minX = centerX - maxOrbit - elementRadius - 40;
    let minY = centerY - maxOrbit - elementRadius - 40;
    let maxX = centerX + maxOrbit + elementRadius + 40;
    let maxY = centerY + maxOrbit + elementRadius + 40;

    if (state.selectedIndex !== null) {
      const selected = state.elements[state.selectedIndex];
      if (selected) {
        const x = selected.spring.x.value;
        const y = selected.spring.y.value;
        minX = Math.min(minX, x - 110);
        minY = Math.min(minY, y - elementRadius - 90);
        maxX = Math.max(maxX, x + 110);
        maxY = Math.max(maxY, y + elementRadius + 28);
      }
    }

    if (state.nonMembership && state.nonMembership.witness !== 0n) {
      minX = Math.min(minX, centerX - 150);
      maxX = Math.max(maxX, centerX + 150);
      const proofBoxHeight = state.nonMembership.verified !== null ? 100 : 80;
      maxY = Math.max(maxY, centerY + 90 + proofBoxHeight + 12);
    }

    fitCameraToBounds(camera, canvas, { minX, minY, maxX, maxY }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera, state.elements, state.nonMembership, state.selectedIndex]);

  return (
    <DemoLayout
      onEmbedReset={handleClearAll}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar width="compact">

        <ControlGroup label="Add Element">
          <div className="flex flex-col gap-3">
            <TextInput
              value={primeInput}
              onChange={setPrimeInput}
              placeholder="Enter prime"
              onSubmit={handleAddPrime}
            />
            <div className="control-button-row">
              <ButtonControl onClick={handleAddPrime} label="Add" disabled={Boolean(attackForgery)} />
              <ButtonControl onClick={handleRandomPrime} label="Random" disabled={Boolean(attackForgery)} />
            </div>
          </div>
          {attackForgery && (
            <ControlNote>
              Attack mode locks the victim set so you can only inspect the forged-proof flow.
            </ControlNote>
          )}
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
                className="w-full h-20 text-xs rounded-lg resize-none"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--button-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <ButtonControl onClick={handleBatchAdd} label="Batch Add" disabled={Boolean(attackForgery)} />
            </>
          )}
        </ControlGroup>

        <ControlGroup label="Elements">
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {state.elements.length === 0 && (
              <div className="empty-state">
                <span className="empty-state__text">No elements yet — add a prime above</span>
              </div>
            )}
            {state.elements.map((element, index) => (
              <ControlCard
                key={index}
                tone={state.selectedIndex === index ? 'success' : 'default'}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                    {element.prime.toString()}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => dispatch({ type: 'SELECT_ELEMENT', index })}
                      className="app-leaf-prove"
                    >
                      Select
                    </button>
                    <button
                      onClick={() => handleRemoveElement(index)}
                      className="app-leaf-remove"
                      aria-label="Remove element"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </ControlCard>
            ))}
          </div>
        </ControlGroup>

        {state.selectedIndex !== null && (
          <ControlGroup label="Witness">
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
                    <ControlNote tone={state.witness.verified ? 'success' : 'error'}>
                      {state.witness.verified ? '✓ Verified' : '✗ Failed'}
                    </ControlNote>
                  )}
                </>
              )}
          </ControlGroup>
        )}

        {attackForgery && (
          <ControlGroup label="Forgery Attack">
            <ControlCard>
              <span className="control-kicker">Target prime</span>
              <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                x = {attackForgery.target.toString()}
              </div>
              <div className="control-caption">
                x is not in the set, but the toy modulus lets the attacker extract an x-th root of the accumulator.
              </div>
            </ControlCard>
            {attackForgery.witness ? (
              <ControlCard tone={attackForgery.verified ? 'success' : 'error'}>
                <span className="control-kicker">Forged witness</span>
                <HashBadge hash={attackForgery.witness.toString()} truncate={14} color={attackForgery.verified ? '#22c55e' : '#ef4444'} />
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                  {`Check: w^${attackForgery.target.toString()} ≡ acc (mod n)`}
                </div>
              </ControlCard>
            ) : (
              <ButtonControl onClick={handleForgeMembershipAttack} label="Compute Forged Witness" variant="secondary" />
            )}
            {attackForgery.verified !== null && (
              <ControlNote tone={attackForgery.verified ? 'success' : 'error'}>
                {attackForgery.verified
                  ? 'Forged membership witness verifies on the toy modulus.'
                  : 'Root extraction failed for this target.'}
              </ControlNote>
            )}
          </ControlGroup>
        )}

        <ControlGroup label="Witness Cascade">
          {state.witnessCascade.length === 0 ? (
            <ControlNote>
              Add or remove an element to watch how the surviving witnesses all update.
            </ControlNote>
          ) : (
            <div className="space-y-3">
              <div className="control-caption">
                {state.witnessCascade.filter((entry) => entry.changed).length} / {state.witnessCascade.length} witnesses updated
              </div>
              {state.witnessCascade.slice(0, 8).map((entry) => (
                <ControlCard
                  key={entry.label}
                  tone={entry.changed ? 'success' : 'default'}
                >
                  <div style={{ color: 'var(--text-primary)' }}>
                    {entry.label} = {entry.prime.toString()}
                  </div>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    before: {entry.witnessBefore ? `...${entry.witnessBefore.toString().slice(-8)}` : 'new member'}
                  </div>
                  <div className="control-caption" style={{ color: entry.changed ? 'var(--status-success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    after: ...{entry.witnessAfter.toString().slice(-8)}
                  </div>
                </ControlCard>
              ))}
            </div>
          )}
        </ControlGroup>

        <ControlGroup label="Non-Membership">
          <div className="flex flex-col gap-3">
            <TextInput
              value={nonMemberInput}
              onChange={setNonMemberInput}
              placeholder="Prime not in set"
              onSubmit={handleNonMemberSet}
            />
            <div className="control-button-row">
              <ButtonControl onClick={handleNonMemberSet} label="Set Target" />
              <ButtonControl onClick={handleNonMemberCompute} label="Compute" variant="secondary" />
            </div>
          </div>
          {state.nonMembership && state.nonMembership.witness !== 0n && (
            <>
              <ControlCard>
                <span className="control-kicker">Bézout coefficients</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  a·x + b·∏eᵢ = 1
                </div>
                <div className="control-caption">
                  Extended GCD proves x is coprime to the product of all set elements. Witness w = g^a.
                </div>
              </ControlCard>
              <ButtonControl onClick={handleNonMemberVerify} label="Verify" />
            </>
          )}
          {state.nonMembership && state.nonMembership.verified !== null && (
            <ControlNote tone={state.nonMembership.verified ? 'success' : 'error'}>
              {state.nonMembership.verified ? '✓ Non-member verified' : '✗ Verification failed'}
            </ControlNote>
          )}
        </ControlGroup>

        <ControlGroup label="Parameters">
          <ControlCard>
            <span className="control-kicker">Modulus (n)</span>
            <HashBadge hash={state.n.toString()} truncate={10} color="blue" />
          </ControlCard>
          <ControlCard>
            <span className="control-kicker">Generator (g)</span>
            <HashBadge hash={state.g.toString()} truncate={10} color="purple" />
          </ControlCard>
        </ControlGroup>

        <ControlGroup label="Actions">
          <ButtonControl
            onClick={handleClearAll}
            label="Clear All"
            disabled={Boolean(attackForgery)}
          />
        </ControlGroup>

        <ShareSaveDropdown
          demoId="accumulator"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleCopyAuditSummary}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={handleDraw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
        />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:accumulator" onReset={handleFitToView} />
      </DemoCanvasArea>

      <DemoAside width="compact">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#f59e0b' }}>History</h3>
        <div className="space-y-3">
          {state.history.length === 0 && (
            <div className="empty-state">
              <span className="empty-state__text">No history yet — add or remove elements to see operations</span>
            </div>
          )}
          {state.history.map((entry, index) => (
            <ControlCard
              key={index}
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
            </ControlCard>
          ))}
        </div>
      </DemoAside>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="RSA Accumulator"
      />
    </DemoLayout>
  );
}
