import { describe, expect, it } from 'vitest';
import { clearCrossDemoParams } from '@/hooks/useActiveDemo';

describe('clearCrossDemoParams', () => {
  it('removes demo-specific and debug-specific URL params', () => {
    const params = new URLSearchParams(
      'mode=debug&src=abc&inputs=x:7&field=97&scenario=demo&step=2&c=payload&fs=other&keep=1',
    );

    const next = clearCrossDemoParams(params);

    expect(next.get('mode')).toBeNull();
    expect(next.get('src')).toBeNull();
    expect(next.get('inputs')).toBeNull();
    expect(next.get('field')).toBeNull();
    expect(next.get('scenario')).toBeNull();
    expect(next.get('step')).toBeNull();
    expect(next.get('c')).toBeNull();
    expect(next.get('fs')).toBeNull();
    expect(next.get('keep')).toBe('1');
  });

  it('preserves non-debug mode while still clearing per-demo state', () => {
    const params = new URLSearchParams('mode=attack&scenario=forge&step=1&pl=payload&keep=1');

    const next = clearCrossDemoParams(params);

    expect(next.get('mode')).toBe('attack');
    expect(next.get('scenario')).toBeNull();
    expect(next.get('step')).toBeNull();
    expect(next.get('pl')).toBeNull();
    expect(next.get('keep')).toBe('1');
  });
});
