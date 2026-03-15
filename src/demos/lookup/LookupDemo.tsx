import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedCanvas, type FrameInfo } from '@/components/shared/AnimatedCanvas';
import { CanvasToolbar } from '@/components/shared/CanvasToolbar';
import { DemoLayout, DemoSidebar, DemoCanvasArea } from '@/components/shared/DemoLayout';
import { ControlGroup, TextInput, ButtonControl, ControlCard, ControlNote } from '@/components/shared/Controls';
import { useCanvasCamera } from '@/hooks/useCanvasCamera';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { mergeCanvasHandlers } from '@/hooks/useMergedHandlers';
import { useTheme } from '@/hooks/useTheme';
import { useInfoPanel } from '@/components/layout/InfoContext';
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

  return (
    <DemoLayout>
      <DemoSidebar>
        <ControlGroup label="Lookup Table">
          <TextInput value={tableInput} onChange={setTableInput} placeholder="1,2,3,5,8,13" />
        </ControlGroup>

        <ControlGroup label="Wire Values">
          <TextInput value={wireInput} onChange={setWireInput} placeholder="2,5,8" />
          <ButtonControl label="Load failing example" onClick={() => setWireInput('2,5,21')} variant="secondary" />
          <ButtonControl label="Load multiplicity clash" onClick={() => setWireInput('2,2,2,8')} variant="secondary" />
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
      </DemoSidebar>

      <DemoCanvasArea>
        <AnimatedCanvas draw={draw} camera={camera} {...mergedHandlers} />
        <CanvasToolbar camera={camera} storageKey="theora:toolbar:lookup" />
      </DemoCanvasArea>
    </DemoLayout>
  );
}
