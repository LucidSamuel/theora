import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, TextInput, ButtonControl, ControlCard, ControlNote } from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { analyzeLookup, parseNumberList } from './logic';
import { renderLookup } from './renderer';

export function LookupDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const [tableInput, setTableInput] = useState('1,2,3,5,8,13');
  const [wireInput, setWireInput] = useState('2,5,8');
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'lookup' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      table?: string;
      wires?: string;
    }>(rawHash);
    const raw = decodedHash ? null : getSearchParam('l');
    const decoded = decodeState<{
      table?: string;
      wires?: string;
    }>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.table === 'string') setTableInput(payload.table);
    if (typeof payload.wires === 'string') setWireInput(payload.wires);
  }, []);

  const analysis = useMemo(() => analyzeLookup(parseNumberList(tableInput), parseNumberList(wireInput)), [tableInput, wireInput]);

  useEffect(() => {
    setEntry('lookup', {
      title: analysis.passes ? 'Lookup passes' : 'Lookup mismatch',
      body: analysis.passes
        ? `The wire multiset [${analysis.wires.join(', ')}] is contained in the table [${analysis.table.join(', ')}].`
        : `Missing values: [${analysis.missing.join(', ')}], multiplicity issues: [${analysis.multiplicityMismatches.join(', ')}].`,
      nextSteps: ['Add a repeated wire value', 'Remove a table entry', 'Compare the sorted multisets'],
    });
  }, [analysis, setEntry]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    renderLookup(ctx, frame, analysis, theme);
  }, [analysis, theme]);

  const buildShareState = useCallback(() => ({
    table: tableInput,
    wires: wireInput,
  }), [tableInput, wireInput]);

  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'lookup') return;
    setSearchParams({ l: encodeState(buildShareState()) });
  }, [buildShareState]);

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('l');
    url.hash = `lookup|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'lookup');
    url.searchParams.set('l', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleExportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'theora-lookup.png';
    a.click();
    showDownloadToast('theora-lookup.png');
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'lookup',
      timestamp: new Date().toISOString(),
      table: analysis.table,
      wires: analysis.wires,
      passes: analysis.passes,
      missing: analysis.missing,
      multiplicityMismatches: analysis.multiplicityMismatches,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Lookup table, wire values & analysis results');
  };

  const handleFitToView = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const columnHeight = Math.max(120, Math.max(analysis.sortedTable.length, analysis.sortedWires.length) * 34 + 16);
    const rightX = width / 2 + 24;
    const badgeRight = rightX + 180 + 24 + 120;

    fitCameraToBounds(camera, canvas, {
      minX: 72,
      minY: 40,
      maxX: badgeRight,
      maxY: 96 + columnHeight + 16,
    });
  }, [analysis.sortedTable.length, analysis.sortedWires.length, camera]);

  return (
    <DemoLayout
      onEmbedReset={() => { setTableInput('1,2,3,5,8,13'); setWireInput('2,5,8'); }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        <ControlGroup label="Lookup Table">
          <TextInput value={tableInput} onChange={setTableInput} placeholder="1,2,3,5,8,13" />
        </ControlGroup>

        <ControlGroup label="Wire Values">
          <TextInput value={wireInput} onChange={setWireInput} placeholder="2,5,8" />
          <ButtonControl label="Load failing example" onClick={() => setWireInput('2,5,21')} variant="secondary" />
          <ButtonControl label="Load repeated lookup (passes)" onClick={() => setWireInput('2,2,2,8')} variant="secondary" />
        </ControlGroup>

        <ControlGroup label="Analysis">
          <ControlNote tone={analysis.passes ? 'success' : 'error'}>
            {analysis.passes ? 'Permutation-style lookup check passes.' : 'Lookup check fails.'}
          </ControlNote>
          <ControlCard>
            <span className="control-kicker">Sorted table</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              [{analysis.sortedTable.join(', ')}]
            </div>
          </ControlCard>
          <ControlCard>
            <span className="control-kicker">Sorted wires</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              [{analysis.sortedWires.join(', ')}]
            </div>
          </ControlCard>
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
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:lookup" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Lookup Arguments" />
    </DemoLayout>
  );
}
