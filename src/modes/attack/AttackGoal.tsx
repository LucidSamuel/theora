import type { AttackScenario, AttackDifficulty } from './scenarios/types';

const DIFFICULTY_COLORS: Record<AttackDifficulty, string> = {
  beginner: '#22c55e',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
};

export function AttackGoal({ scenario }: { scenario: AttackScenario }) {
  return (
    <div className="control-card" style={{ borderLeft: `2px solid ${DIFFICULTY_COLORS[scenario.difficulty]}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-mono font-medium uppercase"
          style={{
            color: DIFFICULTY_COLORS[scenario.difficulty],
            letterSpacing: '0.06em',
          }}
        >
          {scenario.difficulty}
        </span>
      </div>

      <div
        className="text-[13px] font-semibold font-display mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {scenario.title}
      </div>

      <div
        className="text-[12px] mb-3"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
      >
        {scenario.briefing.goal}
      </div>

      <InfoList label="You can see" items={scenario.briefing.adversarySees} />
      <InfoList label="You can manipulate" items={scenario.briefing.adversaryControls} />
      <InfoList label="You cannot" items={scenario.briefing.adversaryCannotDo} />
    </div>
  );
}

function InfoList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-2">
      <div
        className="text-[10px] font-mono uppercase mb-1"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}
      >
        {label}
      </div>
      <ul
        className="list-none p-0 m-0"
        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            className="text-[11px]"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}
          >
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>-</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
