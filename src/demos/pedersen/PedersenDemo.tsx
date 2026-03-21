import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  ButtonControl,
  ControlCard,
  ControlNote,
  NumberInputControl,
  ToggleControl,
} from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { fitCameraToBounds } from '@/lib/cameraFit';
import {
  decodeState,
  decodeStatePlain,
  encodeState,
  encodeStatePlain,
  getHashState,
  getSearchParam,
  setSearchParams,
} from '@/lib/urlState';
import { commit, homomorphicAdd, DEFAULT_PARAMS } from './logic';
import type { Commitment, HomomorphicResult } from './logic';
import { renderPedersen } from './renderer';

// ── URL state shape ───────────────────────────────────────────────────────────

interface PedersenUrlState {
  v?: number;
  r?: number;
  v2?: number;
  r2?: number;
  showBlinding?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PedersenDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [value, setValue] = useState(7);
  const [randomness, setRandomness] = useState(23);
  const [value2, setValue2] = useState(5);
  const [randomness2, setRandomness2] = useState(11);
  const [showBlinding, setShowBlinding] = useState(false);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [homomorphic, setHomomorphic] = useState<HomomorphicResult | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  const params = DEFAULT_PARAMS;

  // ── Restore from URL ───────────────────────────────────────────────────────
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'pedersen' ? hashState.state : null;
    const decodedHash = decodeStatePlain<PedersenUrlState>(rawHash);
    const raw = decodedHash ? null : getSearchParam('ped');
    const decoded = decodeState<PedersenUrlState>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.v === 'number') setValue(payload.v);
    if (typeof payload.r === 'number') setRandomness(payload.r);
    if (typeof payload.v2 === 'number') setValue2(payload.v2);
    if (typeof payload.r2 === 'number') setRandomness2(payload.r2);
    if (typeof payload.showBlinding === 'boolean') setShowBlinding(payload.showBlinding);
  }, []);

  // ── Commit action ──────────────────────────────────────────────────────────
  const handleCommit = useCallback(() => {
    setHomomorphic(null);
    const c = commit(params, value, randomness);
    setCommitment(c);
  }, [params, value, randomness]);

  // ── Homomorphic add action ─────────────────────────────────────────────────
  const handleHomomorphicAdd = useCallback(() => {
    const c1 = commit(params, value, randomness);
    const c2 = commit(params, value2, randomness2);
    const result = homomorphicAdd(params, c1, c2);
    setCommitment(null);
    setHomomorphic(result);
  }, [params, value, randomness, value2, randomness2]);

  // ── Info panel ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (homomorphic) {
      setEntry('pedersen', {
        title: homomorphic.valid
          ? 'Homomorphic property holds'
          : 'Homomorphic check failed',
        body: homomorphic.valid
          ? `C₁ · C₂ mod ${params.p} = ${homomorphic.combined}, which equals commit(${homomorphic.sumValue}, ${homomorphic.sumRandomness}) = ${homomorphic.combined}. The additively homomorphic property is verified.`
          : `C₁ · C₂ mod ${params.p} = ${homomorphic.combined} but commit(${homomorphic.sumValue}, ${homomorphic.sumRandomness}) differs. Check that sum values are within the group order.`,
        nextSteps: ['Try different value pairs', 'Observe how combined randomness grows', 'Reset and commit individually'],
      });
    } else if (commitment) {
      setEntry('pedersen', {
        title: `Commitment: C = ${commitment.commitment}`,
        body: `Computed C = ${params.g}^${commitment.value} · ${params.h}^${commitment.randomness} mod ${params.p} = ${commitment.commitment}. The blinding factor r hides the value v — without knowing r, C reveals nothing about v.`,
        nextSteps: ['Toggle "Show blinding factor" to reveal r', 'Try homomorphic addition', 'Share this commitment via URL'],
      });
    } else {
      setEntry('pedersen', {
        title: 'Pedersen Commitments',
        body: `Set a value and randomness, then click "Commit" to compute C = g^v · h^r mod p = ${params.g}^v · ${params.h}^r mod ${params.p}. The commitment is perfectly hiding and computationally binding.`,
        nextSteps: ['Set a value and commit', 'Use "Add Commitments" to see homomorphic addition', 'Toggle the blinding factor'],
      });
    }
  }, [commitment, homomorphic, params, setEntry]);

  // ── Canvas draw ───────────────────────────────────────────────────────────
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      renderPedersen(ctx, frame, params, commitment, homomorphic, showBlinding, theme);
    },
    [params, commitment, homomorphic, showBlinding, theme],
  );

  // ── URL sync ──────────────────────────────────────────────────────────────
  const buildShareState = useCallback(
    (): PedersenUrlState => ({ v: value, r: randomness, v2: value2, r2: randomness2, showBlinding }),
    [value, randomness, value2, randomness2, showBlinding],
  );

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'pedersen') return;
    setSearchParams({ ped: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Share handlers ────────────────────────────────────────────────────────
  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('ped');
    url.hash = `pedersen|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'pedersen');
    url.searchParams.set('ped', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleFitToView = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const isHomo = homomorphic !== null;
    fitCameraToBounds(camera, canvas, {
      minX: isHomo ? 20 : 40,
      minY: 30,
      maxX: isHomo ? 780 : 600,
      maxY: isHomo ? 700 : 520,
    });
  }, [camera, homomorphic]);

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;

    // Save current camera state
    const prevPanX = camera.panX;
    const prevPanY = camera.panY;
    const prevZoom = camera.zoom;

    handleFitToView();

    requestAnimationFrame(() => {
      const data = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = data;
      a.download = 'theora-pedersen.png';
      a.click();
      showDownloadToast('theora-pedersen.png');

      // Restore camera
      camera.panX = prevPanX;
      camera.panY = prevPanY;
      camera.zoom = prevZoom;
    });
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'pedersen',
      timestamp: new Date().toISOString(),
      params,
      commitment: commitment ?? undefined,
      homomorphic: homomorphic
        ? {
            c1: homomorphic.c1,
            c2: homomorphic.c2,
            combined: homomorphic.combined,
            sumValue: homomorphic.sumValue,
            sumRandomness: homomorphic.sumRandomness,
            valid: homomorphic.valid,
          }
        : undefined,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Pedersen params, commitment values & homomorphic result');
  };

  // ── Derived display values ────────────────────────────────────────────────
  const commitmentDisplay = commitment ? String(commitment.commitment) : '—';
  const isVerified = commitment !== null;
  const homoValid = homomorphic?.valid ?? false;
  const homoActive = homomorphic !== null;

  return (
    <DemoLayout
      onEmbedReset={() => {
        setValue(7);
        setRandomness(23);
        setValue2(5);
        setRandomness2(11);
        setShowBlinding(false);
        setCommitment(null);
        setHomomorphic(null);
      }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        <ControlGroup label="Commitment Inputs">
          <NumberInputControl label="Value (v)" value={value} min={0} max={95} onChange={setValue} />
          <NumberInputControl
            label="Randomness (r)"
            value={randomness}
            min={0}
            max={95}
            onChange={setRandomness}
          />
          <ToggleControl
            label="Show blinding factor"
            checked={showBlinding}
            onChange={setShowBlinding}
          />
          <ButtonControl label="Commit" onClick={handleCommit} />
        </ControlGroup>

        {isVerified && !homoActive && (
          <ControlGroup label="Result">
            <ControlCard>
              <span className="control-kicker">Commitment C</span>
              <div
                className="control-value"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}
              >
                {commitmentDisplay}
              </div>
              <span className="control-caption" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                C = {params.g}^{value} · {params.h}^{randomness} mod {params.p}
              </span>
            </ControlCard>
            <ControlNote tone="success">Commitment computed and verified.</ControlNote>
          </ControlGroup>
        )}

        <ControlGroup label="Homomorphic Demo">
          <ControlNote>
            Add two commitments: C₁ · C₂ mod p must equal commit(v₁+v₂, r₁+r₂).
          </ControlNote>
          <NumberInputControl label="Value 2 (v₂)" value={value2} min={0} max={95} onChange={setValue2} />
          <NumberInputControl
            label="Randomness 2 (r₂)"
            value={randomness2}
            min={0}
            max={95}
            onChange={setRandomness2}
          />
          <ButtonControl label="Add Commitments" onClick={handleHomomorphicAdd} />
        </ControlGroup>

        {homoActive && (
          <ControlGroup label="Homomorphic Result">
            <ControlCard>
              <span className="control-kicker">C₁ · C₂ mod p</span>
              <div
                className="control-value"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}
              >
                {homomorphic!.combined}
              </div>
            </ControlCard>
            <ControlCard>
              <span className="control-kicker">commit(v₁+v₂, r₁+r₂)</span>
              <div
                className="control-value"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              >
                commit({homomorphic!.sumValue}, {homomorphic!.sumRandomness})
              </div>
            </ControlCard>
            <ControlNote tone={homoValid ? 'success' : 'error'}>
              {homoValid
                ? 'Homomorphic property verified: C₁ · C₂ = commit(v₁+v₂, r₁+r₂).'
                : 'Mismatch: combined product does not match direct commitment.'}
            </ControlNote>
          </ControlGroup>
        )}

        <ButtonControl label="Reset to Defaults" onClick={() => {
          setValue(7); setRandomness(23); setValue2(5); setRandomness2(11);
          setShowBlinding(false); setCommitment(null); setHomomorphic(null);
          showToast('Reset to defaults');
        }} variant="secondary" />

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <div className="control-button-grid">
            <ButtonControl label="Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Embed" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Audit JSON" onClick={handleCopyAuditSummary} variant="secondary" />
          </div>
        </ControlGroup>
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas
          draw={draw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
        />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:pedersen" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="Pedersen Commitments"
      />
    </DemoLayout>
  );
}
