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
import { ShareSaveDropdown } from '@/components/shared/ShareSaveDropdown';
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
import { exportCanvasPng } from '@/lib/canvas';
import {
  analyzeCircuit,
  buildDefaultCircuit,
  modifyWireValue,
  type PlonkCircuit,
} from './logic';
import { buildPermutation, computeGrandProduct } from './permutation';
import { linearize } from './linearization';
import { renderPlonk } from './renderer';
import { renderPermutation } from './permutationRenderer';
import { renderLinearization } from './linearizationRenderer';
import {
  BUILTIN_GATES,
  buildCustomCircuit,
  convertToStandardPlonk,
  estimateConstraintCost,
  buildExampleCircuits,
  describeGate,
  degreeSummary,
  type CustomGateType,
} from './customGates';
import { renderCustomGates } from './customGatesRenderer';
import { renderCost } from './costRenderer';

// ── Constants ─────────────────────────────────────────────────────────────────

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

type TabId = 'gates' | 'permutation' | 'linearization' | 'custom-gates' | 'cost';

const CUSTOM_GATE_TYPE_OPTIONS: { value: CustomGateType; label: string }[] = [
  { value: 'add', label: 'Addition' },
  { value: 'mul', label: 'Multiplication' },
  { value: 'bool', label: 'Boolean' },
  { value: 'range4', label: 'Range-4' },
  { value: 'poseidon', label: 'Poseidon S-box' },
  { value: 'ec_add', label: 'EC Point Add' },
  { value: 'custom', label: 'Custom' },
];

const FIELD_SIZE = 101n;

// ── Serialized state ──────────────────────────────────────────────────────────

