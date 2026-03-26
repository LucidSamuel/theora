import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SliderControl, ToggleControl, ButtonControl, ControlCard, ControlNote, NumberInputControl, SelectControl } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { SaveToGitHub } from '@/components/shared/SaveToGitHub';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
import { buildWitness, evaluateCircuit, getBootle16Breakdown, getExploitWitness, getR1CSRows, witnessSatisfiesAll } from './logic';
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
  const [viewMode, setViewMode] = useState<'r1cs' | 'bootle16'>('r1cs');
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
  const bootle16 = useMemo(() => getBootle16Breakdown(witness, broken), [broken, witness]);

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'circuit' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      x?: number;
      y?: number;
      z?: number;
      t?: number;
      broken?: boolean;
      viewMode?: 'r1cs' | 'bootle16';
      pipelineHash?: string;
    }>(rawHash);
    const raw = decodedHash ? null : getSearchParam('c');
    const decoded = decodeState<{
      x?: number;
      y?: number;
      z?: number;
      t?: number;
      broken?: boolean;
      viewMode?: 'r1cs' | 'bootle16';
      pipelineHash?: string;
    }>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.x === 'number') setX(payload.x);
    if (typeof payload.y === 'number') setY(payload.y);
    if (typeof payload.z === 'number') setZ(payload.z);
    if (typeof payload.t === 'number') setTOverride(payload.t);
    if (typeof payload.broken === 'boolean') setBroken(payload.broken);
    if (payload.viewMode === 'bootle16' || payload.viewMode === 'r1cs') setViewMode(payload.viewMode);
    if (typeof payload.pipelineHash === 'string') setPipelineHash(payload.pipelineHash);
  }, []);

  useEffect(() => {
    setEntry('circuit', {
      title: viewMode === 'bootle16'
        ? (broken ? 'Bootle16 view with a missing linear row' : 'Bootle16 view of the circuit')
        : (broken ? 'Underconstrained output' : 'Fully constrained circuit'),
      body: viewMode === 'bootle16'
        ? broken
          ? 'The multiplication gate still constrains t = x·x, but the linear output row is gone, so z is no longer tied back to the computation.'
          : 'Bootle16 separates the multiplicative gate x·x=t from the linear relation z−t−y=0. This is the same computation shown in a structure closer to what Ragu actually proves.'
        : broken
          ? `The z relation is missing, so z = ${witness.z} can drift while the remaining constraints still pass.`
          : `Both constraints are active, so the witness ${valid ? 'satisfies' : 'violates'} the full circuit.`,
      nextSteps: ['Toggle between R1CS and Bootle16', 'Load the exploit witness', 'Compare how the output relation moves into the linear matrix'],
    });
  }, [broken, setEntry, valid, viewMode, witness.z]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderCircuit(ctx, frame, witness, constraints, bootle16, viewMode, broken, theme);
  }, [bootle16, broken, constraints, theme, viewMode, witness]);

  const buildShareState = useCallback(() => ({
    x,
    y,
    z,
    t: tOverride,
    broken,
    viewMode,
    pipelineHash: pipelineHash ?? undefined,
  }), [broken, pipelineHash, tOverride, viewMode, x, y, z]);

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
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-circuit.png', showDownloadToast);
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'circuit',
      timestamp: new Date().toISOString(),
      witness: { x, y, z, t: witness.t },
      tOverride,
      broken,
      viewMode,
      valid,
      constraints: constraints.map((c) => ({ label: c.label, satisfied: c.satisfied })),
      bootle16: viewMode === 'bootle16' ? bootle16 : undefined,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Witness values, constraint status & circuit mode');
  };

  const handleFitToView = useCallback((options?: { instant?: boolean }) => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    fitCameraToBounds(camera, canvas, {
      minX: 40,
      minY: 32,
      maxX: width - 40,
      maxY: height - 32,
    }, options?.instant ? { durationMs: 0 } : undefined);
  }, [camera]);

  return (
    <DemoLayout
      onEmbedReset={() => { setX(3); setY(4); setZ(13); setTOverride(null); setBroken(false); setViewMode('r1cs'); }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        <ControlGroup label="Witness">
          <SliderControl label="x" value={x} min={0} max={8} onChange={(value) => { setX(value); }} editable />
          <SliderControl label="y" value={y} min={0} max={12} onChange={(value) => { setY(value); }} editable />
          <SliderControl label="z (output)" value={z} min={0} max={200} onChange={(value) => { setZ(value); }} editable />
          <NumberInputControl
            label={tOverride === null ? 't (auto-computed from x)' : 't (intermediate wire)'}
            value={tOverride ?? x * x}
            min={0}
            max={999}
            onChange={(value) => { setTOverride(value); }}
            readOnly={tOverride === null}
            onFocus={() => {
              if (tOverride === null) {
                setTOverride(x * x);
              }
            }}
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
          <SelectControl
            label="Representation"
            value={viewMode}
            options={[
              { value: 'r1cs', label: 'R1CS view' },
              { value: 'bootle16', label: 'Bootle16 view' },
            ]}
            onChange={(value) => setViewMode(value as 'r1cs' | 'bootle16')}
          />
          <ToggleControl label="Broken / underconstrained mode" checked={broken} onChange={setBroken} />
          <ButtonControl label="Load valid witness" onClick={() => { setTOverride(null); setZ(x * x + y); }} />
          <ButtonControl label="Load exploit witness" onClick={() => { setTOverride(null); setZ(exploit.z); }} variant="secondary" />
          {pipelineHash && (
            <ButtonControl label="Back to Pipeline" onClick={() => { window.location.hash = pipelineHash; }} variant="secondary" />
          )}
        </ControlGroup>

        <ControlGroup label={viewMode === 'bootle16' ? 'Bootle16 Breakdown' : 'R1CS Rows'}>
          {viewMode === 'bootle16' ? (
            <div className="control-choice-list">
              {bootle16.multiplication.map((constraint) => (
                <ControlCard key={constraint.label}>
                  <span className="control-kicker">{constraint.label}</span>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    {constraint.leftWire} · {constraint.rightWire} = {constraint.outputWire}
                  </div>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    {constraint.left} · {constraint.right} = {constraint.output}
                  </div>
                </ControlCard>
              ))}
              {bootle16.linear.length > 0 ? bootle16.linear.map((row) => (
                <ControlCard key={row.label}>
                  <span className="control-kicker">{row.label}</span>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    [{row.coefficients.join(', ')}]
                  </div>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    {row.equation}
                  </div>
                </ControlCard>
              )) : (
                <ControlNote tone="error">Broken mode removes the linear row that ties z back to the multiplication witness.</ControlNote>
              )}
            </div>
          ) : (
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
          )}
        </ControlGroup>

        <ButtonControl label="Reset to Defaults" onClick={() => {
          setX(3); setY(4); setZ(13); setTOverride(null); setBroken(false); setViewMode('r1cs');
          showToast('Reset to defaults');
        }} variant="secondary" />

        <ControlGroup label="Share">
          <ButtonControl label="Copy Share URL" onClick={handleCopyShareUrl} />
          <SaveToGitHub demoId="circuit" />
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
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:circuit" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="R1CS Circuit" />
    </DemoLayout>
  );
}
