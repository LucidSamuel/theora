import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoAside, DemoCanvasArea, DemoLayout, DemoSidebar } from '@/components/shared/DemoLayout';
import { ControlCard, ControlGroup, ControlNote, SliderControl } from '@/components/shared/Controls';
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
import type { BarEntry } from './renderer';

interface UrlState {
  depth?: number;
}

export function ConstraintCounterDemo(): JSX.Element {
  const { theme } = useTheme();
  const { setEntry } = useInfoPanel();
  const { currentDemoAction } = useAttack();
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
  const profiles = getConstraintProfiles();

  useAttackActions(currentDemoAction, useMemo(() => ({
    SET_DEPTH: (payload) => {
      if (typeof payload === 'number' && Number.isFinite(payload)) {
        setDepth(Math.max(2, Math.min(32, payload)));
      }
    },
  }), [currentDemoAction]));

  // Compute costs for all 3 profiles
  const costs = useMemo(() => {
    return profiles.map((profile) => ({
      profile,
      pathR1cs: getPathConstraintCost(profile, scenario.depth, 'r1cs'),
      pathBootle: getPathConstraintCost(profile, scenario.depth, 'bootle16'),
      treeR1cs: getFullTreeConstraintCost(profile, scenario.internalHashes, 'r1cs'),
      treeBootle: getFullTreeConstraintCost(profile, scenario.internalHashes, 'bootle16'),
    }));
  }, [profiles, scenario]);

  useEffect(() => {
    setEntry('constraint-counter', {
      title: `Depth-${scenario.depth} Merkle cost comparison`,
      body: `Three hash functions compared: SHA-256 (~25k R1CS/hash) is impractical in circuits. Pedersen (~850) is viable but expensive. Poseidon (~63) uses native field operations for dramatic savings. At depth ${scenario.depth}, the difference compounds across ${formatConstraintCount(scenario.internalHashes)} internal hashes.`,
      nextSteps: ['Drag the depth slider to see costs scale', 'Compare the log-scale bars at depth 32', 'Note that SHA-256 is ~400x more expensive than Poseidon'],
    });
  }, [scenario.depth, scenario.internalHashes, setEntry]);

  const perHashEntries: BarEntry[] = useMemo(() => costs.map((c) => ({
    profile: c.profile,
    r1cs: String(c.profile.r1csPerHash),
    bootle16: String(c.profile.bootle16PerHash),
    weight: c.profile.r1csPerHash,
  })), [costs]);

  const pathEntries: BarEntry[] = useMemo(() => costs.map((c) => ({
    profile: c.profile,
    r1cs: formatConstraintCount(c.pathR1cs),
    bootle16: formatConstraintCount(c.pathBootle),
    weight: Number(c.pathR1cs),
  })), [costs]);

  const treeEntries: BarEntry[] = useMemo(() => costs.map((c) => ({
    profile: c.profile,
    r1cs: formatConstraintCount(c.treeR1cs),
    bootle16: formatConstraintCount(c.treeBootle),
    weight: Number(c.treeR1cs),
  })), [costs]);

  const handleDraw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
    renderConstraintCounter(
      ctx,
      frame,
      profiles,
      perHashEntries,
      pathEntries,
      treeEntries,
      scenario.depth,
      theme,
      worldMouse.x,
      worldMouse.y,
    );
  }, [camera, interaction.mouseX, interaction.mouseY, pathEntries, perHashEntries, profiles, scenario.depth, theme, treeEntries]);

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    fitCameraToBounds(camera, canvas, { minX: 20, minY: 20, maxX: 860, maxY: 820 }, options?.instant ? { durationMs: 0 } : undefined);
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
    const audit: Record<string, unknown> = { demo: 'constraint-counter', depth: scenario.depth };
    for (const c of costs) {
      audit[c.profile.name.toLowerCase().replace('-', '')] = {
        perHash: { r1cs: c.profile.r1csPerHash, bootle16: c.profile.bootle16PerHash },
        pathR1cs: c.pathR1cs.toString(),
        pathBootle16: c.pathBootle.toString(),
        treeR1cs: c.treeR1cs.toString(),
        treeBootle16: c.treeBootle.toString(),
      };
    }
    copyToClipboard(JSON.stringify(audit, null, 2));
    showToast('Audit JSON copied');
  }, [costs, scenario.depth]);

  // Savings ratios: Pedersen vs Poseidon (R1CS path) and SHA-256 vs Poseidon (R1CS path)
  const pedersenCost = costs[1]!;
  const poseidonCost = costs[2]!;
  const sha256Cost = costs[0]!;

  return (
    <DemoLayout onEmbedFitToView={handleFitToView}>
      <DemoSidebar width="compact" resetScrollKey={`${depth}`}>
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

        <ControlGroup label="Constraint Systems" ariaLabel="Toggle constraint systems info">
          <ControlNote>
            <strong>R1CS</strong> (Rank-1 Constraint System) is the standard arithmetic circuit format used by Groth16, Marlin, and most SNARKs.
          </ControlNote>
          <ControlNote>
            <strong>Bootle16</strong> is an inner-product argument system (Bootle et al. 2016) that achieves logarithmic proof size — the basis for Bulletproofs-style protocols.
          </ControlNote>
        </ControlGroup>

        <ShareSaveDropdown
          demoId="constraint-counter"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleAuditJson}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={handleDraw} camera={camera} onCanvas={(canvas) => { canvasElRef.current = canvas; }} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:constraint-counter" onReset={handleFitToView} />
      </DemoCanvasArea>

      <DemoAside width="narrow">
        <ControlGroup label="Savings (R1CS)">
          <ControlCard>
            <div className="control-kicker">Pedersen → Poseidon</div>
            <div className="control-value" style={{ color: '#38bdf8' }}>
              {getSavingsRatio(pedersenCost.pathR1cs, poseidonCost.pathR1cs).toFixed(1)}x
            </div>
            <div className="control-caption">Path reduction</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">SHA-256 → Poseidon</div>
            <div className="control-value" style={{ color: '#38bdf8' }}>
              {getSavingsRatio(sha256Cost.pathR1cs, poseidonCost.pathR1cs).toFixed(1)}x
            </div>
            <div className="control-caption">Path reduction</div>
          </ControlCard>
          <ControlCard>
            <div className="control-kicker">Full-tree savings</div>
            <div className="control-value" style={{ color: '#38bdf8' }}>
              {getSavingsRatio(sha256Cost.treeR1cs, poseidonCost.treeR1cs).toFixed(1)}x
            </div>
            <div className="control-caption">SHA-256 vs Poseidon over whole tree</div>
          </ControlCard>
        </ControlGroup>

        <ControlNote>
          SHA-256 decomposes bitwise ops (XOR, rotate, shift) into ~25,000 R1CS constraints per hash.
          Pedersen uses ~256 fixed-base scalar multiplications (~850).
          Poseidon operates natively over the proof field (~63).
        </ControlNote>
      </DemoAside>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Pedersen vs Poseidon vs SHA-256" />
    </DemoLayout>
  );
}
