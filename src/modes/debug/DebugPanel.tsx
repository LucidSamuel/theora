import { useState } from 'react';
import { useDebug } from './DebugProvider';
import { useMode } from '@/modes/ModeProvider';
import { DebugEditor } from './DebugEditor';
import { DebugInputs } from './DebugInputs';
import { DebugConstraintList } from './DebugConstraintList';
import { DebugWitnessTrace } from './DebugWitnessTrace';
import { DebugFailureTrace } from './DebugFailureTrace';
import { DebugAnalysis } from './DebugAnalysis';
import { DebugExhaustive } from './DebugExhaustive';
import { EmbedModal } from '@/components/shared/EmbedModal';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';
import type { DemoId } from '@/types';

const DEBUG_DEMOS = new Set<DemoId>(['circuit', 'pipeline', 'plonk', 'groth16']);

export function DebugPanel({ activeDemo }: { activeDemo: DemoId }) {
  const { setMode } = useMode();
  const {
    source, setSource,
    fieldSize, setFieldSize,
    inputValues, setInputValue,
    autoEvaluate, setAutoEvaluate,
    parseErrors, compilation, witness, checks,
    failureTrace, analysis, ast,
    selectedConstraint, setSelectedConstraint,
    witnessStep, setWitnessStep,
    evaluate,
    buildShareParams,
    exportPng,
  } = useDebug();

  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');

  if (!DEBUG_DEMOS.has(activeDemo)) {
    return <NoDebugPanel />;
  }

  // For non-circuit demos, show a read-only inspector placeholder
  if (activeDemo !== 'circuit') {
    return <ReadOnlyInspector activeDemo={activeDemo} />;
  }

  const handleCopyShareUrl = () => {
    copyToClipboard(window.location.href);
    showToast('Link copied', 'Share this URL to restore the exact debug state');
  };

  const handleCopyEmbed = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('embed', 'circuit');
    const p = buildShareParams();
    url.searchParams.set('mode', 'debug');
    url.searchParams.set('src', p.src);
    if (p.inputs) url.searchParams.set('inputs', p.inputs);
    if (p.field) url.searchParams.set('field', p.field);
    setEmbedUrl(url.toString());
    setEmbedOpen(true);
  };

  const handleCopyAuditJson = () => {
    const inputsObj: Record<string, string> = {};
    for (const [k, v] of inputValues.entries()) inputsObj[k] = String(v);

    const payload = {
      demo: 'circuit',
      mode: 'debug',
      timestamp: new Date().toISOString(),
      source,
      fieldSize: String(fieldSize),
      inputs: inputsObj,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
      constraintCount: checks?.checks.length ?? 0,
      satisfied: checks?.checks.every((check) => check.satisfied) ?? false,
      analysis: analysis ? {
        unconstrainedWires: analysis.unconstrainedWires,
        overconstrainedWires: analysis.overconstrainedWires,
        degreesOfFreedom: analysis.degreesOfFreedom,
      } : undefined,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
    showToast('Audit JSON copied', 'Debug state, constraints & analysis');
  };

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
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span
          className="text-[11px] font-mono uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Debug Mode
        </span>
      </div>

      {/* Circuit Editor */}
      <Section label="Circuit">
        <DebugEditor
          source={source}
          onChange={setSource}
          errors={parseErrors}
          fieldSize={fieldSize}
          onFieldSizeChange={setFieldSize}
        />
      </Section>

      {/* Inputs */}
      <Section label="Inputs">
        <DebugInputs
          inputWires={compilation?.inputWires ?? []}
          publicWires={compilation?.publicWires ?? []}
          values={inputValues}
          onChange={setInputValue}
          autoEvaluate={autoEvaluate}
          onAutoEvaluateChange={setAutoEvaluate}
          onEvaluate={evaluate}
        />
      </Section>

      {/* Analysis warnings */}
      <DebugAnalysis analysis={analysis} />

      {/* Constraint Status */}
      <Section label="Constraints">
        <DebugConstraintList
          checks={checks}
          selectedConstraint={selectedConstraint}
          onSelectConstraint={setSelectedConstraint}
        />
      </Section>

      {/* Witness Trace */}
      {witness && (
        <Section label="">
          <DebugWitnessTrace
            steps={witness.steps}
            currentStep={witnessStep}
            onStepChange={setWitnessStep}
          />
        </Section>
      )}

      {/* Failure Trace */}
      {failureTrace && (
        <Section label="Failure Trace">
          <DebugFailureTrace trace={failureTrace} />
        </Section>
      )}

      {/* Exhaustive Check */}
      <Section label="Property Check">
        <DebugExhaustive compilation={compilation} ast={ast} />
      </Section>

      {/* Share */}
      <Section label="Share">
        <div className="control-button-grid">
          <button onClick={handleCopyShareUrl} style={shareBtnStyle}>Copy Link</button>
          <button onClick={handleCopyEmbed} style={shareBtnStyle}>Embed</button>
          <button onClick={exportPng} style={shareBtnStyle}>Export PNG</button>
          <button onClick={handleCopyAuditJson} style={shareBtnStyle}>Audit JSON</button>
        </div>
      </Section>

      {/* Actions */}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <button
          onClick={() => setMode('explore')}
          style={{
            width: '100%',
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
          Back to Explore
        </button>
      </div>

      <EmbedModal isOpen={embedOpen} onClose={() => setEmbedOpen(false)} embedUrl={embedUrl} demoName="Circuit Debug" />
    </div>
  );
}

const shareBtnStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--button-bg)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div
          className="text-[10px] font-mono uppercase mb-2"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function ReadOnlyInspector({ activeDemo }: { activeDemo: DemoId }) {
  const { setMode } = useMode();
  const demoLabels: Record<string, string> = {
    pipeline: 'Proof Pipeline',
    plonk: 'PLONK',
    groth16: 'Groth16',
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        padding: '16px 14px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span
          className="text-[11px] font-mono uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Debug Mode — {demoLabels[activeDemo] ?? activeDemo}
        </span>
      </div>

      <div
        className="text-[12px] mb-4"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
      >
        Read-only constraint inspector for {demoLabels[activeDemo] ?? activeDemo}.
        The full circuit editor is available on the R1CS Circuits demo.
      </div>

      <div
        className="text-[11px]"
        style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
      >
        Constraint inspector coming soon.
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <button
          onClick={() => setMode('explore')}
          style={{
            width: '100%',
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
          Back to Explore
        </button>
      </div>
    </div>
  );
}

function NoDebugPanel() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{ padding: '24px 16px', textAlign: 'center' }}
    >
      <div
        className="text-[13px] font-display mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        No debug view
      </div>
      <div
        className="text-[11px]"
        style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
      >
        Debug mode is available on R1CS Circuits, Pipeline, PLONK, and Groth16.
      </div>
    </div>
  );
}
