import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, SliderControl, ToggleControl, ButtonControl, ControlCard, ControlNote } from '@/components/shared/Controls';
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
    <DemoLayout>
      <DemoSidebar>
        <ControlGroup label="Witness">
          <SliderControl label="x" value={x} min={0} max={8} onChange={setX} />
          <SliderControl label="y" value={y} min={0} max={12} onChange={setY} />
          <SliderControl label="z" value={z} min={0} max={40} onChange={setZ} />
          <ControlNote tone={valid ? 'success' : 'error'}>
            {valid ? 'Witness satisfies the active constraints.' : 'Witness violates at least one active constraint.'}
          </ControlNote>
        </ControlGroup>

        <ControlGroup label="Constraint Model">
          <ToggleControl label="Broken / underconstrained mode" checked={broken} onChange={setBroken} />
          <ButtonControl label="Load valid witness" onClick={() => setZ(x * x + y)} />
          <ButtonControl label="Load exploit witness" onClick={() => setZ(exploit.z)} variant="secondary" />
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
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:circuit" />
      </DemoCanvasArea>
    </DemoLayout>
  );
}
