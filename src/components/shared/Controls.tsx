import { useState } from 'react';

interface ControlGroupProps {
  label: string;
  children: React.ReactNode;
  accent?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function ControlGroup({ label, children, collapsible, defaultCollapsed = false }: ControlGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible && collapsed;

  return (
    <div className="control-section">
      <div
        className="text-[10px] font-semibold uppercase tracking-widest mb-5"
        style={{
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          ...(collapsible ? { cursor: 'pointer', userSelect: 'none' as const, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : {}),
          ...(isCollapsed ? { marginBottom: 0 } : {}),
        }}
        onClick={collapsible ? () => setCollapsed((v) => !v) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((v) => !v); } } : undefined}
      >
        <span>{label}</span>
        {collapsible && (
          <span style={{ fontSize: 9, transition: 'transform 150ms ease', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
        )}
      </div>
      {!isCollapsed && <div className="flex flex-col gap-5">{children}</div>}
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
  editable?: boolean;
}

export function SliderControl({ label, value, min, max, step = 1, onChange, editable }: SliderControlProps) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-2">
      <div className="flex justify-between text-[11px] items-center">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        {editable ? (
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="tabular-nums text-right w-16 rounded px-2 outline-none"
            style={{
              color: 'var(--text-primary)',
              backgroundColor: 'var(--button-bg)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              height: 22,
            }}
            aria-label={`${label} value`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
        )}
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

interface NumberInputControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}

export function NumberInputControl({ label, value, min, max, step = 1, onChange }: NumberInputControlProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) {
            const clamped = max !== undefined ? Math.min(max, v) : v;
            onChange(min !== undefined ? Math.max(min, clamped) : clamped);
          }
        }}
        className="w-full rounded-lg text-[12px] outline-none"
        style={{
          height: 38,
          padding: '0 14px',
          backgroundColor: 'var(--button-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
        }}
        aria-label={label}
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
    <div className="flex items-center justify-between py-1">
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
      style={{ height: 38, fontSize: 12 }}
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
      className="w-full rounded-lg text-[12px] outline-none"
      style={{
        height: 38,
        padding: '0 14px',
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
    <label className="flex flex-col gap-2">
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg text-[12px] outline-none cursor-pointer"
        style={{
          height: 38,
          padding: '0 14px',
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
