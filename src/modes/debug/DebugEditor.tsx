import { useCallback, useRef, useState } from 'react';
import type { ParseError } from './dsl/types';
import { DEFAULT_CIRCUITS } from './dsl/defaults';

interface DebugEditorProps {
  source: string;
  onChange: (source: string) => void;
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

export function DebugEditor({ source, onChange, errors, fieldSize, onFieldSizeChange }: DebugEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedCircuit, setSelectedCircuit] = useState<string>('basic');

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = source.slice(0, start) + '  ' + source.slice(end);
      onChange(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [source, onChange]);

  const handleCircuitSelect = useCallback((id: string) => {
    const circuit = DEFAULT_CIRCUITS.find((c) => c.id === id);
    if (circuit) {
      setSelectedCircuit(id);
      onChange(circuit.source);
    }
  }, [onChange]);

  return (
    <div>
      {/* Circuit selector */}
      <div className="flex items-center gap-2 mb-2">
        <select
          value={selectedCircuit}
          onChange={(e) => handleCircuitSelect(e.target.value)}
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
          {DEFAULT_CIRCUITS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={String(fieldSize)}
          onChange={(e) => onFieldSizeChange(BigInt(e.target.value))}
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

      {/* Editor */}
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
          style={{
            width: '100%',
            minHeight: 160,
            maxHeight: '40vh',
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

      {/* Errors */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {errors.slice(0, 5).map((err, i) => (
            <div
              key={i}
              className="text-[10px]"
              style={{ color: 'var(--status-error)', lineHeight: 1.4 }}
            >
              <span style={{ fontFamily: 'var(--font-mono)' }}>L{err.line}:{err.column}</span>
              {' '}{err.message}
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
