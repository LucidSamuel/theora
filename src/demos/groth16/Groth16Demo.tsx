import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ButtonControl,
  ControlCard,
  ControlGroup,
  ControlNote,
  NumberInputControl,
  SelectControl,
  ToggleControl,
} from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { useAttack } from '@/modes/attack/AttackProvider';
import { useAttackActions } from '@/modes/attack/useAttackActions';
import { copyToClipboard } from '@/lib/clipboard';
import { showDownloadToast, showToast } from '@/lib/toast';
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
import { exportCanvasPng } from '@/lib/canvas';
import {
  buildPhaseData,
  computePublicOutput,
  PHASE_LABELS,
  PHASE_ORDER,
  nextPhase,
  type Groth16Phase,
  type PhaseData,
} from './logic';
import { renderGroth16 } from './renderer';

// ── URL state shape ───────────────────────────────────────────────────────────

interface UrlState {
  x?: number;
  phase?: Groth16Phase;
  showToxic?: boolean;
  corrupt?: 'none' | 'A' | 'B' | 'C';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Groth16Demo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const { currentDemoAction } = useAttack();

  // ── State ──────────────────────────────────────────────────────────────────
  const [secretX, setSecretX] = useState(3);
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [phase, setPhase] = useState<Groth16Phase>('idle');
  const [showToxic, setShowToxic] = useState(false);
  const [corrupt, setCorrupt] = useState<'none' | 'A' | 'B' | 'C'>('none');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoPhaseHighlight, setAutoPhaseHighlight] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived phase data — computed every render so the canvas is always consistent
  const phaseData: PhaseData = buildPhaseData(secretX, phase, corrupt);

  // ── URL state restore ──────────────────────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'groth16' ? hashState.state : null;
    const decodedHash = decodeStatePlain<UrlState>(rawHash);
    const raw = decodedHash ? null : getSearchParam('g16');
    const decoded = decodeState<UrlState>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.x === 'number') setSecretX(Math.max(1, Math.min(99, payload.x)));
    if (typeof payload.phase === 'string' && PHASE_ORDER.includes(payload.phase as Groth16Phase)) {
      setPhase(payload.phase as Groth16Phase);
    }
    if (typeof payload.showToxic === 'boolean') setShowToxic(payload.showToxic);
    if (payload.corrupt && ['none', 'A', 'B', 'C'].includes(payload.corrupt)) {
      setCorrupt(payload.corrupt as 'none' | 'A' | 'B' | 'C');
    }
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────────────
  const buildShareState = useCallback((): UrlState => ({
    x: secretX,
    phase,
    showToxic,
    corrupt,
  }), [corrupt, phase, secretX, showToxic]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'groth16') return;
    setSearchParams({ g16: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Info panel ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const hasResult = phaseData.verifyResult !== null;
    const isValid   = phaseData.verifyResult?.valid ?? null;

    setEntry('groth16', {
      title: phase === 'idle'
        ? 'Groth16 zkSNARK'
        : `Phase: ${PHASE_LABELS[phase]}`,
      body: phase === 'idle'
        ? 'Press "Step" to walk through the Groth16 pipeline: R1CS encoding, QAP conversion, trusted setup, proof generation, and pairing-based verification.'
        : phase === 'r1cs'
          ? `Circuit f(x) = x² + x + 5 with x=${secretX}. Witness w = [1, ${secretX}, ${secretX * secretX % 101}, ${computePublicOutput(secretX)}]. Both constraints must be satisfied.`
          : phase === 'qap'
            ? 'The R1CS is converted to a QAP: each wire gets an A/B/C polynomial over the evaluation domain {1, 2}. The witness satisfies the QAP iff A(τ)·B(τ) − C(τ) = H(τ)·t(τ).'
            : phase === 'setup'
              ? `Trusted setup generates α, β, γ, δ. These are the "toxic waste" — if the ceremony is honest, they are destroyed. In a real Groth16 this involves elliptic-curve powers-of-τ.`
              : phase === 'prove'
                ? `The prover computes π = (A, B, C) using the QAP and trapdoor evaluations.${corrupt !== 'none' ? ` Element ${corrupt} has been corrupted.` : ''}`
                : hasResult
                  ? `Pairing check: e(A, B) ${isValid ? '=' : '≠'} e(α, β)·e(pub, γ)·e(C, δ). Result: ${isValid ? 'VALID' : 'INVALID'}.`
                  : 'Pairing-based verification checks the proof without learning the witness.',
      nextSteps: [
        'Step through each phase',
        'Toggle "Show toxic waste"',
        'Corrupt a proof element',
        'Change the secret input x',
      ],
    });
  }, [corrupt, phase, phaseData.verifyResult, secretX, setEntry]);

  // ── Auto-run ───────────────────────────────────────────────────────────────
  const AUTO_STEP_DELAY = 500; // ms between each phase transition

  const stopAuto = useCallback(() => {
    if (autoRef.current) clearTimeout(autoRef.current);
    autoRef.current = null;
    setAutoRunning(false);
    setAutoPhaseHighlight(false);
  }, []);

  const stepForward = useCallback((current: Groth16Phase): Groth16Phase => {
    const next = nextPhase(current);
    setPhase(next);
    return next;
  }, []);

  const runAuto = useCallback((current: Groth16Phase) => {
    const next = nextPhase(current);
    if (next === current) {
      // brief highlight on final phase before stopping
      setAutoPhaseHighlight(true);
      autoRef.current = setTimeout(() => {
        setAutoPhaseHighlight(false);
        stopAuto();
      }, AUTO_STEP_DELAY);
      return;
    }
    setPhase(next);
    setAutoPhaseHighlight(true);
    autoRef.current = setTimeout(() => {
      setAutoPhaseHighlight(false);
      runAuto(next);
    }, AUTO_STEP_DELAY);
  }, [stopAuto]);

  const startAutoRunFromStart = useCallback(() => {
    stopAuto();
    setCorrupt('none');
    setPhase('idle');
    setAutoRunning(true);
    setAutoPhaseHighlight(false);
    autoRef.current = setTimeout(() => {
      setPhase('r1cs');
      setAutoPhaseHighlight(true);
      autoRef.current = setTimeout(() => {
        setAutoPhaseHighlight(false);
        runAuto('r1cs');
      }, AUTO_STEP_DELAY);
    }, AUTO_STEP_DELAY);
  }, [runAuto, stopAuto]);

  const handleAutoRun = useCallback(() => {
    if (autoRunning) {
      stopAuto();
      return;
    }
    startAutoRunFromStart();
  }, [autoRunning, startAutoRunFromStart, stopAuto]);

  // Cancel auto on unmount
  useEffect(() => () => { if (autoRef.current) clearTimeout(autoRef.current); }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStep = useCallback(() => {
    stopAuto();
    stepForward(phase);
  }, [phase, stepForward, stopAuto]);

  const handleReset = useCallback(() => {
    stopAuto();
    setPhase('idle');
    setCorrupt('none');
    setSecretX(3);
    setInputWarning(null);
    setShowToxic(false);
    showToast('Reset to defaults');
  }, [stopAuto]);

  const handleSecretChange = useCallback((v: number) => {
    if (v < 1 || v > 99) {
      setInputWarning(`Value ${v} is outside [1, 99] — clamped to ${Math.max(1, Math.min(99, v))}`);
    } else {
      setInputWarning(null);
    }
    setSecretX(Math.max(1, Math.min(99, v)));
    setPhase('idle');
    stopAuto();
  }, [stopAuto]);

  useAttackActions(currentDemoAction, {
    AUTO_RUN: () => {
      startAutoRunFromStart();
    },
    SET_CORRUPT: (payload) => {
      stopAuto();
      const nextCorrupt =
        payload === 'A' || payload === 'B' || payload === 'C'
          ? payload
          : payload && typeof payload === 'object' && ('element' in payload)
            && (((payload as { element?: unknown }).element === 'A')
              || ((payload as { element?: unknown }).element === 'B')
              || ((payload as { element?: unknown }).element === 'C'))
            ? (payload as { element: 'A' | 'B' | 'C' }).element
            : 'A';
      setCorrupt(nextCorrupt);
      setPhase('prove');
    },
    STEP_PHASE: (payload) => {
      stopAuto();
      if (
        payload === 'idle'
        || payload === 'r1cs'
        || payload === 'qap'
        || payload === 'setup'
        || payload === 'prove'
        || payload === 'verify'
      ) {
        setPhase(payload);
        return;
      }
      if (payload && typeof payload === 'object') {
        const maybePhase = (payload as { phase?: unknown }).phase;
        const maybeCorrupt = (payload as { corrupt?: unknown }).corrupt;
        if (maybeCorrupt === 'A' || maybeCorrupt === 'B' || maybeCorrupt === 'C' || maybeCorrupt === 'none') {
          setCorrupt(maybeCorrupt);
        }
        if (
          maybePhase === 'idle'
          || maybePhase === 'r1cs'
          || maybePhase === 'qap'
          || maybePhase === 'setup'
          || maybePhase === 'prove'
          || maybePhase === 'verify'
        ) {
          setPhase(maybePhase);
        }
      }
    },
  });

  // ── Share actions ──────────────────────────────────────────────────────────
  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  }, []);

  const handleCopyHashUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('g16');
    url.hash = `groth16|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  }, [buildShareState]);

  const handleCopyEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'groth16');
    url.searchParams.set('g16', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [buildShareState]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;
    fitCameraToBounds(camera, canvas, { minX: 0, minY: 0, maxX: w, maxY: h }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-groth16.png', showDownloadToast);
  }, [camera, handleFitToView]);


  const handleCopyAuditSummary = useCallback(() => {
    const payload = {
      demo: 'groth16',
      timestamp: new Date().toISOString(),
      secretX,
      publicOutput: computePublicOutput(secretX),
      phase,
      corrupt,
      r1cs: phaseData.r1cs
        ? {
            witness: phaseData.r1cs.witness,
            satisfied: phaseData.r1cs.satisfied,
          }
        : null,
      proof: phaseData.proof ?? null,
      verifyResult: phaseData.verifyResult ?? null,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'R1CS witness, proof elements & verification result');
  }, [corrupt, phase, phaseData, secretX]);

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      renderGroth16(ctx, frame, phaseData, showToxic, theme, autoRunning && autoPhaseHighlight);
    },
    [phaseData, showToxic, theme, autoRunning, autoPhaseHighlight],
  );

  // ── Phase display helpers ──────────────────────────────────────────────────
  const isAtEnd = phase === 'verify';
  const canStep = !isAtEnd;
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  const completedCount = Math.max(0, phaseIdx - 1); // idle doesn't count

  return (
    <DemoLayout
      onEmbedReset={handleReset}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Secret input */}
        <ControlGroup label="Circuit Input">
          <NumberInputControl
            label="Secret x (1–99)"
            value={secretX}
            min={1}
            max={99}
            onChange={handleSecretChange}
          />
          {inputWarning && (
            <ControlNote tone="error">
              {inputWarning}
            </ControlNote>
          )}
          <ControlCard>
            <span className="control-kicker">Public output y</span>
            <span className="control-value">{computePublicOutput(secretX)}</span>
            <span className="control-caption">f(x) = x² + x + 5 mod 101</span>
          </ControlCard>
        </ControlGroup>

        {/* Pipeline controls */}
        <ControlGroup label="Pipeline">
          <ButtonControl
            label={canStep ? `Step → ${PHASE_LABELS[nextPhase(phase)]}` : 'Complete'}
            onClick={handleStep}
            disabled={!canStep || autoRunning}
          />
          <ButtonControl
            label={autoRunning ? 'Stop auto-run' : 'Auto-run all phases'}
            onClick={handleAutoRun}
            variant="secondary"
          />
          <ButtonControl
            label="Reset to Defaults"
            onClick={handleReset}
            variant="secondary"
          />

          {phase !== 'idle' && (
            <ControlCard>
              <span className="control-kicker">Current phase</span>
              <span className="control-value" style={autoPhaseHighlight && autoRunning ? { color: 'var(--accent, #3b82f6)', transition: 'color 0.2s ease' } : undefined}>
                {autoRunning ? `${PHASE_LABELS[phase]}${autoPhaseHighlight ? ' ...' : ''}` : PHASE_LABELS[phase]}
              </span>
              {completedCount > 0 && (
                <span className="control-caption">{completedCount} phase{completedCount !== 1 ? 's' : ''} completed</span>
              )}
            </ControlCard>
          )}
        </ControlGroup>

        {/* Fault injection */}
        <ControlGroup label="Fault Injection">
          <ToggleControl
            label="Corrupt proof element"
            checked={corrupt !== 'none'}
            onChange={(v) => setCorrupt(v ? 'A' : 'none')}
          />
          {corrupt !== 'none' && (
            <SelectControl
              label="Element to corrupt"
              value={corrupt}
              onChange={(v) => setCorrupt(v as 'A' | 'B' | 'C')}
              options={[
                { value: 'A', label: 'A (G1 element)' },
                { value: 'B', label: 'B (G2 element)' },
                { value: 'C', label: 'C (combining term)' },
              ]}
            />
          )}
          {corrupt !== 'none' && phase !== 'idle' && (
            <ControlNote tone={phaseData.verifyResult !== null ? 'error' : 'default'}>
              {phaseData.verifyResult !== null
                ? `Verification ${phaseData.verifyResult.valid ? 'still passes (unlikely)' : 'fails — pairing mismatch'}`
                : `${corrupt} will be incremented by 1 during proof generation`}
            </ControlNote>
          )}
        </ControlGroup>

        {/* Setup options */}
        <ControlGroup label="Setup Options">
          <ToggleControl
            label="Show toxic waste"
            checked={showToxic}
            onChange={setShowToxic}
          />
          {showToxic && (
            <ControlNote tone="error">
              Revealing α, β, γ, δ breaks the scheme — a real ceremony destroys these.
            </ControlNote>
          )}
        </ControlGroup>

        {/* Verification result — shown once verify phase is reached */}
        {phaseData.verifyResult !== null && (
          <ControlGroup label="Result">
            <ControlNote tone={phaseData.verifyResult.valid ? 'success' : 'error'}>
              {phaseData.verifyResult.valid
                ? 'Proof verified — pairing check passes.'
                : 'Verification failed — pairing mismatch.'}
            </ControlNote>
            <ControlCard>
              <span className="control-kicker">LHS e(A, B)</span>
              <span className="control-value">{phaseData.verifyResult.lhsPairing}</span>
              <span className="control-kicker" style={{ marginTop: 8 }}>RHS e(α,β)·…</span>
              <span className="control-value">{phaseData.verifyResult.rhsPairing}</span>
            </ControlCard>
          </ControlGroup>
        )}

        <ShareSaveDropdown
          demoId="groth16"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleCopyAuditSummary}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={draw}
          camera={camera}
          onCanvas={(c) => { canvasElRef.current = c; }}
          {...mergedHandlers}
        />
        <CanvasToolbar
          camera={camera}
          storageKey="theora:toolbar:groth16"
          onReset={handleFitToView}
        />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Groth16 zkSNARK"
      />
    </DemoLayout>
  );
}
