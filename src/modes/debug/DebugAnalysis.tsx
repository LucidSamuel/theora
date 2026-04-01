import type { ConstraintAnalysis } from './dsl/types';

interface DebugAnalysisProps {
  analysis: ConstraintAnalysis | null;
}

export function DebugAnalysis({ analysis }: DebugAnalysisProps) {
  if (!analysis) return null;

  return (
    <div>
      {/* Unconstrained wire warnings */}
      {analysis.unconstrainedWires.length > 0 && (
        <div
          className="control-note mb-2"
          style={{ borderLeft: '3px solid var(--status-error)' }}
        >
          <div
            className="text-[11px] mb-1"
            style={{ color: 'var(--status-error)', fontWeight: 500 }}
          >
            Unconstrained wires detected
          </div>
          {analysis.unconstrainedWires.map((wire) => (
            <div
              key={wire.id}
              className="text-[10px] font-mono"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}
            >
              Wire &lsquo;{wire.name}&rsquo; (line {wire.sourceLine}) is not bound by any
              multiplication or wire-definition constraint. The prover can set it to any value.
            </div>
          ))}
        </div>
      )}

      {analysis.weakInputWires.length > 0 && (
        <div
          className="control-note mb-2"
          style={{ borderLeft: '3px solid var(--status-error)' }}
        >
          <div
            className="text-[11px] mb-1"
            style={{ color: 'var(--status-error)', fontWeight: 500 }}
          >
            Weak input constraints detected
          </div>
          {analysis.weakInputWires.map((wire) => (
            <div
              key={wire.id}
              className="text-[10px] font-mono"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}
            >
              Input &lsquo;{wire.name}&rsquo; (line {wire.sourceLine}) never reaches a
              multiplication constraint. If it should be derived from other wires,
              declare it with `wire` instead of `input`.
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>{analysis.wireCount} wires</span>
        <span>{analysis.constraintCount} constraints</span>
        <span>{analysis.inputCount} inputs</span>
        <span>{analysis.publicCount} public</span>
        <span
          style={{
            color: analysis.degreesOfFreedom > 0
              ? 'var(--status-error)'
              : 'var(--text-muted)',
          }}
        >
          DoF: {analysis.degreesOfFreedom}
        </span>
      </div>
    </div>
  );
}
