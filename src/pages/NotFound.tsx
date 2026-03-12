import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.12em] mb-6"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
      >
        404
      </p>

      <h1
        className="text-[2rem] font-semibold tracking-tight mb-3"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
      >
        Page not found
      </h1>

      <p
        className="text-[14px] mb-10"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}
      >
        This route does not exist in the visualizer.
      </p>

      <button
        onClick={() => navigate('/')}
        style={{
          height: '40px',
          padding: '0 20px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          background: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: 'none',
          cursor: 'pointer',
          letterSpacing: '-0.01em',
          transition: 'opacity 140ms ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        Back to home
      </button>
    </div>
  );
}
