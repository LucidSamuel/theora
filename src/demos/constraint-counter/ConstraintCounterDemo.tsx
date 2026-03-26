import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoAside, DemoCanvasArea, DemoLayout, DemoSidebar } from '@/components/shared/DemoLayout';
import { ButtonControl, ControlCard, ControlGroup, ControlNote, SliderControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { SaveToGitHub } from '@/components/shared/SaveToGitHub';
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
import {
  buildConstraintScenario,
  formatConstraintCount,
  getConstraintProfiles,
  getFullTreeConstraintCost,
  getPathConstraintCost,
  getSavingsRatio,
} from './logic';
import { renderConstraintCounter } from './renderer';

interface UrlState {
  depth?: number;
}

export function ConstraintCounterDemo(): JSX.Element {
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const [depth, setDepth] = useState(16);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const hashState = getHashState();
    const decodedHash = hashState?.demo === 'constraint-counter' ? decodeStatePlain<UrlState>(hashState.state) : null;
    const payload = decodedHash ?? decodeState<UrlState>(getSearchParam('cc'));
    if (typeof payload?.depth === 'number') {
      setDepth(Math.max(2, Math.min(32, payload.depth)));
    }
  }, []);

  const buildShareState = useCallback(() => ({ depth }), [depth]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'constraint-counter') return;
    setSearchParams({ cc: encodeState(buildShareState()) });
  }, [buildShareState]);

  const scenario = useMemo(() => buildConstraintScenario(depth), [depth]);
  const [pedersen, poseidon] = getConstraintProfiles();
  const pedersenPathR1cs = getPathConstraintCost(pedersen!, scenario.depth, 'r1cs');
  const poseidonPathR1cs = getPathConstraintCost(poseidon!, scenario.depth, 'r1cs');
  const pedersenPathBootle = getPathConstraintCost(pedersen!, scenario.depth, 'bootle16');
  const poseidonPathBootle = getPathConstraintCost(poseidon!, scenario.depth, 'bootle16');
  const pedersenTreeR1cs = getFullTreeConstraintCost(pedersen!, scenario.internalHashes, 'r1cs');
  const poseidonTreeR1cs = getFullTreeConstraintCost(poseidon!, scenario.internalHashes, 'r1cs');
  const pedersenTreeBootle = getFullTreeConstraintCost(pedersen!, scenario.internalHashes, 'bootle16');
  const poseidonTreeBootle = getFullTreeConstraintCost(poseidon!, scenario.internalHashes, 'bootle16');

  useEffect(() => {
    setEntry('constraint-counter', {
      title: `Depth-${scenario.depth} Merkle cost comparison`,
      body: `Poseidon keeps both R1CS and Bootle16 counts dramatically below Pedersen. On a depth-${scenario.depth} path the savings are already large; over an entire tree build they compound into orders of magnitude fewer constraints.`,
      nextSteps: ['Increase the tree depth', 'Compare path cost against full-tree cost', 'Use this to explain why Poseidon replaced Pedersen in zk-heavy Merkle paths'],
    });
  }, [scenario.depth, setEntry]);

  const handleDraw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderConstraintCounter(
      ctx,
      frame,
      scenario.profiles,
      scenario.profiles.map((profile) => ({
        profile,
        r1cs: String(profile.r1csPerHash),
        bootle16: String(profile.bootle16PerHash),
      })),
      [
        {
          profile: pedersen!,
          r1cs: formatConstraintCount(pedersenPathR1cs),
          bootle16: formatConstraintCount(pedersenPathBootle),
          pathWeight: Number(pedersenPathR1cs),
        },
        {
          profile: poseidon!,
          r1cs: formatConstraintCount(poseidonPathR1cs),
          bootle16: formatConstraintCount(poseidonPathBootle),
          pathWeight: Number(poseidonPathR1cs),
        },
      ],
      [
        {
          profile: pedersen!,
          r1cs: formatConstraintCount(pedersenTreeR1cs),
          bootle16: formatConstraintCount(pedersenTreeBootle),
          treeWeight: Number(pedersenTreeR1cs),
        },
        {
          profile: poseidon!,
          r1cs: formatConstraintCount(poseidonTreeR1cs),
          bootle16: formatConstraintCount(poseidonTreeBootle),
          treeWeight: Number(poseidonTreeR1cs),
        },
      ],
      scenario.depth,
      theme
    );
  }, [
    pedersen,
    pedersenPathBootle,
    pedersenPathR1cs,
    pedersenTreeBootle,
    pedersenTreeR1cs,
    poseidon,
    poseidonPathBootle,
    poseidonPathR1cs,
    poseidonTreeBootle,
    poseidonTreeR1cs,
    scenario.depth,
    scenario.profiles,
    theme,
  ]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    fitCameraToBounds(camera, canvas, { minX: 20, minY: 20, maxX: 860, maxY: 760 }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  const handleCopyShareUrl = useCallback(() => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the current depth comparison');
  }, []);

  const handleCopyHashUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('cc');
    url.hash = `constraint-counter|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment');
  }, [buildShareState]);

  const handleCopyEmbed = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'constraint-counter');
    url.searchParams.set('cc', encodeState(buildShareState()));
    url.hash = '';
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  }, [buildShareState]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-constraint-counter.png', showDownloadToast);
  }, [camera, handleFitToView]);

  const handleAuditJson = useCallback(() => {
    copyToClipboard(JSON.stringify({
      demo: 'constraint-counter',
      depth: scenario.depth,
      pedersen: {
        perHash: pedersen,
        pathR1cs: pedersenPathR1cs.toString(),
        pathBootle16: pedersenPathBootle.toString(),
        treeR1cs: pedersenTreeR1cs.toString(),
        treeBootle16: pedersenTreeBootle.toString(),
      },
      poseidon: {
        perHash: poseidon,
        pathR1cs: poseidonPathR1cs.toString(),
        pathBootle16: poseidonPathBootle.toString(),
        treeR1cs: poseidonTreeR1cs.toString(),
        treeBootle16: poseidonTreeBootle.toString(),
      },
    }, null, 2));
    showToast('Audit JSON copied');
  }, [
    pedersen,
    pedersenPathBootle,
    pedersenPathR1cs,
    pedersenTreeBootle,
    pedersenTreeR1cs,
    poseidon,
    poseidonPathBootle,
    poseidonPathR1cs,
    poseidonTreeBootle,
    poseidonTreeR1cs,
    scenario.depth,
  ]);

  return (
    <DemoLayout onEmbedFitToView={handleFitToView}>
      <DemoSidebar width="compact">
        <ControlGroup label="Merkle Depth">
          <SliderControl label="Tree depth" value={depth} min={2} max={32} step={1} onChange={setDepth} editable />
          <ControlCard>
            <div className="control-kicker">Authentication path</div>
            <div className="control-value">{scenario.pathHashes.toString()} hashes</div>
            <div className="control-caption">One proof verification path</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Full tree build</div>
            <div className="control-value">{formatConstraintCount(scenario.internalHashes)}</div>
            <div className="control-caption">Internal hashes across the whole tree</div>
          </ControlCard>
        </ControlGroup>

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <SaveToGitHub demoId="constraint-counter" />
          <div className="control-button-grid">
            <ButtonControl label="Hash URL" onClick={handleCopyHashUrl} variant="secondary" />
            <ButtonControl label="Embed" onClick={handleCopyEmbed} variant="secondary" />
            <ButtonControl label="Export PNG" onClick={handleExportPng} variant="secondary" />
            <ButtonControl label="Audit JSON" onClick={handleAuditJson} variant="secondary" />
          </div>
        </ControlGroup>
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={handleDraw} camera={camera} onCanvas={(canvas) => { canvasElRef.current = canvas; }} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:constraint-counter" onReset={handleFitToView} />
      </DemoCanvasArea>

      <DemoAside width="narrow">
        <ControlGroup label="Savings">
          <ControlCard>
            <div className="control-kicker">Path savings</div>
            <div className="control-value" style={{ color: '#38bdf8' }}>
              {getSavingsRatio(pedersenPathR1cs, poseidonPathR1cs).toFixed(1)}x
            </div>
            <div className="control-caption">R1CS reduction on the Merkle path</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Tree-build savings</div>
            <div className="control-value" style={{ color: '#38bdf8' }}>
              {getSavingsRatio(pedersenTreeBootle, poseidonTreeBootle).toFixed(1)}x
            </div>
            <div className="control-caption">Bootle16 reduction over the full tree</div>
          </ControlCard>
        </ControlGroup>

        <ControlNote>
          Pedersen is a good commitment, but it is a poor Merkle hash inside zk circuits.
          Poseidon keeps the same two-input Merkle structure while dramatically reducing constraint count, which compounds at every tree level.
        </ControlNote>
      </DemoAside>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Pedersen vs Poseidon" />
    </DemoLayout>
  );
}
