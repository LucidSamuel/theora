interface ControlGroupProps {
  label: string;
  children: React.ReactNode;
  accent?: string;
}

export function ControlGroup({ label, children }: ControlGroupProps) {
  return (
    <div className="control-section">
      <div
        className="text-[10px] font-semibold uppercase tracking-widest mb-4"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

interface ControlCardProps {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'error';
}

export function ControlCard({ children, tone = 'default' }: ControlCardProps) {
  const className = tone === 'default' ? 'control-card' : `control-card control-card--${tone}`;
  return <div className={className}>{children}</div>;
}

interface ControlNoteProps {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'error';
}

export function ControlNote({ children, tone = 'default' }: ControlNoteProps) {
  const className = tone === 'default' ? 'control-note' : `control-note control-note--${tone}`;
  return <div className={className}>{children}</div>;
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accentColor?: string;
}

export function SliderControl({ label, value, min, max, step = 1, onChange }: SliderControlProps) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-2">
      <div className="flex justify-between text-[11px]">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--text-secondary) 0%, var(--text-secondary) ${percent}%, var(--button-bg-strong) ${percent}%, var(--button-bg-strong) 100%)`,
        }}
      />
    </label>
  );
}

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accentColor?: string;
}

export function ToggleControl({ label, checked, onChange }: ToggleControlProps) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="relative w-8 h-[18px] rounded-full cursor-pointer"
        style={{
          backgroundColor: checked ? 'var(--text-primary)' : 'var(--button-bg-strong)',
          border: 'none',
          padding: 0,
          transition: 'background-color 150ms ease',
        }}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <div
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full"
          style={{
            backgroundColor: checked ? 'var(--bg-primary)' : 'var(--text-muted)',
            transform: checked ? 'translateX(15px)' : 'translateX(2px)',
            transition: 'transform 150ms ease, background-color 150ms ease',
          }}
        />
      </button>
    </div>
  );
}

interface ButtonControlProps {
  label: string;
  onClick: () => void;
  accentColor?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function ButtonControl({ label, onClick, disabled, variant = 'primary' }: ButtonControlProps) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${isPrimary ? 'app-btn-primary' : 'app-btn-secondary'}`}
      style={{ height: 36, fontSize: 12 }}
    >
      {label}
    </button>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accentColor?: string;
  onSubmit?: () => void;
}

export function TextInput({ value, onChange, placeholder, onSubmit }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit?.();
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full px-3 rounded-lg text-[12px] outline-none"
      style={{
        height: 36,
        backgroundColor: 'var(--button-bg)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        transition: 'border-color 150ms ease',
        fontFamily: 'var(--font-mono)',
      }}
    />
  );
}

interface SelectControlProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  accentColor?: string;
}

export function SelectControl({ label, value, options, onChange }: SelectControlProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 rounded-lg text-[12px] outline-none cursor-pointer"
        style={{
          height: 36,
          backgroundColor: 'var(--button-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
