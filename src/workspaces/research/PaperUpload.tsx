import { useState, useRef, useCallback } from 'react';
import { ApiKeyStore } from '@/modes/predict/ai/apiKeyStore';
import { analyzePaper, fileToBase64 } from './paperAnalyzer';
import type { Walkthrough } from './types';
import { isPdfResponse, normalizePaperPdfUrl } from './urls';

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
  const [apiKey, setApiKey] = useState(ApiKeyStore.get() ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [eprintUrl, setEprintUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>();

  const handleAnalyze = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) { setError('API key is required'); return; }
    if (!ApiKeyStore.validate(key)) { setError('Invalid API key format'); return; }
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
          setError(
            err instanceof Error && err.message === 'Fetched URL did not return a PDF'
              ? 'The URL did not return a PDF. Download it and upload directly.'
              : 'Could not fetch the PDF. Download it and upload directly.',
          );
          setLoading(false);
          clearInterval(progressInterval.current);
          return;
        }
      }

      // Store the key (in-memory by default)
      ApiKeyStore.set(key);

      const result = await analyzePaper(base64, key);
      if (result.error) {
        setError(result.error);
      } else if (result.walkthrough) {
        onWalkthroughGenerated(result.walkthrough);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
      clearInterval(progressInterval.current);
    }
  }, [apiKey, file, eprintUrl, onWalkthroughGenerated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    }
  }, []);

  return (
    <section style={{ padding: '0 24px 64px', maxWidth: 640, margin: '0 auto' }}>
      <h2
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
        }}
      >
        Analyze a Paper
      </h2>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          margin: '0 0 24px',
          lineHeight: 1.5,
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
          borderRadius: 12,
          border: '2px dashed var(--border)',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 16,
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
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
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Drop a PDF here or click to upload
          </div>
        )}
      </div>

      {/* OR eprint URL */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          or paste an eprint URL
        </div>
        <input
          type="text"
          placeholder="e.g. 2019/1021 or full URL"
          value={eprintUrl}
          onChange={(e) => { setEprintUrl(e.target.value); setError(null); }}
          style={{
            width: '100%',
            height: 38,
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
      </div>

      {/* API key */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Anthropic API key
        </label>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setError(null); }}
          autoComplete="off"
          style={{
            width: '100%',
            height: 38,
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
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          Your key is sent directly to Anthropic — it never touches theora's servers.
        </div>
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          width: '100%',
          height: 42,
          borderRadius: 10,
          border: 'none',
          background: loading ? 'var(--text-muted)' : 'var(--text-primary)',
          color: 'var(--bg-primary)',
          fontSize: 14,
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          cursor: loading ? 'default' : 'pointer',
          marginBottom: 16,
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
                color: i <= progressIdx ? 'var(--text-secondary)' : 'var(--text-muted)',
                opacity: i <= progressIdx ? 1 : 0.4,
                marginBottom: 4,
                transition: 'opacity 0.3s, color 0.3s',
              }}
            >
              {i < progressIdx ? '●' : i === progressIdx ? '○' : '○'} {msg}
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
            background: 'var(--status-error-bg)',
            color: 'var(--status-error)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}
