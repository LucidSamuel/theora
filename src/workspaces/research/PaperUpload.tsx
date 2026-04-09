import { useState, useRef, useCallback, useEffect } from 'react';
import { ApiKeyStore } from '@/modes/predict/ai/apiKeyStore';
import { ApiKeyModal } from '@/components/shared/ApiKeyModal';
import { analyzePaper, fileToBase64 } from './paperAnalyzer';
import type { Walkthrough } from './types';
import { isPdfResponse, normalizePaperPdfUrl } from './urls';
import { trackPaperAnalysis } from '@/lib/analytics';

interface PaperUploadProps {
  onWalkthroughGenerated: (walkthrough: Walkthrough) => void;
}

const PROGRESS_MESSAGES = [
  'Reading paper...',
  'Identifying cryptographic primitives...',
  'Mapping to interactive demos...',
  'Generating walkthrough...',
];

export function PaperUpload({ onWalkthroughGenerated }: PaperUploadProps) {
  const [hasKey, setHasKey] = useState(() => ApiKeyStore.has());
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [eprintUrl, setEprintUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>();

  // Stay in sync when key is changed from the header modal or elsewhere
  useEffect(() => {
    return ApiKeyStore.subscribe(() => setHasKey(ApiKeyStore.has()));
  }, []);

  const handleAnalyze = useCallback(async () => {
    const key = ApiKeyStore.get();
    if (!key) { setError('API key is required — click the gear icon in the nav bar'); return; }
    if (!file && !eprintUrl.trim()) { setError('Upload a PDF or enter an eprint URL'); return; }

    setLoading(true);
    setError(null);
    setProgressIdx(0);

    // Progress messages on a timer
    let idx = 0;
    progressInterval.current = setInterval(() => {
      idx = Math.min(idx + 1, PROGRESS_MESSAGES.length - 1);
      setProgressIdx(idx);
    }, 3000);

    try {
      let base64: string;

      if (file) {
        base64 = await fileToBase64(file);
      } else {
        const url = normalizePaperPdfUrl(eprintUrl);
        if (!url) {
          setError('Upload a PDF or enter an eprint URL');
          setLoading(false);
          clearInterval(progressInterval.current);
          return;
        }

        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
          if (!isPdfResponse(url, resp.headers.get('content-type'))) {
            throw new Error('Fetched URL did not return a PDF');
          }
          const blob = await resp.blob();
          const f = new File([blob], 'paper.pdf', { type: 'application/pdf' });
          base64 = await fileToBase64(f);
        } catch (err) {
          const pdfUrl = url;
          const isCors = !(err instanceof Error && err.message.startsWith('Failed to fetch:') || err instanceof Error && err.message === 'Fetched URL did not return a PDF');
          setError(
            err instanceof Error && err.message === 'Fetched URL did not return a PDF'
              ? 'The URL did not return a PDF. Download it and upload directly.'
              : isCors
                ? `Browser security (CORS) blocks direct PDF downloads from this server. Open the PDF link, save it locally, then drag it into the upload area above.\n\n${pdfUrl}`
                : 'Could not fetch the PDF. Download it and upload directly.',
          );
          setLoading(false);
          clearInterval(progressInterval.current);
          return;
        }
      }

      const result = await analyzePaper(base64, key);
      if (result.error) {
        trackPaperAnalysis(file ? 'file' : 'eprint', false);
        setError(result.error);
      } else if (result.walkthrough) {
        trackPaperAnalysis(file ? 'file' : 'eprint', true);
        onWalkthroughGenerated(result.walkthrough);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
      clearInterval(progressInterval.current);
    }
  }, [file, eprintUrl, onWalkthroughGenerated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    }
  }, []);

  return (
    <section className="lp-shell" style={{ paddingBottom: 64, maxWidth: 640 }}>
      <p className="lp-overline" style={{ marginBottom: 8 }}>AI analysis</p>
      <h2
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(20px, 3vw, 28px)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
        }}
      >
        Analyze a paper
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--text-muted)',
          margin: '0 0 28px',
          lineHeight: 1.7,
        }}
      >
        Upload a PDF or paste an eprint URL. Claude reads the paper and maps sections to interactive theora demos.
      </p>

      {/* Upload area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '32px 20px',
          borderRadius: 8,
          border: '1px dashed var(--border)',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 16,
          transition: 'border-color 160ms ease',
          background: 'var(--surface-element)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--focus-ring)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setError(null); }
          }}
        />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setError(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              title="Remove file"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--surface-element)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                lineHeight: 1,
                padding: 0,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Drop a PDF here or click to upload
          </div>
        )}
      </div>

      {/* OR eprint URL */}
      <div style={{ marginBottom: 16 }}>
        <div className="lp-overline" style={{ textAlign: 'center', marginBottom: 12 }}>
          or paste an eprint URL
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="e.g. 2019/1021 or full URL"
            value={eprintUrl}
            onChange={(e) => { setEprintUrl(e.target.value); setError(null); }}
            style={{
              flex: 1,
              height: 40,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box',
            }}
          />
          {eprintUrl.trim() && (
            <button
              type="button"
              onClick={() => { setEprintUrl(''); setError(null); }}
              title="Clear URL"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-element)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* API key status */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}
        >
          Anthropic API key
        </div>
        {hasKey ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-element)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--status-success)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, fontFamily: 'var(--font-mono)' }}>
              Connected
            </span>
            <button
              type="button"
              onClick={() => setApiKeyOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              Manage
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setApiKeyOpen(true)}
            className="lp-btn-ghost"
            style={{ width: '100%', fontSize: 12 }}
          >
            Add API Key
          </button>
        )}
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Your key is sent directly to Anthropic — it never touches theora's servers.
        </div>
      </div>

      {/* Analyze button */}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading}
        className="lp-btn-primary"
        style={{
          width: '100%',
          height: 44,
          fontSize: 13,
          marginBottom: 16,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {/* Progress */}
      {loading && (
        <div style={{ marginBottom: 16 }}>
          {PROGRESS_MESSAGES.map((msg, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: i <= progressIdx ? 'var(--text-secondary)' : 'var(--text-muted)',
                opacity: i <= progressIdx ? 1 : 0.4,
                marginBottom: 6,
                transition: 'opacity 0.3s, color 0.3s',
              }}
            >
              {i < progressIdx ? '●' : '○'} {msg}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-error-border)',
            background: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          {error.split('\n').map((line, i) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              return (
                <a
                  key={i}
                  href={trimmed}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-error)', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {trimmed}
                </a>
              );
            }
            return <span key={i}>{line}</span>;
          })}
        </div>
      )}

      <ApiKeyModal
        isOpen={apiKeyOpen}
        onClose={() => setApiKeyOpen(false)}
      />
    </section>
  );
}
