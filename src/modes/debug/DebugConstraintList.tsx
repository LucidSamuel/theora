import type { CheckResult, ConstraintCheckResult } from './dsl/types';

interface DebugConstraintListProps {
  checks: CheckResult | null;
  selectedConstraint: number | null;
  onSelectConstraint: (id: number | null) => void;
}

export function DebugConstraintList({ checks, selectedConstraint, onSelectConstraint }: DebugConstraintListProps) {
  if (!checks) {
    return (
      <div className="text-[11px]" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Evaluate the circuit to see constraint status.
      </div>
    );
  }

  const { allSatisfied, checks: constraintChecks } = checks;

  return (
    <div>
      {/* Summary */}
      <div
        className="control-note mb-2"
        style={{
          borderLeft: `3px solid ${allSatisfied ? 'var(--status-success)' : 'var(--status-error)'}`,
        }}
      >
        <span className="text-[11px]" style={{ color: allSatisfied ? 'var(--status-success)' : 'var(--status-error)' }}>
          {constraintChecks.length} constraint{constraintChecks.length !== 1 ? 's' : ''}:{' '}
          {checks.failedConstraints.length === 0
            ? 'all satisfied'
            : `${checks.failedConstraints.length} failed`}
        </span>
      </div>

      {/* Per-constraint cards */}
      <div className="flex flex-col gap-1.5">
        {constraintChecks.map((check) => (
          <ConstraintCard
            key={check.constraintId}
            check={check}
            selected={selectedConstraint === check.constraintId}
            onClick={() => onSelectConstraint(
              selectedConstraint === check.constraintId ? null : check.constraintId,
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ConstraintCard({
  check,
  selected,
  onClick,
}: {
  check: ConstraintCheckResult;
  selected: boolean;
  onClick: () => void;
}) {
  const { satisfied, sourceExpr, a_value, b_value, ab_product, c_value, mismatch } = check;

  return (
    <button
      onClick={onClick}
      className="control-card"
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        borderLeft: `3px solid ${satisfied ? 'var(--status-success)' : 'var(--status-error)'}`,
        outline: selected ? '2px solid var(--text-muted)' : 'none',
        outlineOffset: -1,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px]"
          style={{ color: satisfied ? 'var(--status-success)' : 'var(--status-error)' }}
        >
          {satisfied ? '✓' : '✗'}
        </span>
        <span
          className="text-[11px] font-mono"
          style={{ color: 'var(--text-primary)' }}
        >
          {sourceExpr.length > 30 ? sourceExpr.slice(0, 28) + '...' : sourceExpr}
        </span>
      </div>
      <div
        className="text-[9px] font-mono mt-1"
        style={{ color: 'var(--text-muted)' }}
      >
        A={String(a_value)}, B={String(b_value)}, A*B={String(ab_product)}, C={String(c_value)}
      </div>
      {mismatch && (
        <div className="text-[9px] mt-0.5" style={{ color: 'var(--status-error)' }}>
          Expected {String(mismatch.expected)}, got {String(mismatch.actual)}
        </div>
      )}
    </button>
  );
}
