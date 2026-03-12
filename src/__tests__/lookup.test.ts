import { describe, it, expect } from 'vitest';
import { analyzeLookup, parseNumberList } from '@/demos/lookup/logic';

describe('lookup logic', () => {
  it('parses comma-separated values', () => {
    expect(parseNumberList('1, 2, 5')).toEqual([1, 2, 5]);
  });

  it('passes when every wire value exists in the table', () => {
    const analysis = analyzeLookup([1, 2, 3, 5, 8], [2, 5, 8]);
    expect(analysis.passes).toBe(true);
  });

  it('fails on missing or overused values', () => {
    const analysis = analyzeLookup([1, 2, 3], [2, 2, 9]);
    expect(analysis.passes).toBe(false);
    expect(analysis.missing).toEqual([9]);
    expect(analysis.multiplicityMismatches).toContain(2);
  });
});
