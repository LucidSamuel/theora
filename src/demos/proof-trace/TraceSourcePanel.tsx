import { useCallback, useRef, useState } from 'react';
import { ControlGroup, ButtonControl, ControlNote, TextInput } from '@/components/shared/Controls';
import type { ProofTrace } from './schema';
import { MAX_TRACE_FILE_BYTES } from './schema';
import type { SampleId } from './samples';
import { SAMPLES, SAMPLE_IDS } from './samples';
import { parseTraceFile } from './importTrace';

interface TraceSourcePanelProps {
  activeSampleId: SampleId | null;
  loading: boolean;
  errors: string[];
  onSelectSample: (id: SampleId) => void;
  onLocalTrace: (trace: ProofTrace, fileName: string) => void;
  onLoadUrl: (url: string) => void;
  onErrors: (errors: string[]) => void;
  showReuploadNotice: boolean;
}

export function TraceSourcePanel({
  activeSampleId,
  loading,
  errors,
  onSelectSample,
  onLocalTrace,
  onLoadUrl,
  onErrors,
  showReuploadNotice,
}: TraceSourcePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState('');

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_TRACE_FILE_BYTES) {
        onErrors([`file exceeds ${MAX_TRACE_FILE_BYTES / (1024 * 1024)} MB limit`]);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = parseTraceFile(String(reader.result ?? ''));
        if (result.ok && result.trace) {
          onLocalTrace(result.trace, file.name);
        } else {
          onErrors(result.errors);
        }
      };
      reader.onerror = () => onErrors(['could not read file']);
      reader.readAsText(file);
    },
    [onLocalTrace, onErrors],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile],
  );

  return (
    <ControlGroup label="Trace Source">
      <div className="control-choice-list">
        {SAMPLE_IDS.map((id) => (
          <button
            key={id}
            className={`control-choice-button${activeSampleId === id ? ' active' : ''}`}
            onClick={() => onSelectSample(id)}
            title={SAMPLES[id].description}
          >
            {SAMPLES[id].label}
          </button>
        ))}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '16px 12px',
          borderRadius: 8,
          border: '1px dashed var(--border)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 160ms ease',
          background: 'var(--surface-element)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--focus-ring)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Drop trace.json or click to browse
        </span>
      </div>

      <TextInput
        value={url}
        onChange={setUrl}
        placeholder="github.com/.../trace.json or gist URL"
        onSubmit={() => url.trim() && onLoadUrl(url.trim())}
      />
      <ButtonControl
        label={loading ? 'Loading…' : 'Load from URL'}
        onClick={() => url.trim() && onLoadUrl(url.trim())}
        disabled={loading || url.trim().length === 0}
        variant="secondary"
      />

      {showReuploadNotice && (
        <ControlNote tone="error">
          This share link referenced an uploaded file. Re-upload it, or save traces to GitHub for restorable links.
        </ControlNote>
      )}
      {errors.length > 0 && (
        <ControlNote tone="error">
          {errors.slice(0, 4).map((err, i) => (
            <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{err}</div>
          ))}
          {errors.length > 4 && <div>…and {errors.length - 4} more</div>}
        </ControlNote>
      )}
    </ControlGroup>
  );
}
