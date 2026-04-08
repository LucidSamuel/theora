import { describe, expect, it } from 'vitest';
import { getSelectedCircuitId } from '@/modes/debug/DebugEditor';
import { DEFAULT_CIRCUITS } from '@/modes/debug/dsl/defaults';

describe('getSelectedCircuitId', () => {
  it('matches built-in presets by source, not just the default preset', () => {
    const preset = DEFAULT_CIRCUITS.find((c) => c.id !== 'basic');
    expect(preset).toBeTruthy();
    expect(getSelectedCircuitId(preset!.source)).toBe(preset!.id);
  });

  it('falls back to custom for edited sources', () => {
    expect(getSelectedCircuitId('input x\nwire t = x + 1')).toBe('custom');
  });
});
