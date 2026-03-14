import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { ControlGroup, SliderControl, ToggleControl, ButtonControl } from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
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

  const witness = useMemo(() => buildWitness(x, y, z), [x, y, z]);
  const constraints = useMemo(() => evaluateCircuit(witness, broken), [broken, witness]);
  const valid = useMemo(() => witnessSatisfiesAll(witness, broken), [broken, witness]);
  const exploit = useMemo(() => getExploitWitness(x, y), [x, y]);
  const rows = useMemo(() => getR1CSRows(broken), [broken]);

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

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="w-[320px] shrink-0 overflow-y-auto demo-sidebar">
        <ControlGroup label="Witness">
          <SliderControl label="x" value={x} min={0} max={8} onChange={setX} />
          <SliderControl label="y" value={y} min={0} max={12} onChange={setY} />
          <SliderControl label="z" value={z} min={0} max={40} onChange={setZ} />
          <div className="text-xs" style={{ color: valid ? 'var(--status-success)' : 'var(--status-error)' }}>
            {valid ? 'Witness satisfies the active constraints.' : 'Witness violates at least one active constraint.'}
          </div>
        </ControlGroup>

        <ControlGroup label="Constraint Model">
          <ToggleControl label="Broken / underconstrained mode" checked={broken} onChange={setBroken} />
          <ButtonControl label="Load valid witness" onClick={() => setZ(x * x + y)} />
          <ButtonControl label="Load exploit witness" onClick={() => setZ(exploit.z)} variant="secondary" />
        </ControlGroup>

        <ControlGroup label="R1CS Rows">
          <div className="space-y-2 text-xs">
            {rows.map((row) => (
              <div key={row.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-element)' }}>
                <div style={{ color: 'var(--text-primary)' }}>{row.label}</div>
                <div style={{ color: 'var(--text-muted)' }}>A: [{row.A.join(', ')}]</div>
                <div style={{ color: 'var(--text-muted)' }}>B: [{row.B.join(', ')}]</div>
                <div style={{ color: 'var(--text-muted)' }}>C: [{row.C.join(', ')}]</div>
              </div>
            ))}
          </div>
        </ControlGroup>
      </div>

      <div className="flex-1 relative min-w-0 overflow-hidden demo-canvas-area">
        <AnimatedCanvas draw={draw} camera={camera} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:circuit" />
      </div>
    </div>
  );
}
