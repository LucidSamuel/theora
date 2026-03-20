import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import {
  ControlGroup,
  ButtonControl,
  ControlCard,
  ControlNote,
  NumberInputControl,
  SelectControl,
} from '@/components/shared/Controls';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast, showDownloadToast } from '@/lib/toast';
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
import {
  analyzeCircuit,
  buildDefaultCircuit,
  modifyWireValue,
  type PlonkCircuit,
} from './logic';
import { renderPlonk } from './renderer';

const GATE_OPTIONS = [
  { value: '0', label: 'Gate 0: Add (a + b = c)' },
  { value: '1', label: 'Gate 1: Mul (a × b = c)' },
  { value: '2', label: 'Gate 2: PubOut (a = 14)' },
];

const WIRE_OPTIONS: { value: 'a' | 'b' | 'c'; label: string }[] = [
  { value: 'a', label: 'Wire a (left)' },
  { value: 'b', label: 'Wire b (right)' },
  { value: 'c', label: 'Wire c (output)' },
];

interface SerializedState {
  gates?: Array<{ a: number; b: number; c: number }>;
}

export function PlonkDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const [circuit, setCircuit] = useState<PlonkCircuit>(() => buildDefaultCircuit());
  const [selectedGate, setSelectedGate] = useState('0');
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  // Restore URL state on mount
  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'plonk' ? hashState.state : null;
    const decodedHash = decodeStatePlain<SerializedState>(rawHash);
    const raw = decodedHash ? null : getSearchParam('plk');
    const decoded = decodeState<SerializedState>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;

    if (Array.isArray(payload.gates)) {
      const defaults = buildDefaultCircuit();
      const restored: PlonkCircuit = {
        ...defaults,
        gates: defaults.gates.map((gate, idx) => {
          const saved = payload.gates![idx];
          if (!saved) return gate;
          return {
            ...gate,
            a: typeof saved.a === 'number' ? saved.a : gate.a,
            b: typeof saved.b === 'number' ? saved.b : gate.b,
            c: typeof saved.c === 'number' ? saved.c : gate.c,
          };
        }),
      };
      setCircuit(restored);
    }
  }, []);

  const analysis = useMemo(() => analyzeCircuit(circuit), [circuit]);

  // Info panel reactive update
  useEffect(() => {
    const gateStatuses = analysis.gates
      .map((g, i) => `Gate ${i}: ${g.satisfied ? 'sat' : 'UNSAT'}`)
      .join(', ');
    const copyStatuses = analysis.copyConstraints
      .map((cc, i) => `Copy ${i}: ${cc.satisfied ? 'ok' : 'VIOLATED'}`)
      .join(', ');

    setEntry('plonk', {
      title: analysis.valid ? 'Circuit satisfied' : 'Circuit violated',
      body: analysis.valid
        ? `All ${analysis.gates.length} gate equations and ${analysis.copyConstraints.length} copy constraints are satisfied.`
        : `Issues — ${gateStatuses}; ${copyStatuses}.`,
      nextSteps: [
        'Edit wire values to break a gate equation',
        'Break a copy constraint with the button',
        'Reset to see the default satisfied circuit',
      ],
    });
  }, [analysis, setEntry]);

  const buildShareState = useCallback(
    (): SerializedState => ({
      gates: circuit.gates.map((g) => ({ a: g.a, b: g.b, c: g.c })),
    }),
    [circuit]
  );

  // Sync URL params
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'plonk') return;
    setSearchParams({ plk: encodeState(buildShareState()) });
  }, [buildShareState]);

  const gateIdx = parseInt(selectedGate, 10);
  const activeGate = circuit.gates[gateIdx]!;

  const handleWireChange = useCallback(
    (wire: 'a' | 'b' | 'c', value: number) => {
      setCircuit((prev) => modifyWireValue(prev, gateIdx, wire, value));
    },
    [gateIdx]
  );

  const handleReset = useCallback(() => {
    setCircuit(buildDefaultCircuit());
    setSelectedGate('0');
  }, []);

  const handleBreakCopyConstraint = useCallback(() => {
    // Corrupt gate0.c so it no longer matches gate1.a — both constraints break
    setCircuit((prev) => modifyWireValue(prev, 0, 'c', 99));
    showToast('Copy constraint broken', 'Gate 0 output now mismatches Gate 1 input');
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      renderPlonk(ctx, frame, analysis, theme);
    },
    [analysis, theme]
  );

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact current state');
  };

  const handleCopyHashUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('plk');
    url.hash = `plonk|${encodeStatePlain(buildShareState())}`;
    copyToClipboard(url.toString());
    showToast('Hash URL copied', 'State is encoded in the fragment — no server needed');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'plonk');
    url.searchParams.set('plk', encodeState(buildShareState()));
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

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
      a.download = 'theora-plonk.png';
      a.click();
      showDownloadToast('theora-plonk.png');

      // Restore camera
      camera.panX = prevPanX;
      camera.panY = prevPanY;
      camera.zoom = prevZoom;
    });
  };

  const handleCopyAuditSummary = () => {
    const payload = {
      demo: 'plonk',
      timestamp: new Date().toISOString(),
      gates: analysis.gates.map((g, i) => ({
        index: i,
        label: g.label,
        selectors: { qL: g.qL, qR: g.qR, qO: g.qO, qM: g.qM, qC: g.qC },
        wires: { a: g.a, b: g.b, c: g.c },
        satisfied: g.satisfied,
        equation: g.equation,
      })),
      copyConstraints: analysis.copyConstraints.map((cc) => ({
        from: `gate${cc.from.gate}.${cc.from.wire}`,
        to: `gate${cc.to.gate}.${cc.to.wire}`,
        satisfied: cc.satisfied,
      })),
      valid: analysis.valid,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Gate selectors, wire values, copy constraints & validity');
  };

  const handleFitToView = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    // Compute bounds: gate area + badge below + copy constraint arrow region to the right
    const gateH = 112;
    const gateGap = 56;
    const totalGatesH = analysis.gates.length * (gateH + gateGap) - gateGap;
    const badgeH = 48;
    const bottomY = 64 + totalGatesH + 20 + badgeH + 24;
    fitCameraToBounds(camera, canvas, {
      minX: 60,
      minY: 32,
      maxX: 80 + 320 + 260, // gate right edge + arrow + legend area
      maxY: bottomY,
    });
  }, [analysis.gates.length, camera]);

  return (
    <DemoLayout
      onEmbedReset={handleReset}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        <ControlGroup label="Select Gate">
          <SelectControl
            label="Active gate"
            value={selectedGate}
            options={GATE_OPTIONS}
            onChange={setSelectedGate}
          />
        </ControlGroup>

        <ControlGroup label={`Gate ${gateIdx} Wire Values`}>
          <ControlCard>
            <span className="control-kicker">{activeGate.label}</span>
          </ControlCard>
          {WIRE_OPTIONS.map(({ value: wire, label }) => (
            <NumberInputControl
              key={wire}
              label={label}
              value={activeGate[wire]}
              min={-999}
              max={999}
              onChange={(v) => handleWireChange(wire, v)}
            />
          ))}
          <ControlNote tone={analysis.gates[gateIdx]?.satisfied ? 'success' : 'error'}>
            {analysis.gates[gateIdx]?.satisfied
              ? 'Gate equation satisfied.'
              : `Gate equation violated: ${analysis.gates[gateIdx]?.equation}`}
          </ControlNote>
        </ControlGroup>

        <ControlGroup label="Circuit Status">
          <ControlNote tone={analysis.valid ? 'success' : 'error'}>
            {analysis.valid
              ? 'All gates and copy constraints satisfied.'
              : !analysis.allGatesSatisfied && !analysis.allCopiesSatisfied
              ? 'Gate equations and copy constraints violated.'
              : !analysis.allGatesSatisfied
              ? 'One or more gate equations violated.'
              : 'One or more copy constraints violated.'}
          </ControlNote>

          <div className="flex flex-col gap-3">
            {analysis.gates.map((g, i) => (
              <ControlCard key={i} tone={g.satisfied ? 'success' : 'error'}>
                <span className="control-kicker">Gate {i}: {g.label}</span>
                <div
                  className="control-caption"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                >
                  {g.equation}
                </div>
                <div
                  className="control-caption"
                  style={{ color: g.satisfied ? 'var(--status-success)' : 'var(--status-error)' }}
                >
                  {g.satisfied ? 'Satisfied' : 'Violated'}
                </div>
              </ControlCard>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {analysis.copyConstraints.map((cc, i) => (
              <ControlCard key={i} tone={cc.satisfied ? 'success' : 'error'}>
                <span className="control-kicker">Copy {i}</span>
                <div
                  className="control-caption"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                >
                  gate{cc.from.gate}.{cc.from.wire} = gate{cc.to.gate}.{cc.to.wire}
                </div>
                <div
                  className="control-caption"
                  style={{ color: cc.satisfied ? 'var(--status-success)' : 'var(--status-error)' }}
                >
                  {cc.satisfied ? 'Satisfied' : 'Violated'}
                </div>
              </ControlCard>
            ))}
          </div>
        </ControlGroup>

        <ControlGroup label="Actions">
          <ButtonControl label="Reset to default" onClick={handleReset} />
          <ButtonControl
            label="Break a copy constraint"
            onClick={handleBreakCopyConstraint}
            variant="secondary"
          />
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
        <AnimatedCanvas
          draw={draw}
          camera={camera}
          onCanvas={(c) => (canvasElRef.current = c)}
          {...mergedHandlers}
        />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:plonk" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal
        isOpen={embedOpen}
        onClose={() => setEmbedOpen(false)}
        embedUrl={embedUrl}
        demoName="PLONK Arithmetization"
      />
    </DemoLayout>
  );
}
