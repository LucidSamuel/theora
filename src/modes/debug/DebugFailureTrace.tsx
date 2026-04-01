import type { FailureTrace } from './dsl/types';

interface DebugFailureTraceProps {
  trace: FailureTrace | null;
}

export function DebugFailureTrace({ trace }: DebugFailureTraceProps) {
  if (!trace) return null;

  return (
    <div>
      {/* Root cause card */}
      <div
        className="control-card"
        style={{ borderLeft: '3px solid var(--status-error)' }}
      >
        <div
          className="text-[10px] font-mono uppercase mb-1"
          style={{ color: 'var(--status-error)', letterSpacing: '0.04em' }}
        >
          Root Cause
        </div>
        <div
          className="text-[11px] font-mono mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Wire &lsquo;{trace.rootCause.wireName}&rsquo;
        </div>
        <div
          className="text-[10px]"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}
        >
          {trace.rootCause.explanation}
        </div>
      </div>

      {/* Trace path */}
      {trace.traceBack.length > 1 && (
        <div className="mt-2">
          <div
            className="text-[10px] font-mono uppercase mb-1"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
          >
            Trace Path
          </div>
          <div className="flex flex-col gap-0.5">
            {trace.traceBack.map((node, i) => (
              <div
                key={node.wireId}
                className="flex items-center gap-1.5 text-[10px] font-mono"
                style={{
                  color: node.constraintStatus === 'failed'
                    ? 'var(--status-error)'
                    : 'var(--text-muted)',
                  paddingLeft: i * 8,
                }}
              >
                {i > 0 && <span style={{ opacity: 0.4 }}>└─</span>}
                <span>{node.wireName}</span>
                <span style={{ opacity: 0.5 }}>= {String(node.value)}</span>
                {node.constraintStatus === 'failed' && (
                  <span style={{ color: 'var(--status-error)' }}>✗</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
