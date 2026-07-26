import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParseError } from '@/lib/dsl/types';
import { EDITOR_PRESETS, getPresetIdForSource } from './presets';

interface EditorPaneProps {
  source: string;
  onChange: (source: string) => void;
  onSelectPreset: (id: string) => void;
  errors: ParseError[];
  fieldSize: bigint;
  onFieldSizeChange: (size: bigint) => void;
}

const FIELD_OPTIONS = [
  { value: 7n, label: 'GF(7)' },
  { value: 13n, label: 'GF(13)' },
  { value: 97n, label: 'GF(97)' },
  { value: 101n, label: 'GF(101)' },
  { value: 251n, label: 'GF(251)' },
];

export function EditorPane({ source, onChange, onSelectPreset, errors, fieldSize, onFieldSizeChange }: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => getPresetIdForSource(source));

  // Keep the preset selector in sync with the current source, including
  // sources restored from URL state that match a preset.
  useEffect(() => {
    setSelectedPreset(getPresetIdForSource(source));
  }, [source]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = source.slice(0, start) + '  ' + source.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [source, onChange]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <select
          value={selectedPreset}
          onChange={(e) => onSelectPreset(e.target.value)}
          aria-label="Circuit preset"
          style={{
            flex: 1,
            height: 30,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '0 8px',
          }}
        >
          {EDITOR_PRESETS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          {selectedPreset === 'custom' && (
            <option value="custom" disabled>(Custom)</option>
          )}
        </select>
        <select
          value={String(fieldSize)}
          onChange={(e) => onFieldSizeChange(BigInt(e.target.value))}
          aria-label="Field size"
          style={{
            width: 80,
            height: 30,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '0 8px',
          }}
        >
          {FIELD_OPTIONS.map((f) => (
            <option key={String(f.value)} value={String(f.value)}>{f.label}</option>
          ))}
        </select>
      </div>

      <div
        style={{
          position: 'relative',
          borderRadius: 8,
          border: `1px solid ${errors.length > 0 ? 'var(--status-error)' : 'var(--border)'}`,
          overflow: 'hidden',
        }}
      >
        <textarea
          ref={textareaRef}
          value={source}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Circuit source"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minHeight: 220,
            maxHeight: '45vh',
            resize: 'vertical',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.6,
            padding: '10px 12px',
            border: 'none',
            outline: 'none',
            display: 'block',
            tabSize: 2,
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {errors.slice(0, 5).map((err, i) => (
            <div
              key={i}
              className="text-[11px]"
              style={{
                color: 'var(--status-error)',
                background: 'var(--status-error-bg)',
                borderRadius: 8,
                padding: '8px 12px',
                lineHeight: 1.5,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ fontWeight: 600 }}>L{err.line}:{err.column}</span>
              {'  '}{err.message}
              {err.hint && (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {' — '}{err.hint}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
