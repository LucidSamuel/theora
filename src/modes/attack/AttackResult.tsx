import type { AttackScenario } from './scenarios/types';

export function AttackResult({
  scenario,
  onReset,
  onExplore,
}: {
  scenario: AttackScenario;
  onReset: () => void;
  onExplore: () => void;
}) {
  const { conclusion } = scenario;
  const succeeded = conclusion.succeeded;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Outcome badge */}
      <div
        className="control-card"
        style={{
          borderLeft: `2px solid ${succeeded ? 'var(--status-error)' : 'var(--status-success)'}`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-mono font-medium uppercase"
            style={{
              color: succeeded ? 'var(--status-error)' : 'var(--status-success)',
              letterSpacing: '0.06em',
            }}
          >
            {succeeded ? 'Attack Succeeded' : 'Attack Failed'}
          </span>
        </div>

        <div
          className="text-[12px] mb-3"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
        >
          {conclusion.explanation}
        </div>

        <div className="mb-2">
          <div
            className="text-[10px] font-mono uppercase mb-1"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
          >
            Security guarantee
          </div>
          <div
            className="text-[11px]"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
          >
            {conclusion.securityGuarantee}
          </div>
        </div>

        {conclusion.realWorldExample && (
          <div className="mb-2">
            <div
              className="text-[10px] font-mono uppercase mb-1"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
            >
              Real-world example
            </div>
            <div
              className="text-[11px]"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              {conclusion.realWorldExample}
            </div>
          </div>
        )}

        {conclusion.furtherReading && (
          <div
            className="text-[10px]"
            style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
          >
            {conclusion.furtherReading}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="control-button-row">
        <button
          className="control-button"
          onClick={onReset}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--button-bg)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
          }}
        >
          Try Again
        </button>
        <button
          className="control-button"
          onClick={onExplore}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--button-bg)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
          }}
        >
          Explore Mode
        </button>
      </div>
    </div>
  );
}
