import { resolveGitHubImportSource } from '@/lib/githubImport';
import type { TraceValidation } from './schema';
import { MAX_TRACE_FILE_BYTES, validateProofTrace } from './schema';

/**
 * Parse trace file text. Accepts a bare ProofTrace, a theora envelope
 * { demo: 'proof-trace', state: { source: { kind: 'inline', trace } } },
 * an envelope whose state is a full demo state, or an envelope whose
 * state is a bare trace.
 */
export function parseTraceFile(text: string): TraceValidation {
  if (text.length > MAX_TRACE_FILE_BYTES) {
    return { ok: false, errors: [`file exceeds ${MAX_TRACE_FILE_BYTES / (1024 * 1024)} MB limit`] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['not valid JSON'] };
  }
  return validateTraceCandidate(raw);
}

function validateTraceCandidate(raw: unknown): TraceValidation {
  const direct = validateProofTrace(raw);
  if (direct.ok) return direct;

  if (typeof raw === 'object' && raw !== null && (raw as { demo?: unknown }).demo === 'proof-trace') {
    const state = (raw as { state?: unknown }).state;
    if (typeof state === 'object' && state !== null) {
      const source = (state as { source?: unknown }).source;
      if (typeof source === 'object' && source !== null && (source as { kind?: unknown }).kind === 'inline') {
        const nested = validateProofTrace((source as { trace?: unknown }).trace);
        if (nested.ok) return nested;
      }
      const asTrace = validateProofTrace(state);
      if (asTrace.ok) return asTrace;
    }
    return { ok: false, errors: ['theora envelope did not contain a valid proof trace', ...direct.errors] };
  }

  return direct;
}

/** Fetch a trace from a GitHub/gist URL (same host allowlist as theora.json imports). */
export async function fetchProofTrace(url: string): Promise<TraceValidation> {
  let resolved: ReturnType<typeof resolveGitHubImportSource>;
  try {
    resolved = resolveGitHubImportSource(url);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : 'unsupported URL'] };
  }

  try {
    if (resolved.kind === 'gist-api') {
      const response = await fetch(resolved.url);
      if (!response.ok) return { ok: false, errors: [`GitHub Gist fetch failed (${response.status})`] };
      const gist = (await response.json()) as {
        files?: Record<string, { filename?: string; content?: string; type?: string }>;
      };
      const files = Object.values(gist.files ?? {});
      const candidates = [
        files.find((f) => f.filename === 'trace.json'),
        files.find((f) => f.filename === 'theora.json'),
        ...files.filter((f) => f.filename?.endsWith('.json')),
        ...files,
      ].filter((f): f is NonNullable<typeof f> => Boolean(f?.content));
      for (const file of candidates) {
        const result = parseTraceFile(file.content!);
        if (result.ok) return result;
      }
      return { ok: false, errors: ['no gist file contained a valid proof trace'] };
    }

    const response = await fetch(resolved.url);
    if (!response.ok) return { ok: false, errors: [`fetch failed (${response.status})`] };
    const text = await response.text();
    return parseTraceFile(text);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : 'network error'] };
  }
}
