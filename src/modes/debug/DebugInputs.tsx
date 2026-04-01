import type { Wire } from './dsl/types';

interface DebugInputsProps {
  inputWires: Wire[];
  publicWires: Wire[];
  values: Map<string, bigint>;
  onChange: (name: string, value: bigint) => void;
  autoEvaluate: boolean;
  onAutoEvaluateChange: (v: boolean) => void;
  onEvaluate: () => void;
}

export function DebugInputs({
  inputWires, publicWires, values, onChange,
  autoEvaluate, onAutoEvaluateChange, onEvaluate,
}: DebugInputsProps) {
  const allWires = [...inputWires, ...publicWires];

  return (
    <div>
      {allWires.length === 0 ? (
        <div
          className="text-[11px]"
          style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
        >
          No inputs declared. Add <code style={{ fontFamily: 'var(--font-mono)' }}>input x</code> to your circuit.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {allWires.map((wire) => (
            <div key={wire.id} className="flex items-center gap-2">
              <label
                className="text-[11px] font-mono"
                style={{
                  color: wire.type === 'public' ? 'var(--status-success)' : 'var(--text-secondary)',
                  width: 60,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {wire.name}
                {wire.type === 'public' && <span className="text-[9px] ml-1" style={{ opacity: 0.6 }}>pub</span>}
              </label>
              <input
                type="number"
                value={String(values.get(wire.name) ?? 0)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) onChange(wire.name, BigInt(v));
                }}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  padding: '0 10px',
                  minWidth: 0,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={onEvaluate}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 7,
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
          }}
        >
          Evaluate
        </button>
        <label
          className="flex items-center gap-1.5 text-[10px] font-mono"
          style={{ color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <input
            type="checkbox"
            checked={autoEvaluate}
            onChange={(e) => onAutoEvaluateChange(e.target.checked)}
            style={{ margin: 0 }}
          />
          Auto
        </label>
      </div>
    </div>
  );
}
