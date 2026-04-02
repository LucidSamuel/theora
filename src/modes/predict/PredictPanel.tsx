import { useState, useEffect } from 'react';
import { usePredict } from './PredictProvider';
import { useMode } from '@/modes/ModeProvider';
import { hasPredictChallenges } from './challenges';
import { ApiKeyStore } from './ai/apiKeyStore';
import { getCurrentExportEnvelope } from '@/lib/githubImport';
import { ApiKeyModal } from '@/components/shared/ApiKeyModal';
import type { DemoId } from '@/types';

export function PredictPanel({ activeDemo }: { activeDemo: DemoId }) {
  const {
    state, selectChoice, lockIn, reveal, nextChallenge,
    difficulty, setDifficulty,
    generateAi, aiLoading, aiError, aiEnabled,
    accuracyPct, accuracyTotal,
  } = usePredict();
  const { setMode } = useMode();
  const { challenge, phase, selectedIndex, correct } = state;
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(() => aiEnabled || ApiKeyStore.has());

  // Stay in sync when the key is changed from the header modal or elsewhere
  useEffect(() => {
    return ApiKeyStore.subscribe(() => setHasApiKey(ApiKeyStore.has()));
  }, []);

  if (!hasPredictChallenges(activeDemo)) {
    return <NoChallengePanel />;
  }

  if (!challenge) {
    return <NoChallengePanel />;
  }

  const exportEnvelope = getCurrentExportEnvelope(activeDemo);
  const demoState = exportEnvelope?.state && typeof exportEnvelope.state === 'object' && !Array.isArray(exportEnvelope.state)
    ? exportEnvelope.state as Record<string, unknown>
    : {};

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
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span
          className="text-[11px] font-mono uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Predict Mode
        </span>
        {accuracyTotal > 0 && (
          <span
            className="text-[10px] font-mono ml-auto"
            style={{ color: 'var(--text-muted)' }}
          >
            {accuracyPct}% ({accuracyTotal})
          </span>
        )}
      </div>

      {/* Difficulty selector */}
      <div className="flex gap-1 mb-4">
        {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              border: difficulty === d ? 'none' : '1px solid var(--border)',
              background: difficulty === d ? 'var(--text-primary)' : 'transparent',
              color: difficulty === d ? 'var(--bg-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="control-note" style={{ marginBottom: 12 }}>
        <div
          className="text-[12px]"
          style={{ color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}
        >
          {challenge.question}
        </div>
      </div>

      {/* Hint (only before reveal) */}
      {phase !== 'revealed' && (
        <HintToggle hint={challenge.hint} />
      )}

      {/* Choices */}
      <div className="flex flex-col mb-3" style={{ gap: 8 }}>
        {challenge.choices.map((choice, i) => {
          const isSelected = selectedIndex === i;
          const isCorrect = i === challenge.correctIndex;
          const showResult = phase === 'revealed';
          const isNeutralAfterReveal = showResult && !isCorrect && !(isSelected && !isCorrect);

          let bgColor = isSelected ? 'var(--button-bg-strong)' : 'transparent';
          let borderColor = isSelected ? 'var(--text-muted)' : 'var(--border)';
          let textColor = isSelected ? 'var(--text-primary)' : 'var(--text-secondary)';
          let opacity: number | undefined = undefined;

          if (showResult) {
            if (isCorrect) {
              bgColor = 'var(--status-success-bg)';
              borderColor = 'var(--status-success)';
              textColor = 'var(--text-primary)';
              opacity = 1;
            } else if (isSelected && !isCorrect) {
              bgColor = 'var(--status-error-bg)';
              borderColor = 'var(--status-error)';
              textColor = 'var(--text-primary)';
              opacity = 1;
            } else {
              bgColor = 'transparent';
              borderColor = 'var(--border)';
              textColor = 'var(--text-muted)';
              opacity = 0.5;
            }
          }

          return (
            <button
              key={i}
              className="predict-choice-button"
              onClick={() => phase === 'prompt' && selectChoice(i)}
              disabled={phase !== 'prompt'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${borderColor}`,
                background: bgColor,
                color: textColor,
                cursor: phase === 'prompt' ? 'pointer' : 'default',
                textAlign: 'left',
                fontSize: 12,
                lineHeight: 1.4,
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 150ms ease, background 150ms ease, color 150ms ease, opacity 150ms ease',
                opacity: opacity ?? 1,
              }}
            >
              <span>{choice.label}</span>
              {showResult && (
                <span
                  className="text-[10px]"
                  style={{ color: isNeutralAfterReveal ? 'var(--text-muted)' : 'inherit', fontStyle: 'italic', opacity: isNeutralAfterReveal ? 1 : 0.75 }}
                >
                  {choice.rationale}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      {phase === 'prompt' && (
        <button
          onClick={lockIn}
          disabled={selectedIndex === null}
          style={{
            width: '100%',
            height: 44,
            marginTop: 16,
            borderRadius: 8,
            border: 'none',
            background: selectedIndex !== null ? 'var(--text-primary)' : 'var(--border)',
            color: selectedIndex !== null ? 'var(--bg-primary)' : 'var(--text-muted)',
            cursor: selectedIndex !== null ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
          }}
        >
          Lock In
        </button>
      )}

      {phase === 'locked' && (
        <button
          onClick={reveal}
          style={{
            width: '100%',
            height: 44,
            marginTop: 16,
            borderRadius: 8,
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
          }}
        >
          Reveal Answer
        </button>
      )}

      {phase === 'revealed' && (
        <>
          {/* Result badge */}
          <div
            className="control-note"
            style={{
              marginBottom: 12,
              borderLeft: `3px solid ${correct ? 'var(--status-success)' : 'var(--status-error)'}`,
            }}
          >
            <div
              className="text-[12px] font-display mb-1"
              style={{
                color: correct ? 'var(--status-success)' : 'var(--status-error)',
                fontWeight: 600,
              }}
            >
              {correct ? 'Correct!' : 'Not quite.'}
            </div>
            <div
              className="text-[11px]"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              {challenge.explanation}
            </div>
          </div>

          {/* Next actions */}
          <div className="control-button-row">
            <button
              onClick={nextChallenge}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 7,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
              }}
            >
              Next
            </button>
            <button
              onClick={() => setMode('explore')}
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
              Explore
            </button>
          </div>
        </>
      )}

      {/* AI challenge section */}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span
            className="text-[10px] font-mono uppercase"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
          >
            AI Challenges
          </span>
          {hasApiKey && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                color: 'var(--status-success)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--status-success)',
                  display: 'inline-block',
                }}
              />
              Connected
            </span>
          )}
        </div>

        {hasApiKey ? (
          <>
            <div
              className="text-[10px] mb-2"
              style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}
            >
              Storage: {storageLabel(ApiKeyStore.getPreference())}
            </div>
            <button
              onClick={() => generateAi(demoState)}
              disabled={aiLoading}
              style={{
                width: '100%',
                height: 34,
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--button-bg)',
                color: aiLoading ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: aiLoading ? 'wait' : 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
              }}
            >
              {aiLoading ? 'Generating...' : 'Generate AI Challenge'}
            </button>
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 8,
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => setApiKeyOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Manage
              </button>
              <button
                onClick={() => { ApiKeyStore.clear(); setHasApiKey(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="text-[11px] mb-3"
              style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
            >
              Personalized challenges powered by Claude.
            </div>
            <button
              onClick={() => setApiKeyOpen(true)}
              style={{
                width: '100%',
                height: 34,
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--button-bg)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
              }}
            >
              Add API Key
            </button>
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                console.anthropic.com →
              </a>
            </div>
          </>
        )}

        {aiError && (
          <div
            className="text-[10px] mt-2"
            style={{ color: 'var(--status-error)', lineHeight: 1.4 }}
          >
            {aiError}
          </div>
        )}
      </div>

      <ApiKeyModal
        isOpen={apiKeyOpen}
        onClose={() => {
          setApiKeyOpen(false);
          setHasApiKey(ApiKeyStore.has());
        }}
      />
    </div>
  );
}

function HintToggle({ hint }: { hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setShow((v) => !v)}
        className="text-[10px] font-mono"
        style={{
          color: 'var(--text-muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        {show ? 'Hide hint' : 'Show hint'}
      </button>
      {show && (
        <div
          className="text-[11px] mt-1"
          style={{ color: 'var(--text-muted)', lineHeight: 1.4, fontStyle: 'italic' }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function storageLabel(pref: 'memory' | 'session' | 'local'): string {
  if (pref === 'session') return 'Until tab closes';
  if (pref === 'local') return 'Across sessions';
  return 'This tab only';
}

function NoChallengePanel() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{ padding: '24px 16px', textAlign: 'center' }}
    >
      <div
        className="text-[13px] font-display mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        No prediction challenges
      </div>
      <div
        className="text-[11px]"
        style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
      >
        This demo does not have prediction challenges yet. Switch to Merkle, R1CS
        Circuits, Fiat-Shamir, Polynomial Commitments, or Pipeline.
      </div>
    </div>
  );
}
