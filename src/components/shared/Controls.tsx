interface ControlGroupProps {
  label: string;
  children: React.ReactNode;
  accent?: string;
}

export function ControlGroup({ label, children, accent }: ControlGroupProps) {
  return (
    <div className="control-section">
      <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: accent || 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
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

export function SliderControl({ label, value, min, max, step = 1, onChange, accentColor }: SliderControlProps) {
  const fill = accentColor || 'var(--text-muted)';
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-2">
      <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: accentColor || 'var(--text-primary)' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${fill} 0%, ${fill} ${percent}%, color-mix(in srgb, var(--border) 80%, transparent) ${percent}%, color-mix(in srgb, var(--border) 80%, transparent) 100%)`,
          accentColor: fill,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${fill} 35%, transparent)`,
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

export function ToggleControl({ label, checked, onChange, accentColor }: ToggleControlProps) {
  const active = accentColor || 'var(--merkle)';
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <div
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{
          backgroundColor: checked ? active : 'var(--border)',
          boxShadow: checked ? `0 0 12px ${active}` : 'none',
        }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform bg-white"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
    </label>
  );
}

interface ButtonControlProps {
  label: string;
  onClick: () => void;
  accentColor?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function ButtonControl({ label, onClick, accentColor, disabled, variant = 'primary' }: ButtonControlProps) {
  const isPrimary = variant === 'primary';
  const color = accentColor || 'var(--merkle)';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 py-2 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: isPrimary ? 'var(--button-bg)' : 'transparent',
        color: isPrimary ? 'var(--text-primary)' : color,
        border: `1px solid ${isPrimary ? 'var(--button-border)' : color}`,
        boxShadow: isPrimary ? '0 8px 18px rgba(10, 7, 4, 0.35)' : 'none',
        textShadow: isPrimary ? '0 1px 0 rgba(0, 0, 0, 0.35)' : 'none',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isPrimary || disabled) return;
        e.currentTarget.style.background = 'var(--button-bg-strong)';
      }}
      onMouseLeave={(e) => {
        if (!isPrimary || disabled) return;
        e.currentTarget.style.background = 'var(--button-bg)';
      }}
      onMouseDown={(e) => {
        if (!isPrimary || disabled) return;
        e.currentTarget.style.background = 'var(--button-bg-strong)';
        e.currentTarget.style.boxShadow = '0 6px 14px rgba(10, 7, 4, 0.45)';
      }}
      onMouseUp={(e) => {
        if (!isPrimary || disabled) return;
        e.currentTarget.style.background = 'var(--button-bg-strong)';
        e.currentTarget.style.boxShadow = '0 8px 18px rgba(10, 7, 4, 0.35)';
      }}
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

export function TextInput({ value, onChange, placeholder, accentColor, onSubmit }: TextInputProps) {
  const color = accentColor || 'var(--merkle)';
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit?.();
      }}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 rounded text-xs outline-none transition-colors"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        border: `1px solid var(--border)`,
        caretColor: color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 10%, transparent)`,
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

export function SelectControl({ label, value, options, onChange, accentColor }: SelectControlProps) {
  const color = accentColor || 'var(--merkle)';
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded text-xs outline-none cursor-pointer"
        style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: `1px solid var(--border)`,
          accentColor: color,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 10%, transparent)`,
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
