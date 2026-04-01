import { useState } from 'react';
import { useAttack } from './AttackProvider';
import { useMode } from '@/modes/ModeProvider';
import { AttackGoal } from './AttackGoal';
import { AttackResult } from './AttackResult';
import { hasAttackScenario } from './scenarios';
import type { DemoId } from '@/types';

export function AttackPanel({ activeDemo }: { activeDemo: DemoId }) {
  const { state, advanceStep, goToStep, startScenario } = useAttack();
  const { setMode } = useMode();
  const { scenario, phase, currentStep } = state;

  if (!hasAttackScenario(activeDemo)) {
    return <NoScenarioPanel />;
  }

  if (!scenario) {
    return <NoScenarioPanel />;
  }

  const step = scenario.steps[currentStep];
  const totalSteps = scenario.steps.length;
  const isLastStep = currentStep >= totalSteps - 1;

  return (
    <div
      className="flex flex-col h-full"
      style={{
        padding: '16px 14px',
        fontFamily: 'var(--font-sans)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6" />
          <path d="M16 16l4 4" />
          <path d="M19 21l2-2" />
        </svg>
        <span
          className="text-[11px] font-mono uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Attack Mode
        </span>
      </div>

      {/* Briefing phase */}
      {phase === 'briefing' && (
        <>
          <AttackGoal scenario={scenario} />
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => advanceStep()}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 8,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                letterSpacing: '0.01em',
              }}
            >
              Begin Attack
            </button>
          </div>
        </>
      )}

      {/* Step-through phase */}
      {phase === 'attempt' && step && (
        <>
          {/* Step progress */}
          <StepProgress current={currentStep} total={totalSteps} />

          {/* Instruction card */}
          <div className="control-note" style={{ marginTop: 10, marginBottom: 10 }}>
            <div
              className="text-[12px] mb-2"
              style={{ color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}
            >
              {step.instruction}
            </div>
          </div>

          {/* Observation */}
          <div className="control-card" style={{ marginBottom: 10 }}>
            <div
              className="text-[10px] font-mono uppercase mb-1"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
            >
              Observation
            </div>
            <div
              className="text-[11px]"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              {step.observation}
            </div>
          </div>

          {/* Adversary narration */}
          <AdversaryNarration text={step.adversaryNarration} />

          {/* Navigation */}
          <div className="control-button-row" style={{ marginTop: 12 }}>
            <button
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 0}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--button-bg)',
                color: currentStep === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStep === 0 ? 0.5 : 1,
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
              }}
            >
              Back
            </button>
            <button
              onClick={() => (isLastStep ? advanceStep() : advanceStep())}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 7,
                border: 'none',
                background: isLastStep ? 'var(--text-primary)' : 'var(--button-bg-strong)',
                color: isLastStep ? 'var(--bg-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: isLastStep ? 600 : 500,
              }}
            >
              {isLastStep ? 'See Result' : 'Next'}
            </button>
          </div>
        </>
      )}

      {/* Result phase */}
      {phase === 'result' && (
        <AttackResult
          scenario={scenario}
          onReset={() => startScenario(scenario)}
          onExplore={() => setMode('explore')}
        />
      )}
    </div>
  );
}

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          Step {current + 1} of {total}
        </span>
      </div>
      <div
        style={{
          height: 2,
          borderRadius: 1,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${((current + 1) / total) * 100}%`,
            background: 'var(--text-muted)',
            borderRadius: 1,
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  );
}

function AdversaryNarration({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div
      className="control-card"
      style={{
        borderLeft: '2px solid var(--text-muted)',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-mono uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
        >
          Adversary
        </span>
        <span
          className="text-[10px]"
          style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}
        >
          {expanded ? '−' : '+'}
        </span>
      </div>
      {expanded && (
        <div
          className="text-[11px] mt-1"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

function NoScenarioPanel() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{ padding: '24px 16px', textAlign: 'center' }}
    >
      <div
        className="text-[13px] font-display mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        No attack scenario
      </div>
      <div
        className="text-[11px]"
        style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
      >
        This demo does not have an attack scenario yet. Switch to a demo with
        an attack: Fiat-Shamir, R1CS Circuits, Pipeline, Merkle, or Polynomial
        Commitments.
      </div>
    </div>
  );
}
