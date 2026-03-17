import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SliderControl, ToggleControl, ButtonControl, ControlCard, ControlNote, NumberInputControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { buildWitness, evaluateCircuit, getExploitWitness, getR1CSRows, witnessSatisfiesAll } from './logic';
import { renderCircuit } from './renderer';

export function CircuitDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const [x, setX] = useState(3);
  const [y, setY] = useState(4);
  const [z, setZ] = useState(13);
  const [broken, setBroken] = useState(false);
  const [tOverride, setTOverride] = useState<number | null>(null);
  const [pipelineHash, setPipelineHash] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const witness = useMemo(() => (
    tOverride === null ? buildWitness(x, y, z) : { x, y, z, t: tOverride }
  ), [tOverride, x, y, z]);
  const constraints = useMemo(() => evaluateCircuit(witness, broken), [broken, witness]);
  const valid = useMemo(() => witnessSatisfiesAll(witness, broken), [broken, witness]);
  const exploit = useMemo(() => getExploitWitness(x, y), [x, y]);
  const rows = useMemo(() => getR1CSRows(broken), [broken]);

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'circuit' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      x?: number;
      y?: number;
      z?: number;
      t?: number;
      broken?: boolean;
      pipelineHash?: string;
    }>(rawHash);
    const raw = decodedHash ? null : getSearchParam('c');
    const decoded = decodeState<{
      x?: number;
      y?: number;
      z?: number;
      t?: number;
      broken?: boolean;
      pipelineHash?: string;
    }>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.x === 'number') setX(payload.x);
    if (typeof payload.y === 'number') setY(payload.y);
    if (typeof payload.z === 'number') setZ(payload.z);
    if (typeof payload.t === 'number') setTOverride(payload.t);
    if (typeof payload.broken === 'boolean') setBroken(payload.broken);
    if (typeof payload.pipelineHash === 'string') setPipelineHash(payload.pipelineHash);
  }, []);

  useEffect(() => {
    setEntry('circuit', {
      title: broken ? 'Underconstrained output' : 'Fully constrained circuit',
      body: broken
        ? `The z relation is missing, so z = ${witness.z} can drift while the remaining constraints still pass.`
        : `Both constraints are active, so the witness ${valid ? 'satisfies' : 'violates'} the full circuit.`,
      nextSteps: ['Toggle the broken circuit', 'Load the exploit witness', 'Compare the matrix rows'],
    });
  }, [broken, setEntry, valid, witness.z]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderCircuit(ctx, frame, witness, constraints, broken, theme);
  }, [broken, constraints, theme, witness]);

  const buildShareState = useCallback(() => ({
    x,
    y,
    z,
    t: tOverride,
    broken,
    pipelineHash: pipelineHash ?? undefined,
  }), [broken, pipelineHash, tOverride, x, y, z]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'circuit') return;
    setSearchParams({ c: encodeState(buildShareState()) });
  }, [buildShareState]);

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('c');
    url.hash = `circuit|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'circuit');
    url.searchParams.set('c', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-circuit.png';
    a.click();
    showDownloadToast('theora-circuit.png');
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'circuit',
      timestamp: new Date().toISOString(),
      witness: { x, y, z, t: witness.t },
      tOverride,
      broken,
      valid,
      constraints: constraints.map((c) => ({ label: c.label, satisfied: c.satisfied })),
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Witness values, constraint status & circuit mode');
  };

  return (
    <DemoLayout
      onEmbedReset={() => { setX(3); setY(4); setZ(13); setTOverride(null); setBroken(false); }}
      onEmbedFitToView={() => camera.reset()}
    >
      <DemoSidebar>
        <ControlGroup label="Witness">
          <SliderControl label="x" value={x} min={0} max={8} onChange={(value) => { setX(value); }} editable />
          <SliderControl label="y" value={y} min={0} max={12} onChange={(value) => { setY(value); }} editable />
          <SliderControl label="z (output)" value={z} min={0} max={200} onChange={(value) => { setZ(value); }} editable />
          <NumberInputControl
            label="t (intermediate wire)"
            value={tOverride ?? x * x}
            min={0}
            max={999}
            onChange={(value) => { setTOverride(value); }}
          />
          {tOverride !== null && (
            <ControlNote tone="default">
              t is manually overridden (expected: {x * x}). <button
                className="underline"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setTOverride(null)}
              >Reset to auto</button>
            </ControlNote>
          )}
          <ControlNote tone={valid ? 'success' : 'error'}>
            {valid ? 'Witness satisfies the active constraints.' : 'Witness violates at least one active constraint.'}
          </ControlNote>
        </ControlGroup>

        <ControlGroup label="Constraint Model">
          <ToggleControl label="Broken / underconstrained mode" checked={broken} onChange={setBroken} />
          <ButtonControl label="Load valid witness" onClick={() => { setTOverride(null); setZ(x * x + y); }} />
          <ButtonControl label="Load exploit witness" onClick={() => { setTOverride(null); setZ(exploit.z); }} variant="secondary" />
          {pipelineHash && (
            <ButtonControl label="Back to Pipeline" onClick={() => { window.location.hash = pipelineHash; }} variant="secondary" />
          )}
        </ControlGroup>

        <ControlGroup label="R1CS Rows">
          <div className="control-choice-list">
            {rows.map((row) => (
              <ControlCard key={row.label}>
                <span className="control-kicker">{row.label}</span>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>A: [{row.A.join(', ')}]</div>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>B: [{row.B.join(', ')}]</div>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>C: [{row.C.join(', ')}]</div>
              </ControlCard>
            ))}
          </div>
        </ControlGroup>

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
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:circuit" />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="R1CS Circuit" />
    </DemoLayout>
  );
}
