import { encodeStatePlain } from '@/lib/urlState';
import type { ProofTrace } from './schema';
import { validateProofTrace } from './schema';
import type { SampleId } from './samples';
import { DEFAULT_SAMPLE_ID, isSampleId } from './samples';

export type TraceSource =
  | { kind: 'sample'; id: SampleId }
  | { kind: 'url'; url: string }
  | { kind: 'inline'; trace: ProofTrace }
  | { kind: 'local'; name: string; hash: string };

export type TraceView = 'fingerprint' | 'constraints' | 'timeline';

export const TRACE_VIEWS: TraceView[] = ['fingerprint', 'constraints', 'timeline'];

/** Inline traces above this encoded length degrade to a local marker in URLs. */
export const INLINE_URL_THRESHOLD = 1500;

export interface SerializedState {
  source: TraceSource;
  view: TraceView;
  step: number;
}

export const DEFAULT_SOURCE: TraceSource = { kind: 'sample', id: DEFAULT_SAMPLE_ID };

/**
 * Build the URL payload, degrading oversized inline traces to a local
 * marker (view/step remain shareable; the trace itself does not).
 */
export function serializeForUrl(
  source: TraceSource,
  view: TraceView,
  step: number,
  hash: string | null,
): SerializedState {
  const full: SerializedState = { source, view, step };
  if (source.kind === 'inline' && encodeStatePlain(full).length > INLINE_URL_THRESHOLD) {
    return {
      source: { kind: 'local', name: 'inline trace', hash: hash ?? '' },
      view,
      step,
    };
  }
  return full;
}

export function deserializeState(raw: unknown): SerializedState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<SerializedState>;
  const view = TRACE_VIEWS.includes(candidate.view as TraceView) ? (candidate.view as TraceView) : 'fingerprint';
  const step = typeof candidate.step === 'number' && Number.isInteger(candidate.step) && candidate.step >= 0
    ? candidate.step
    : 0;
  const source = deserializeSource(candidate.source);
  if (!source) return null;
  return { source, view, step };
}

function deserializeSource(raw: unknown): TraceSource | null {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SOURCE };
  const kind = (raw as { kind?: unknown }).kind;
  switch (kind) {
    case 'sample': {
      const id = (raw as { id?: unknown }).id;
      return isSampleId(id) ? { kind: 'sample', id } : { ...DEFAULT_SOURCE };
    }
    case 'url': {
      const url = (raw as { url?: unknown }).url;
      return typeof url === 'string' && url.length > 0 ? { kind: 'url', url } : { ...DEFAULT_SOURCE };
    }
    case 'inline': {
      const result = validateProofTrace((raw as { trace?: unknown }).trace);
      return result.ok && result.trace ? { kind: 'inline', trace: result.trace } : { ...DEFAULT_SOURCE };
    }
    case 'local': {
      const name = (raw as { name?: unknown }).name;
      const hash = (raw as { hash?: unknown }).hash;
      return {
        kind: 'local',
        name: typeof name === 'string' ? name : 'uploaded trace',
        hash: typeof hash === 'string' ? hash : '',
      };
    }
    default:
      return { ...DEFAULT_SOURCE };
  }
}
