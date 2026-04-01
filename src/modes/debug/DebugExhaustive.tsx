import { useState, useCallback } from 'react';
import type { CompilationResult, ASTNode, ExhaustiveResult } from './dsl/types';
import { exhaustiveCheck } from './dsl/exhaustive';

interface DebugExhaustiveProps {
  compilation: CompilationResult | null;
  ast: ASTNode[];
}

const MAX_SAFE_COMBINATIONS = 1_100_000;

export function DebugExhaustive({ compilation, ast }: DebugExhaustiveProps) {
  const [result, setResult] = useState<ExhaustiveResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const inputCount = compilation
    ? compilation.inputWires.length + compilation.publicWires.length
    : 0;
  const fieldSize = compilation ? Number(compilation.fieldSize) : 101;
  const totalCombinations = Math.pow(fieldSize, inputCount);
  const tooLarge = totalCombinations > MAX_SAFE_COMBINATIONS;

  const handleRun = useCallback(() => {
    if (!compilation) return;
    setRunning(true);
    setResult(null);
    setProgress(0);

    // Use setTimeout to allow UI to update before blocking computation
    setTimeout(() => {
      const res = exhaustiveCheck(compilation, ast, (tested, total) => {
        setProgress(Math.round((tested / total) * 100));
      });
      setResult(res);
      setRunning(false);
      setProgress(100);
    }, 50);
  }, [compilation, ast]);

  if (!compilation || inputCount === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleRun}
          disabled={running || tooLarge}
          style={{
            flex: 1,
            height: 30,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: running || tooLarge ? 'var(--border)' : 'var(--button-bg)',
            color: running || tooLarge ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: running || tooLarge ? 'not-allowed' : 'pointer',
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
          }}
        >
          {running ? `Testing... ${progress}%` : `Exhaustive Check (${totalCombinations.toLocaleString()} cases)`}
        </button>
      </div>

      {tooLarge && (
        <div className="text-[9px]" style={{ color: 'var(--text-muted)', lineHeight: 1.3 }}>
          Too many combinations ({totalCombinations.toLocaleString()}). Reduce inputs or field size.
        </div>
      )}

      {running && (
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: 'var(--border)',
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--text-muted)',
              transition: 'width 200ms ease',
            }}
          />
        </div>
      )}

      {result && (
        <div
          className="control-note"
          style={{
            borderLeft: `3px solid ${result.allSatisfied ? 'var(--status-success)' : 'var(--status-error)'}`,
          }}
        >
          <div
            className="text-[11px] mb-1"
            style={{
              color: result.allSatisfied ? 'var(--status-success)' : 'var(--status-error)',
              fontWeight: 500,
            }}
          >
            {result.allSatisfied ? 'All inputs satisfy constraints' : 'Counterexample found'}
          </div>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            <div>Tested: {result.tested.toLocaleString()} / {result.totalCombinations.toLocaleString()}</div>
            <div>Unique outputs: {result.uniqueOutputs.toLocaleString()}</div>
            <div>
              Input-determined: {result.isInputDetermined ? 'yes' : (
                <span style={{ color: 'var(--status-error)' }}>no (underconstrained)</span>
              )}
            </div>
          </div>
          {result.counterexample && (
            <div className="text-[10px] mt-1" style={{ color: 'var(--status-error)', lineHeight: 1.4 }}>
              {result.counterexample.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