interface SerializedState {
  gates?: Array<{ a: number; b: number; c: number }>;
  tab?: TabId;
  beta?: number;
  gamma?: number;
  selectedStep?: number;
  challengePoint?: number;
  customGateTypes?: CustomGateType[];
  customWires?: Array<{ a: number; b: number; c: number }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlonkDemo(): JSX.Element {
  const { theme } = useTheme();
  const camera = useCanvasCamera();
  const interaction = useCanvasInteraction();
  const mergedHandlers = mergeCanvasHandlers(interaction, camera);
  const { setEntry } = useInfoPanel();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // Core circuit state
  const [circuit, setCircuit] = useState<PlonkCircuit>(() => buildDefaultCircuit());
  const [selectedGate, setSelectedGate] = useState('0');
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('gates');

  // Permutation tab state
  const [beta, setBeta] = useState(2n);
  const [gamma, setGamma] = useState(3n);
  const [selectedStep, setSelectedStep] = useState(-1);

  // Linearization tab state
  const [challengePoint, setChallengePoint] = useState(7n);

  // Custom gates tab state
  const [customGateTypes, setCustomGateTypes] = useState<CustomGateType[]>(['add', 'mul', 'bool']);
  const [customWires, setCustomWires] = useState<{ a: number; b: number; c: number }[]>([
    { a: 3, b: 4, c: 7 },
    { a: 3, b: 4, c: 12 },
    { a: 1, b: 0, c: 0 },
  ]);

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

    if (payload.tab) setActiveTab(payload.tab);
    if (typeof payload.beta === 'number') setBeta(BigInt(payload.beta));
    if (typeof payload.gamma === 'number') setGamma(BigInt(payload.gamma));
    if (typeof payload.selectedStep === 'number') setSelectedStep(payload.selectedStep);
    if (typeof payload.challengePoint === 'number') setChallengePoint(BigInt(payload.challengePoint));
    if (Array.isArray(payload.customGateTypes)) setCustomGateTypes(payload.customGateTypes);
    if (Array.isArray(payload.customWires)) setCustomWires(payload.customWires);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────────

  const analysis = useMemo(() => analyzeCircuit(circuit), [circuit]);

  const permMapping = useMemo(
    () => buildPermutation(circuit.gates, circuit.copyConstraints),
    [circuit],
  );

  const permResult = useMemo(
    () => computeGrandProduct(circuit.gates, permMapping, beta, gamma, FIELD_SIZE),
    [circuit.gates, permMapping, beta, gamma],
  );

  const linResult = useMemo(
    () => linearize(circuit.gates, challengePoint, FIELD_SIZE),
    [circuit.gates, challengePoint],
  );

  // Custom gates computed state
  const customCircuit = useMemo(() => {
    const defs = customGateTypes.map((t) => BUILTIN_GATES[t]);
    return buildCustomCircuit(defs, customWires, []);
  }, [customGateTypes, customWires]);

  const standardConversion = useMemo(() => convertToStandardPlonk(customCircuit), [customCircuit]);
  const costComparison = useMemo(() => estimateConstraintCost(customCircuit), [customCircuit]);
  const degSummary = useMemo(() => degreeSummary(customCircuit), [customCircuit]);
  const exampleCircuits = useMemo(() => buildExampleCircuits(), []);

  // Step selector options for permutation tab
  const stepOptions = useMemo(() => {
    const opts = [{ value: '-1', label: 'None' }];
    for (let i = 0; i < circuit.gates.length; i++) {
      opts.push({ value: String(i), label: `Gate ${i}` });
    }
    return opts;
  }, [circuit.gates.length]);

  // ── Info panel ───────────────────────────────────────────────────────────────

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
        'Use the Permutation tab to inspect the grand product accumulator',
        'Use the Linearization tab to see degree reduction in action',
      ],
    });
  }, [analysis, setEntry]);

  // ── Share state ───────────────────────────────────────────────────────────────

  const buildShareState = useCallback(
    (): SerializedState => ({
      gates: circuit.gates.map((g) => ({ a: g.a, b: g.b, c: g.c })),
      tab: activeTab,
      beta: Number(beta),
      gamma: Number(gamma),
      selectedStep,
      challengePoint: Number(challengePoint),
      customGateTypes,
      customWires,
    }),
    [circuit, activeTab, beta, gamma, selectedStep, challengePoint, customGateTypes, customWires],
  );

  // Sync URL params
  useEffect(() => {
    const hashState = getHashState();
    if (hashState?.demo === 'plonk') return;
    setSearchParams({ plk: encodeState(buildShareState()) });
  }, [buildShareState]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const gateIdx = parseInt(selectedGate, 10);
  const activeGate = circuit.gates[gateIdx]!;

  const handleWireChange = useCallback(
    (wire: 'a' | 'b' | 'c', value: number) => {
      setCircuit((prev) => modifyWireValue(prev, gateIdx, wire, value));
    },
    [gateIdx],
  );

  const handleReset = useCallback(() => {
    setCircuit(buildDefaultCircuit());
    setSelectedGate('0');
    setBeta(2n);
    setGamma(3n);
    setSelectedStep(-1);
    setChallengePoint(7n);
    setCustomGateTypes(['add', 'mul', 'bool']);
    setCustomWires([
      { a: 3, b: 4, c: 7 },
      { a: 3, b: 4, c: 12 },
      { a: 1, b: 0, c: 0 },
    ]);
    showToast('Reset to defaults');
  }, []);

  const handleBreakCopyConstraint = useCallback(() => {
    setCircuit((prev) => modifyWireValue(prev, 0, 'c', 99));
    showToast('Copy constraint broken', 'Gate 0 output now mismatches Gate 1 input');
  }, []);

  // ── Draw callback ─────────────────────────────────────────────────────────────

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
      if (activeTab === 'gates') {
        renderPlonk(ctx, frame, analysis, theme);
      } else if (activeTab === 'permutation') {
        renderPermutation(ctx, frame, {
          result: permResult,
          gates: circuit.gates,
          selectedStep,
          fieldSize: FIELD_SIZE,
        }, theme);
      } else if (activeTab === 'linearization') {
        renderLinearization(ctx, frame, {
          result: linResult,
          fieldSize: FIELD_SIZE,
        }, theme);
      } else if (activeTab === 'custom-gates') {
        renderCustomGates(ctx, frame, {
          circuit: customCircuit,
          standardPlonkCount: standardConversion.gates.length,
          degreeSummary: degSummary,
        }, theme);
      } else if (activeTab === 'cost') {
        renderCost(ctx, frame, {
          comparison: costComparison,
        }, theme);
      }
    },
    [activeTab, analysis, permResult, linResult, circuit.gates, selectedStep, theme, customCircuit, standardConversion, degSummary, costComparison],
  );

  // ── Share actions ─────────────────────────────────────────────────────────────

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
    exportCanvasPng(canvas, camera, handleFitToView, 'theora-plonk.png', showDownloadToast);
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
      permutation: {
        beta: Number(beta),
        gamma: Number(gamma),
        finalProduct: Number(permResult.finalProduct),
        satisfied: permResult.satisfied,
      },
      linearization: {
        challengePoint: Number(challengePoint),
        wireEvals: {
          a: Number(linResult.wireEvals.a),
          b: Number(linResult.wireEvals.b),
          c: Number(linResult.wireEvals.c),
        },
        consistent: linResult.consistent,
        fullCheckValue: Number(linResult.fullCheckValue),
        linearizedCheckValue: Number(linResult.linearizedCheckValue),
      },
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Gate selectors, permutation, and linearization data');
  };

  const handleFitToView = useCallback(
    (options?: { instant?: boolean }) => {
      const canvas = canvasElRef.current;
      if (!canvas) return;

      if (activeTab === 'gates') {
        const gateH = 112;
        const gateGap = 56;
        const totalGatesH = analysis.gates.length * (gateH + gateGap) - gateGap;
        const badgeH = 48;
        const bottomY = 64 + totalGatesH + 20 + badgeH + 24;
        fitCameraToBounds(
          camera,
          canvas,
          { minX: 60, minY: 32, maxX: 80 + 320 + 260, maxY: bottomY },
          options?.instant ? { durationMs: 0 } : undefined,
        );
      } else if (activeTab === 'permutation') {
        // Permutation view: wire table (3 rows/gate) + bar chart + verdict
        const n = circuit.gates.length;
        const headerH = 28;
        const rowH = 32;
        const rowGap = 0;
        const tableH = headerH + n * 3 * (rowH + rowGap);
        const barEntries = n + 1;
        const barH = 22;
        const barGap = 10;
        const barsH = barEntries * (barH + barGap) + 36 + 16;
        const contentH = Math.max(tableH, barsH);
        fitCameraToBounds(
          camera,
          canvas,
          { minX: 40, minY: 56, maxX: 760, maxY: 72 + contentH + 40 },
          options?.instant ? { durationMs: 0 } : undefined,
        );
      } else if (activeTab === 'linearization') {
        // Linearization view: two rows of 5 terms + arrow + check box
        const termBoxH = 54;
        const arrowH = 56;
        const checkBoxH = 56;
        const totalH = 24 + termBoxH + 16 + arrowH + 16 + 24 + termBoxH + 24 + checkBoxH + 24;
        fitCameraToBounds(
          camera,
          canvas,
          { minX: 40, minY: 56, maxX: 780, maxY: 72 + totalH },
          options?.instant ? { durationMs: 0 } : undefined,
        );
      } else if (activeTab === 'custom-gates') {
        // Custom gates view: gate cards stacked vertically + right column
        const cardH = 100;
        const cardGap = 28;
        const n = customCircuit.gates.length;
        const cardsH = n > 0 ? n * (cardH + cardGap) + 48 : 60;
        const rightColW = 340 + 60 + 260;
        fitCameraToBounds(
          camera,
          canvas,
          { minX: 40, minY: 56, maxX: 60 + rightColW, maxY: 72 + cardsH },
          options?.instant ? { durationMs: 0 } : undefined,
        );
      } else if (activeTab === 'cost') {
        // Cost view: summary box + 4 system columns + notes
        const colW = 150;
        const colGap = 20;
        const colH = 32 + 20 + 140 + 140; // header + gap + bar + info
        const totalW = 200 + 40 + 4 * colW + 3 * colGap;
        fitCameraToBounds(
          camera,
          canvas,
          { minX: 40, minY: 56, maxX: 60 + totalW, maxY: 72 + colH + 80 },
          options?.instant ? { durationMs: 0 } : undefined,
        );
      }
    },
    [activeTab, analysis.gates.length, circuit.gates.length, customCircuit.gates.length, camera],
  );

  // Fit to view when tab changes
  useEffect(() => {
    handleFitToView({ instant: true });
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab styles removed — now handled by .demo-tab-bar / .demo-tab-btn CSS classes

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DemoLayout
      onEmbedReset={handleReset}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        {/* Tab selector */}
        <ControlGroup label="View">
          <div className="demo-tab-bar">
            {(
              [
                ['gates', 'Gates'],
                ['permutation', 'Perm'],
                ['linearization', 'Linear'],
                ['custom-gates', 'Custom'],
                ['cost', 'Cost'],
              ] as [TabId, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className="demo-tab-btn"
                onClick={() => setActiveTab(id)}
                aria-pressed={activeTab === id}
              >
                {label}
              </button>
            ))}
          </div>
        </ControlGroup>

        {/* ── Gates tab controls ─────────────────────────────────────────── */}
        {activeTab === 'gates' && (
          <>
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
              <ButtonControl label="Reset to Defaults" onClick={handleReset} variant="secondary" />
              <ButtonControl
                label="Break a copy constraint"
                onClick={handleBreakCopyConstraint}
                variant="secondary"
              />
            </ControlGroup>
          </>
        )}

        {/* ── Permutation tab controls ───────────────────────────────────── */}
        {activeTab === 'permutation' && (
          <>
            <ControlGroup label="Challenge Parameters">
              <NumberInputControl
                label="Beta (\u03b2)"
                value={Number(beta)}
                min={1}
                max={100}
                onChange={(v) => setBeta(BigInt(v))}
              />
              <NumberInputControl
                label="Gamma (\u03b3)"
                value={Number(gamma)}
                min={1}
                max={100}
                onChange={(v) => setGamma(BigInt(v))}
              />
              <ControlNote>
                Random challenges β, γ bind the grand product to actual wire values.
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Step Inspector">
              <SelectControl
                label="Inspect step"
                value={String(selectedStep)}
                options={stepOptions}
                onChange={(v) => setSelectedStep(parseInt(v, 10))}
              />
              {selectedStep >= 0 && selectedStep < permResult.steps.length && (
                <ControlCard tone={permResult.steps[selectedStep]!.productAfter === 1n ? 'success' : undefined}>
                  <span className="control-kicker">Gate {selectedStep}</span>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    Z before: {String(permResult.steps[selectedStep]!.productBefore)}
                  </div>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    Z after: {String(permResult.steps[selectedStep]!.productAfter)}
                  </div>
                </ControlCard>
              )}
            </ControlGroup>

            <ControlGroup label="Grand Product Status">
              <ControlCard tone={permResult.satisfied ? 'success' : 'error'}>
                <span className="control-kicker">Final Z(n)</span>
                <div
                  className="control-value"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {String(permResult.finalProduct)}
                </div>
                <div
                  className="control-caption"
                  style={{ color: permResult.satisfied ? 'var(--status-success)' : 'var(--status-error)' }}
                >
                  {permResult.satisfied ? 'Z(n) = 1 — permutation holds' : 'Z(n) \u2260 1 — permutation violated'}
                </div>
              </ControlCard>

              <ControlNote>
                Z(n) returns to 1 iff all copy constraints are satisfied.
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Copy Cycles">
              {permResult.mapping.cycles.length === 0 ? (
                <ControlNote>No non-trivial cycles (all identity).</ControlNote>
              ) : (
                permResult.mapping.cycles.map((cycle, ci) => (
                  <ControlCard key={ci}>
                    <span className="control-kicker">Cycle {ci}</span>
                    <div
                      className="control-caption"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    >
                      {cycle.join(' \u2192 ')}
                    </div>
                  </ControlCard>
                ))
              )}
            </ControlGroup>

            <ControlGroup label="Actions">
              <ButtonControl label="Reset to Defaults" onClick={handleReset} variant="secondary" />
              <ButtonControl
                label="Break a copy constraint"
                onClick={handleBreakCopyConstraint}
                variant="secondary"
              />
            </ControlGroup>
          </>
        )}

        {/* ── Linearization tab controls ─────────────────────────────────── */}
        {activeTab === 'linearization' && (
          <>
            <ControlGroup label="Challenge Point">
              <NumberInputControl
                label="Zeta (\u03b6)"
                value={Number(challengePoint)}
                min={1}
                max={100}
                onChange={(v) => setChallengePoint(BigInt(v))}
              />
              <ControlNote>
                Random evaluation point ζ is chosen by the verifier after seeing the commitment.
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Wire Evaluations at \u03b6">
              <ControlCard>
                <span className="control-kicker">a(ζ)</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {String(linResult.wireEvals.a)}
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">b(ζ)</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {String(linResult.wireEvals.b)}
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">c(ζ)</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {String(linResult.wireEvals.c)}
                </div>
              </ControlCard>
            </ControlGroup>

            <ControlGroup label="Degree Comparison">
              <ControlCard>
                <span className="control-kicker">C(x) degree (full)</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {linResult.fullSteps[0]!.totalDegree}
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">r(x) degree (linearized)</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {linResult.linearizedSteps[0]!.totalDegree}
                </div>
              </ControlCard>
            </ControlGroup>

            <ControlGroup label="Consistency Check">
              <ControlCard tone={linResult.consistent ? 'success' : 'error'}>
                <span className="control-kicker">C(ζ) vs r(ζ)</span>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  C(ζ) = {String(linResult.fullCheckValue)}
                </div>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  r(ζ) = {String(linResult.linearizedCheckValue)}
                </div>
                <div
                  className="control-caption"
                  style={{ color: linResult.consistent ? 'var(--status-success)' : 'var(--status-error)' }}
                >
                  {linResult.consistent ? 'Consistent — same evaluation' : 'Inconsistent'}
                </div>
              </ControlCard>
              <ControlNote tone={linResult.consistent ? 'success' : 'error'}>
                {linResult.consistent
                  ? 'r(\u03b6) = C(\u03b6): linearization is sound.'
                  : 'r(\u03b6) \u2260 C(\u03b6): check circuit state.'}
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Actions">
              <ButtonControl label="Reset to Defaults" onClick={handleReset} variant="secondary" />
            </ControlGroup>
          </>
        )}

        {/* ── Custom Gates tab controls ──────────────────────────────── */}
        {activeTab === 'custom-gates' && (
          <>
            <ControlGroup label="Gate List">
              {customGateTypes.map((gType, i) => {
                const gate = customCircuit.gates[i];
                const wires = customWires[i] ?? { a: 0, b: 0, c: 0 };
                return (
                  <ControlCard key={i} tone={gate?.satisfied ? 'success' : 'error'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span className="control-kicker" style={{ margin: 0, flex: 1 }}>
                        Gate {i}
                      </span>
                      {gate && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                            color: gate.satisfied ? 'var(--status-success)' : 'var(--status-error)',
                          }}
                        >
                          {gate.satisfied ? '\u2713 SAT' : '\u2717 UNSAT'}
                        </span>
                      )}
                    </div>
                    <SelectControl
                      label="Type"
                      value={gType}
                      options={CUSTOM_GATE_TYPE_OPTIONS}
                      onChange={(v) => {
                        const next = [...customGateTypes];
                        next[i] = v as CustomGateType;
                        setCustomGateTypes(next);
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <NumberInputControl
                        label="a"
                        value={wires.a}
                        min={-999}
                        max={999}
                        onChange={(v) => {
                          const next = [...customWires];
                          next[i] = { ...wires, a: v };
                          setCustomWires(next);
                        }}
                      />
                      <NumberInputControl
                        label="b"
                        value={wires.b}
                        min={-999}
                        max={999}
                        onChange={(v) => {
                          const next = [...customWires];
                          next[i] = { ...wires, b: v };
                          setCustomWires(next);
                        }}
                      />
                      <NumberInputControl
                        label="c"
                        value={wires.c}
                        min={-999}
                        max={999}
                        onChange={(v) => {
                          const next = [...customWires];
                          next[i] = { ...wires, c: v };
                          setCustomWires(next);
                        }}
                      />
                    </div>
                    {gate && (
                      <div
                        className="control-caption"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 4 }}
                      >
                        {describeGate(gate.definition)}
                      </div>
                    )}
                    <ButtonControl
                      label="Remove"
                      variant="secondary"
                      onClick={() => {
                        if (customGateTypes.length <= 1) return;
                        setCustomGateTypes((prev) => prev.filter((_, j) => j !== i));
                        setCustomWires((prev) => prev.filter((_, j) => j !== i));
                      }}
                    />
                  </ControlCard>
                );
              })}
              {customGateTypes.length < 8 && (
                <ButtonControl
                  label="Add Gate"
                  onClick={() => {
                    setCustomGateTypes((prev) => [...prev, 'add']);
                    setCustomWires((prev) => [...prev, { a: 0, b: 0, c: 0 }]);
                    showToast('Gate added');
                  }}
                />
              )}
            </ControlGroup>

            <ControlGroup label="Example Circuits">
              <ControlNote>Load a predefined circuit to explore different gate compositions.</ControlNote>
              {exampleCircuits.map((ex) => (
                <ButtonControl
                  key={ex.name}
                  label={ex.name}
                  variant="secondary"
                  onClick={() => {
                    setCustomGateTypes(ex.circuit.gates.map((g) => g.definition.type));
                    setCustomWires(ex.circuit.gates.map((g) => ({ a: g.a, b: g.b, c: g.c })));
                    showToast(`Loaded: ${ex.name}`);
                  }}
                />
              ))}
            </ControlGroup>

            <ControlGroup label="Conversion Summary">
              <ControlCard>
                <span className="control-kicker">Standard PLONK gates</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {standardConversion.gates.length}
                </div>
                <div className="control-caption">
                  {standardConversion.gates.length > customCircuit.gates.length
                    ? `Expanded from ${customCircuit.gates.length} custom gates (high-degree decomposition)`
                    : customCircuit.gates.length === standardConversion.gates.length
                    ? 'No expansion needed (all degree \u2264 2)'
                    : `Reduced from ${customCircuit.gates.length} gates`}
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">Degree distribution</span>
                {Object.entries(degSummary)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([deg, count]) => (
                    <div
                      key={deg}
                      className="control-caption"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    >
                      Degree {deg}: {count} gate{count !== 1 ? 's' : ''}
                    </div>
                  ))}
              </ControlCard>
            </ControlGroup>

            <ControlGroup label="Actions">
              <ButtonControl label="Reset to Defaults" onClick={handleReset} variant="secondary" />
            </ControlGroup>
          </>
        )}

        {/* ── Cost tab controls ──────────────────────────────────────── */}
        {activeTab === 'cost' && (
          <>
            <ControlGroup label="Circuit Info">
              <ControlCard>
                <span className="control-kicker">Circuit</span>
                <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {costComparison.circuitDescription}
                </div>
              </ControlCard>
              <ControlCard>
                <span className="control-kicker">Breakdown</span>
                <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  {costComparison.totalMultiplications} mul, {costComparison.totalAdditions} add, {costComparison.totalBooleanChecks} bool, {costComparison.totalCustomGates} custom
                </div>
              </ControlCard>
              <ControlNote>
                Cost data is computed from the Custom Gates tab circuit. Edit gates there to update.
              </ControlNote>
              <ControlNote>
                Proof-size and verifier-cost strings below are structural estimates, not hardware benchmarks. They compare protocol shape and scaling, not measured milliseconds.
              </ControlNote>
            </ControlGroup>

            <ControlGroup label="Cost Comparison">
              {costComparison.systems.map((sys) => {
                const minConstraints = Math.min(...costComparison.systems.map((s) => s.constraintCount));
                const isWinner = sys.constraintCount === minConstraints;
                return (
                  <ControlCard key={sys.system} tone={isWinner ? 'success' : undefined}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="control-kicker" style={{ margin: 0, flex: 1 }}>
                        {sys.system === 'plonk' ? 'PLONK' : sys.system === 'groth16' ? 'Groth16' : sys.system === 'halo2' ? 'Halo2' : 'Nova'}
                      </span>
                      {isWinner && (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--status-success)' }}>
                          LOWEST
                        </span>
                      )}
                    </div>
                    <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      Gates: {sys.gateCount} | Constraints: {sys.constraintCount}
                    </div>
                    <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      Copy: {sys.copyConstraints} | Proof: {sys.proofSize}
                    </div>
                    <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      Verifier: {sys.verifierCost}
                    </div>
                    <div
                      className="control-caption"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7, marginTop: 2 }}
                    >
                      {sys.notes}
                    </div>
                  </ControlCard>
                );
              })}
            </ControlGroup>

            <ControlGroup label="Actions">
              <ButtonControl label="Reset to Defaults" onClick={handleReset} variant="secondary" />
              <ButtonControl
                label="Edit in Custom Gates"
                variant="secondary"
                onClick={() => setActiveTab('custom-gates')}
              />
            </ControlGroup>
          </>
        )}

        <ShareSaveDropdown
          demoId="plonk"
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
