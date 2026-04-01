const ENTRIES = [
  {
    version: '0.9.0',
    date: '2026-04-01',
    changes: [
      'Mode system foundation: Explore, Predict, Attack, Debug',
      'Workspace route placeholders: /research, /audit, /compose',
      'ModeBar component with keyboard shortcuts (1-4)',
      'Landing page redesign with live demo previews',
      'Mobile-optimized landing and app shell',
      'OS theme detection (prefers-color-scheme)',
    ],
  },
];

export function Changelog() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        <a
          href="/app"
          className="text-[12px] font-display font-medium no-underline mb-8 inline-block"
          style={{ color: 'var(--text-muted)' }}
        >
          &larr; Back to App
        </a>

        <h1
          className="text-[20px] font-semibold font-display mb-8"
          style={{ color: 'var(--text-primary)' }}
        >
          Changelog
        </h1>

        {ENTRIES.map((entry) => (
          <div key={entry.version} className="mb-10">
            <div className="flex items-baseline gap-3 mb-3">
              <span
                className="text-[14px] font-semibold font-mono"
                style={{ color: 'var(--text-primary)' }}
              >
                v{entry.version}
              </span>
              <span
                className="text-[12px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {entry.date}
              </span>
            </div>
            <ul className="list-none p-0 m-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entry.changes.map((change, i) => (
                <li
                  key={i}
                  className="text-[13px]"
                  style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
                >
                  <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>-</span>
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
