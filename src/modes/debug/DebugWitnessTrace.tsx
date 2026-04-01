import { useState } from 'react';
import type { WitnessStep } from './dsl/types';

interface DebugWitnessTraceProps {
  steps: WitnessStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function DebugWitnessTrace({ steps, currentStep, onStepChange }: DebugWitnessTraceProps) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  // Skip the "one = 1" step in display
  const displaySteps = steps.filter((s) => s.wireName !== 'one');

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-mono uppercase mb-2"
        style={{
          color: 'var(--text-muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          letterSpacing: '0.04em',
        }}
      >
        Witness Trace ({displaySteps.length} steps)
        <span>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <>
          {/* Step navigation */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => onStepChange(Math.max(0, currentStep - 1))}
              disabled={currentStep <= 0}
              style={{
                height: 26,
                borderRadius: 5,
                border: '1px solid var(--border)',
                background: 'var(--button-bg)',
                color: currentStep <= 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: currentStep <= 0 ? 'not-allowed' : 'pointer',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                padding: '0 8px',
                opacity: currentStep <= 0 ? 0.5 : 1,
              }}
            >
              ← Back
            </button>
            <span
              className="text-[10px] font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              {currentStep + 1} / {displaySteps.length}
            </span>
            <button
              onClick={() => onStepChange(Math.min(displaySteps.length - 1, currentStep + 1))}
              disabled={currentStep >= displaySteps.length - 1}
              style={{
                height: 26,
                borderRadius: 5,
                border: '1px solid var(--border)',
                background: 'var(--button-bg)',
                color: currentStep >= displaySteps.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: currentStep >= displaySteps.length - 1 ? 'not-allowed' : 'pointer',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                padding: '0 8px',
                opacity: currentStep >= displaySteps.length - 1 ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>

          {/* Steps list */}
          <div className="flex flex-col gap-1">
            {displaySteps.map((step, i) => (
              <button
                key={i}
                onClick={() => onStepChange(i)}
                className="text-[10px] font-mono"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: 'none',
                  background: i === currentStep ? 'var(--surface-element)' : 'transparent',
                  color: i === currentStep ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ opacity: 0.5 }}>{i + 1}.</span>{' '}
                {step.expression}
                {step.inputs.length > 0 && (
                  <span style={{ opacity: 0.5 }}>
                    {' = '}
                    {step.inputs.map((inp) => `${inp.name}=${String(inp.value)}`).join(', ')}
                    {' → '}
                  </span>
                )}
                {step.operation !== 'input' && step.operation !== 'constant' && (
                  <span style={{ color: 'var(--text-primary)' }}>
                    {' = '}{String(step.result)}
                  </span>
                )}
                {step.status === 'overflow' && (
                  <span style={{ color: 'var(--status-error)', marginLeft: 4 }}>
                    (mod)
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
