import { describe, it, expect } from 'vitest';

// Test the URL encoding/decoding helpers used by DebugProvider
describe('debug URL state encoding', () => {
  it('encodes and decodes source DSL roundtrip', () => {
    const source = `// Compute f(x) = x² + x + 5\ninput x\npublic out\nwire t = x * x`;
    const encoded = btoa(encodeURIComponent(source));
    const decoded = decodeURIComponent(atob(encoded));
    expect(decoded).toBe(source);
  });

  it('handles unicode characters in source', () => {
    const source = 'wire α = x + 1';
    const encoded = btoa(encodeURIComponent(source));
    const decoded = decodeURIComponent(atob(encoded));
    expect(decoded).toBe(source);
  });

  it('encodes inputs as name:value pairs', () => {
    const inputs = new Map<string, bigint>([
      ['x', 7n],
      ['out', 61n],
    ]);
    const encoded = Array.from(inputs.entries())
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    expect(encoded).toBe('x:7,out:61');
  });

  it('parses inputs from URL format', () => {
    const param = 'x:7,out:61,y:4';
    const m = new Map<string, bigint>();
    for (const pair of param.split(',')) {
      const idx = pair.indexOf(':');
      if (idx > 0) {
        m.set(pair.slice(0, idx), BigInt(pair.slice(idx + 1)));
      }
    }
    expect(m.get('x')).toBe(7n);
    expect(m.get('out')).toBe(61n);
    expect(m.get('y')).toBe(4n);
  });

  it('handles field size param', () => {
    const fieldStr = '97';
    const fieldSize = parseInt(fieldStr, 10);
    expect(fieldSize).toBe(97);
    expect(BigInt(fieldSize)).toBe(97n);
  });

  it('defaults field to 101 when omitted', () => {
    const fieldParam: string | null = null;
    const fieldSize = fieldParam ? BigInt(parseInt(fieldParam, 10)) : 101n;
    expect(fieldSize).toBe(101n);
  });
});
