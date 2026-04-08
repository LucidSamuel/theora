import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SliderControl, ToggleControl, ButtonControl, ControlCard, ControlNote, NumberInputControl, SelectControl } from '@/components/shared/Controls';
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
import { showToast, showDownloadToast } from '@/lib/toast';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain, getHashState, getSearchParam, setSearchParams } from '@/lib/urlState';
import { fitCameraToBounds } from '@/lib/cameraFit';
import { exportCanvasPng } from '@/lib/canvas';
import {
  buildWitness,
  evaluateCircuit,
  getBootle16Breakdown,
  getExpectedT,
  getExploitWitness,
  getPlonkGates,
  getR1CSRows,
  getValidOutput,
  normalizeValue,
  normalizeWitness,
  witnessSatisfiesAll,
  type Witness,
} from './logic';
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
  const [viewMode, setViewMode] = useState<'r1cs' | 'bootle16' | 'plonk'>('r1cs');
  const [fieldSize, setFieldSize] = useState<number>(0); // 0 = integers (no modular arithmetic)
  const [sparseView, setSparseView] = useState(false);
  const [userConstraints, setUserConstraints] = useState<Array<{ wire: keyof Witness; value: number }>>([]);
  const [pendingConstraintWire, setPendingConstraintWire] = useState<keyof Witness>('z');
  const [pendingConstraintValue, setPendingConstraintValue] = useState(13);
  const [pipelineHash, setPipelineHash] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  // Attack mode bridge
  const { currentDemoAction } = useAttack();
  const exploit = useMemo(() => getExploitWitness(x, y, fieldSize || undefined), [x, y, fieldSize]);
  useAttackActions(currentDemoAction, useMemo(() => ({
    SET_BROKEN: (payload) => setBroken(payload as boolean),
    LOAD_EXPLOIT: () => { setTOverride(null); setZ(exploit.z); },
  }), [exploit.z, setBroken, setZ, setTOverride]));

  const expectedT = useMemo(() => getExpectedT(x, fieldSize || undefined), [x, fieldSize]);
  const validOutput = useMemo(() => getValidOutput(x, y, fieldSize || undefined), [x, y, fieldSize]);
  const witness = useMemo(() => (
    tOverride === null
      ? buildWitness(x, y, z, fieldSize || undefined)
      : normalizeWitness({ x, y, z, t: tOverride }, fieldSize || undefined)
  ), [tOverride, x, y, z, fieldSize]);
  const constraints = useMemo(() => evaluateCircuit(witness, broken, fieldSize || undefined), [broken, witness, fieldSize]);
  const rows = useMemo(() => getR1CSRows(broken), [broken]);
  const bootle16 = useMemo(() => getBootle16Breakdown(witness, broken, fieldSize || undefined), [broken, witness, fieldSize]);
  const plonkGates = useMemo(() => getPlonkGates(witness, broken, fieldSize || undefined), [broken, witness, fieldSize]);

  const userChecks = useMemo(() => {
    return userConstraints.map((uc) => ({
      label: fieldSize
        ? `assert ${uc.wire} ≡ ${normalizeValue(uc.value, fieldSize)} (mod ${fieldSize})`
        : `assert ${uc.wire} == ${uc.value}`,
      left: normalizeValue(witness[uc.wire], fieldSize || undefined),
      right: normalizeValue(uc.value, fieldSize || undefined),
      satisfied: normalizeValue(witness[uc.wire], fieldSize || undefined) === normalizeValue(uc.value, fieldSize || undefined),
    }));
  }, [fieldSize, userConstraints, witness]);

  const valid = useMemo(() => {
    return witnessSatisfiesAll(witness, broken, fieldSize || undefined) && userChecks.every((c) => c.satisfied);
  }, [broken, witness, fieldSize, userChecks]);

  useEffect(() => {
    const hashState = getHashState();
    const rawHash = hashState?.demo === 'circuit' ? hashState.state : null;
    const decodedHash = decodeStatePlain<{
      x?: number;
      y?: number;
      z?: number;
      t?: number;
      broken?: boolean;
      viewMode?: 'r1cs' | 'bootle16' | 'plonk';
      fieldSize?: number;
      pipelineHash?: string;
    }>(rawHash);
    const raw = decodedHash ? null : getSearchParam('c');
    const decoded = decodeState<{
      x?: number;
      y?: number;
      z?: number;
      t?: number;
      broken?: boolean;
      viewMode?: 'r1cs' | 'bootle16' | 'plonk';
      fieldSize?: number;
      pipelineHash?: string;
    }>(raw);
    const payload = decodedHash ?? decoded;

    if (!payload) return;
    if (typeof payload.x === 'number') setX(payload.x);
    if (typeof payload.y === 'number') setY(payload.y);
    if (typeof payload.z === 'number') setZ(payload.z);
    if (typeof payload.t === 'number') setTOverride(payload.t);
    if (typeof payload.broken === 'boolean') setBroken(payload.broken);
    if (payload.viewMode === 'bootle16' || payload.viewMode === 'r1cs' || payload.viewMode === 'plonk') setViewMode(payload.viewMode);
    if (typeof payload.fieldSize === 'number') setFieldSize(payload.fieldSize);
    if (typeof payload.pipelineHash === 'string') setPipelineHash(payload.pipelineHash);
  }, []);

  useEffect(() => {
    if (!fieldSize) return;
    setZ((prev) => normalizeValue(prev, fieldSize));
    setTOverride((prev) => (prev === null ? null : normalizeValue(prev, fieldSize)));
    setPendingConstraintValue((prev) => normalizeValue(prev, fieldSize));
  }, [fieldSize]);

  useEffect(() => {
    setEntry('circuit', {
      title: viewMode === 'bootle16'
        ? (broken ? 'Bootle16 view with a missing linear row' : 'Bootle16 view of the circuit')
        : viewMode === 'plonk'
        ? (broken ? 'Plonk gate view — output gate removed' : 'Plonk gate view of the circuit')
        : (broken ? 'Underconstrained output' : 'Fully constrained circuit'),
      body: viewMode === 'bootle16'
        ? broken
          ? 'The multiplication gate still constrains t = x·x, but the linear output row is gone, so z is no longer tied back to the computation.'
          : 'Bootle16 separates the multiplicative gate x·x=t from the linear relation z−t−y=0. This is the same computation shown in a structure closer to what Ragu actually proves.'
        : viewMode === 'plonk'
        ? broken
          ? 'gate_1 is removed so z is unconstrained. gate_0 still enforces x·x=t via the multiplication selector.'
          : 'Plonk gates encode each constraint as qM·a·b + qL·a + qR·b + qO·c + qC = 0 with selector coefficients.'
        : broken
          ? `The z relation is missing, so z = ${witness.z} can drift while the remaining constraints still pass.`
          : `Both constraints are active, so the witness ${valid ? 'satisfies' : 'violates'} the full circuit.`,
      nextSteps: ['Toggle between R1CS, Bootle16, and Plonk views', 'Load the exploit witness', 'Switch to a finite field to see modular arithmetic'],
    });
  }, [broken, setEntry, valid, viewMode, witness.z]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: FrameInfo) => {
    const worldMouse = camera.toWorld(interaction.mouseX, interaction.mouseY);
    renderCircuit(ctx, frame, witness, constraints, bootle16, plonkGates, viewMode, broken, theme, worldMouse.x, worldMouse.y);
  }, [camera, interaction, bootle16, broken, constraints, plonkGates, theme, viewMode, witness]);

  const buildShareState = useCallback(() => ({
    x,
    y,
    z,
    t: tOverride,
    broken,
    viewMode,
    fieldSize: fieldSize || undefined,
    pipelineHash: pipelineHash ?? undefined,
  }), [broken, fieldSize, pipelineHash, tOverride, viewMode, x, y, z]);

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
      fieldSize: fieldSize || null,
      valid,
      constraints: constraints.map((c) => ({ label: c.label, satisfied: c.satisfied })),
      userConstraints: userChecks.map((c) => ({ label: c.label, satisfied: c.satisfied })),
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
      onEmbedReset={() => {
        setX(3);
        setY(4);
        setZ(13);
        setTOverride(null);
        setBroken(false);
        setViewMode('r1cs');
        setFieldSize(0);
        setUserConstraints([]);
        setPendingConstraintWire('z');
        setPendingConstraintValue(13);
      }}
      onEmbedFitToView={handleFitToView}
    >
      <DemoSidebar>
        <ControlGroup label="Witness">
          <SliderControl label="x" value={x} min={0} max={8} onChange={(value) => { setX(value); }} editable />
          <SliderControl label="y" value={y} min={0} max={12} onChange={(value) => { setY(value); }} editable />
          <SliderControl
            label="z (output claim)"
            value={z}
            min={0}
            max={fieldSize > 0 ? fieldSize - 1 : 200}
            onChange={(value) => { setZ(value); }}
            editable
            hint={fieldSize > 0
              ? `Update z when x or y changes to keep the claim valid in GF(${fieldSize})`
              : 'Update z when x or y changes to keep constraints satisfied'}
          />
          <NumberInputControl
            label={tOverride === null ? 't (auto-computed from x)' : 't (intermediate wire)'}
            value={tOverride ?? expectedT}
            min={0}
            max={fieldSize > 0 ? fieldSize - 1 : 999}
            onChange={(value) => { setTOverride(value); }}
            readOnly={tOverride === null}
            onFocus={() => {
              if (tOverride === null) {
                setTOverride(expectedT);
              }
            }}
          />
          {tOverride !== null && (
            <ControlNote tone="default">
              t is manually overridden (expected: {expectedT}). <button
                className="underline"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setTOverride(null)}
              >Reset to auto</button>
            </ControlNote>
          )}
          <ControlNote tone={valid ? 'success' : 'error'}>
            {valid ? 'Witness satisfies the active constraints.' : 'Witness violates at least one active constraint.'}
          </ControlNote>
          <ControlCard>
            <span className="control-kicker">Witness vector</span>
            <div className="control-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              w = (1, {witness.x}, {witness.y}, {witness.t}, {witness.z})
            </div>
          </ControlCard>
        </ControlGroup>

        <ControlGroup label="Constraint Model">
          <SelectControl
            label="Representation"
            value={viewMode}
            options={[
              { value: 'r1cs', label: 'R1CS view' },
              { value: 'bootle16', label: 'Bootle16 view' },
              { value: 'plonk', label: 'Plonk gate view' },
            ]}
            onChange={(value) => setViewMode(value as 'r1cs' | 'bootle16' | 'plonk')}
          />
          <SelectControl
            label="Field"
            value={String(fieldSize)}
            options={[
              { value: '0', label: 'Integers (no mod)' },
              { value: '97', label: 'GF(97)' },
              { value: '101', label: 'GF(101)' },
              { value: '251', label: 'GF(251)' },
            ]}
            onChange={(value) => setFieldSize(parseInt(value, 10))}
          />
          <ToggleControl label="Remove z = t + y constraint" checked={broken} onChange={setBroken} />
          <ButtonControl label="Load valid witness" onClick={() => { setTOverride(null); setZ(validOutput); }} />
          <ButtonControl label="Load exploit witness" onClick={() => { setTOverride(null); setZ(exploit.z); }} variant="secondary" />
          {broken && (
            <ControlNote tone="default">
              Exploit z = {exploit.z} vs correct z = {validOutput}. Passes because the output constraint is removed.
            </ControlNote>
          )}
          <SelectControl
            label="Assertion wire"
            value={pendingConstraintWire}
            options={[
              { value: 'x', label: 'x' },
              { value: 'y', label: 'y' },
              { value: 't', label: 't' },
              { value: 'z', label: 'z' },
            ]}
            onChange={(value) => {
              const wire = value as keyof Witness;
              setPendingConstraintWire(wire);
              setPendingConstraintValue(witness[wire]);
            }}
          />
          <NumberInputControl
            label="Assertion value"
            value={pendingConstraintValue}
            min={fieldSize > 0 ? 0 : -999}
            max={fieldSize > 0 ? fieldSize - 1 : 999}
            onChange={setPendingConstraintValue}
          />
          <ButtonControl
            label="Add assertion"
            onClick={() => {
              setUserConstraints((prev) => [...prev, { wire: pendingConstraintWire, value: pendingConstraintValue }]);
            }}
            variant="secondary"
          />
          {userConstraints.length > 0 && (
            <div className="control-choice-list">
              {userChecks.map((check, i) => (
                <ControlCard key={i} tone={check.satisfied ? 'success' : 'error'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="control-kicker">{check.label}</span>
                    <button
                      onClick={() => setUserConstraints((prev) => prev.filter((_, j) => j !== i))}
                      style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    {fieldSize > 0
                      ? `${check.left} ${check.satisfied ? '≡' : '≢'} ${check.right} (mod ${fieldSize})`
                      : `${check.left} ${check.satisfied ? '=' : '≠'} ${check.right}`}
                    {' '}{check.satisfied ? '✓' : '✗'}
                  </div>
                </ControlCard>
              ))}
            </div>
          )}
          {pipelineHash && (
            <ButtonControl label="Back to Pipeline" onClick={() => { window.location.hash = pipelineHash; }} variant="secondary" />
          )}
        </ControlGroup>

        <ControlGroup label={viewMode === 'bootle16' ? 'Bootle16 Breakdown' : viewMode === 'plonk' ? 'Plonk Gates' : 'R1CS Rows'}>
          {viewMode === 'plonk' ? (
            <div className="control-choice-list">
              <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', opacity: 0.6, marginBottom: 4 }}>
                qM·a·b + qL·a + qR·b + qO·c + qC = 0
              </div>
              {plonkGates.map((gate) => (
                <ControlCard key={gate.label}>
                  <span className="control-kicker">{gate.label}</span>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    a={gate.a.wire}={gate.a.value}, b={gate.b.wire}={gate.b.value}, c={gate.c.wire}={gate.c.value}
                  </div>
                  <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>
                    [{gate.qM}, {gate.qL}, {gate.qR}, {gate.qO}, {gate.qC}]
                  </div>
                </ControlCard>
              ))}
              {broken && (
                <ControlNote tone="error">Output gate removed — z is unconstrained.</ControlNote>
              )}
            </div>
          ) : viewMode === 'bootle16' ? (
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
              <div className="control-caption" style={{ fontFamily: 'var(--font-mono)', opacity: 0.6, marginBottom: 4 }}>
                w = [1, x, y, t, z]
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <button
                  onClick={() => setSparseView(!sparseView)}
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {sparseView ? 'Show dense' : 'Show sparse'}
                </button>
              </div>
              {rows.map((row) => {
                const wireNames = ['1', 'x', 'y', 't', 'z'];
                const formatVec = (label: string, vec: number[]) => {
                  if (!sparseView) return `${label}: [${vec.join(', ')}]`;
                  const parts = vec.map((v, i) => v !== 0 ? `${wireNames[i]}:${v}` : null).filter(Boolean);
                  return `${label}: {${parts.join(', ')}}`;
                };
                return (
                  <ControlCard key={row.label}>
                    <span className="control-kicker">{row.label}</span>
                    <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>{formatVec('A', row.A)}</div>
                    <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>{formatVec('B', row.B)}</div>
                    <div className="control-caption" style={{ fontFamily: 'var(--font-mono)' }}>{formatVec('C', row.C)}</div>
                  </ControlCard>
                );
              })}
            </div>
          )}
        </ControlGroup>

        <ButtonControl label="Reset to Defaults" onClick={() => {
          setX(3); setY(4); setZ(13); setTOverride(null); setBroken(false); setViewMode('r1cs'); setFieldSize(0); setUserConstraints([]);
          showToast('Reset to defaults');
        }} variant="secondary" />

        <ShareSaveDropdown
          demoId="circuit"
          onCopyShareUrl={handleCopyShareUrl}
          onCopyHashUrl={handleCopyHashUrl}
          onCopyEmbed={handleCopyEmbed}
          onExportPng={handleExportPng}
          onCopyAudit={handleCopyAuditSummary}
        />
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} onCanvas={(c) => (canvasElRef.current = c)} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:circuit" onReset={handleFitToView} />
      </DemoCanvasArea>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="R1CS Circuit" />
    </DemoLayout>
  );
}
