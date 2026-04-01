export function Compose() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="text-center" style={{ maxWidth: 400 }}>
        <div
          className="text-[17px] font-semibold font-display mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Compose Workspace
        </div>
        <div
          className="text-[13px] mb-6"
          style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}
        >
          Chain primitives into custom proof pipelines with drag-and-drop
          stage composition.
        </div>
        <a
          href="/app"
          className="text-[12px] font-display font-medium no-underline"
          style={{
            color: 'var(--text-muted)',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          Back to App
        </a>
      </div>
    </div>
  );
}
