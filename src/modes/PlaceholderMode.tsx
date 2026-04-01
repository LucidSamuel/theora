import type { ModeId } from './types';
import { MODES } from './types';

const MODE_LABELS: Record<Exclude<ModeId, 'explore'>, string> = {
  predict: 'Predict what happens next, then verify your intuition.',
  attack: 'Find vulnerabilities in broken proofs.',
  debug: 'Trace failures through the pipeline.',
};

export function PlaceholderMode({ modeId }: { modeId: Exclude<ModeId, 'explore'> }) {
  const meta = MODES.find((m) => m.id === modeId)!;
  return (
    <div
      className="flex-1 h-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="text-center" style={{ maxWidth: 360 }}>
        <div
          className="text-[15px] font-semibold font-display mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {meta.label} Mode
        </div>
        <div
          className="text-[13px] mb-4"
          style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
        >
          {MODE_LABELS[modeId]}
        </div>
        <div
          className="text-[11px]"
          style={{
            color: 'var(--text-muted)',
            opacity: 0.5,
            fontFamily: 'var(--font-mono)',
          }}
        >
          Coming soon
        </div>
      </div>
    </div>
  );
}
