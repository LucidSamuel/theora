import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoAside, DemoCanvasArea, DemoLayout, DemoSidebar } from '@/components/shared/DemoLayout';
import { ButtonControl, ControlCard, ControlGroup, ControlNote, SliderControl, ToggleControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { exportCanvasPng } from '@/lib/canvas';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { showDownloadToast, showToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { buildSyncScenario, getSyncRoundDetails } from './logic';
import { renderObliviousSync } from './renderer';

interface UrlState {
  walletCount?: number;
  serviceCount?: number;
  injectSpentMatch?: boolean;
  round?: number;
}

export function ObliviousSyncDemo(): JSX.Element {
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const [walletCount, setWalletCount] = useState(3);
  const [serviceCount, setServiceCount] = useState(8);
  const [injectSpentMatch, setInjectSpentMatch] = useState(false);
  const [round, setRound] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const hashState = getHashState();
    const decodedHash = hashState?.demo === 'oblivious-sync' ? decodeStatePlain<UrlState>(hashState.state) : null;
    const payload = decodedHash ?? decodeState<UrlState>(getSearchParam('os'));
    if (!payload) return;
    if (typeof payload.walletCount === 'number') setWalletCount(Math.max(2, Math.min(6, payload.walletCount)));
    if (typeof payload.serviceCount === 'number') setServiceCount(Math.max(4, Math.min(12, payload.serviceCount)));
    if (typeof payload.injectSpentMatch === 'boolean') setInjectSpentMatch(payload.injectSpentMatch);
    if (typeof payload.round === 'number') setRound(Math.max(0, Math.min(4, payload.round)));
  }, []);

  const buildShareState = useCallback(() => ({
    walletCount,
    serviceCount,
    injectSpentMatch,
    round,
  }), [injectSpentMatch, round, serviceCount, walletCount]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'oblivious-sync') return;
    setSearchParams({ os: encodeState(buildShareState()) });
  }, [buildShareState]);

  const scenario = useMemo(
    () => buildSyncScenario(walletCount, serviceCount, injectSpentMatch),
    [injectSpentMatch, serviceCount, walletCount]
  );
  const details = useMemo(() => getSyncRoundDetails(scenario, round as 0 | 1 | 2 | 3 | 4), [round, scenario]);

  useEffect(() => {
    if (!autoplay) return;
    if (round >= 4) {
      setAutoplay(false);
      return;
    }
    const timeout = window.setTimeout(() => setRound((value) => Math.min(4, value + 1)), 900);
    return () => window.clearTimeout(timeout);
  }, [autoplay, round]);

  useEffect(() => {
    setEntry('oblivious-sync', {
      title: details.title,
      body: `${details.walletAction} ${details.serviceAction} The wallet learns only the sync outcome; the service learns only the batch shape, not the wallet’s raw nullifiers.`,
      nextSteps: ['Step through each protocol round', 'Inject a spent-note collision', 'Compare what each side learns at every message'],
    });
  }, [details, setEntry]);

  const handleDraw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderObliviousSync(ctx, frame, scenario, round, details, theme);
  }, [details, round, scenario, theme]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    fitCameraToBounds(camera, canvas, { minX: 20, minY: 20, maxX: 980, maxY: 620 }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the current sync trace');
  }, []);

  const handleCopyHashUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('os');
    url.hash = `oblivious-sync|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied');
  }, [buildShareState]);

  const handleCopyEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'oblivious-sync');
    url.searchParams.set('os', encodeState(buildShareState()));
    url.hash = '';
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [buildShareState]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-oblivious-sync.png', showDownloadToast);
  }, [camera, handleFitToView]);

  const handleAuditJson = useCallback(() => {
    copyToClipboard(JSON.stringify({
      demo: 'oblivious-sync',
      walletCount,
      serviceCount,
      injectSpentMatch,
      round,
      overlapCount: scenario.overlapCount,
      verified: scenario.verified,
      proofDigest: scenario.proofDigest,
    }, null, 2));
    showToast('Audit JSON copied');
  }, [injectSpentMatch, round, scenario.overlapCount, scenario.proofDigest, scenario.verified, serviceCount, walletCount]);

  return (
    <DemoLayout
      onEmbedPlay={() => setAutoplay((value) => !value)}
      embedPlaying={autoplay}
      onEmbedReset={() => { setRound(0); setAutoplay(false); }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar width="compact">
        <ControlGroup label="Scenario">
          <SliderControl label="Wallet notes" value={walletCount} min={2} max={6} step={1} onChange={(value) => { setWalletCount(value); setRound(0); }} />
          <SliderControl label="Spent-set size" value={serviceCount} min={4} max={12} step={1} onChange={(value) => { setServiceCount(value); setRound(0); }} />
          <ToggleControl label="Inject spent-note collision" checked={injectSpentMatch} onChange={(value) => { setInjectSpentMatch(value); setRound(0); }} />
        </ControlGroup>

        <ControlGroup label="Protocol">
          <ControlCard>
            <div className="control-kicker">Current round</div>
            <div className="control-value">#{round + 1}</div>
            <div className="control-caption">{details.title}</div>
          </ControlCard>
          <div className="control-button-row">
            <ButtonControl label="Back" onClick={() => setRound((value) => Math.max(0, value - 1))} disabled={round === 0} />
            <ButtonControl label="Next" onClick={() => setRound((value) => Math.min(4, value + 1))} disabled={round === 4} />
          </div>
          <div className="control-button-row">
            <ButtonControl label={autoplay ? 'Pause' : 'Auto-play'} onClick={() => setAutoplay((value) => !value)} />
            <ButtonControl label="Replay" onClick={() => { setRound(0); setAutoplay(false); }} />
          </div>
        </ControlGroup>

        <ShareSaveDropdown
          demoId="oblivious-sync"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleAuditJson}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={handleDraw} camera={camera} onCanvas={(canvas) => { canvasElRef.current = canvas; }} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:oblivious-sync" onReset={handleFitToView} />
      </DemoCanvasArea>

      <DemoAside width="narrow">
        <ControlGroup label="What Each Party Learns">
          <ControlCard>
            <div className="control-kicker">Wallet learns</div>
            <div className="control-caption">{details.walletLearns[0]}</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Service learns</div>
            <div className="control-caption">{details.serviceLearns[0]}</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Outcome</div>
            <div className="control-value" style={{ color: scenario.verified ? '#22c55e' : '#ef4444' }}>
              {scenario.verified ? 'Clean sync' : 'Spent note'}
            </div>
            <div className="control-caption">
              {scenario.verified ? 'The service proves disjointness without seeing raw notes.' : 'The wallet detects a collision without revealing which note it queried.'}
            </div>
          </ControlCard>
        </ControlGroup>

        <ControlNote>
          The wallet reveals only blinded nullifiers. The service proves a set relation over that blinded batch, and the wallet verifies locally without leaking its actual notes.
        </ControlNote>
      </DemoAside>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Oblivious Sync" />
    </DemoLayout>
  );
}
