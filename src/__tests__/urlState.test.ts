import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, encodeStatePlain, decodeStatePlain } from '@/lib/urlState';

describe('encodeState / decodeState (base64)', () => {
  it('round-trips a simple object', () => {
    const data = { foo: 'bar', num: 42 };
    const encoded = encodeState(data);
    const decoded = decodeState<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  it('round-trips an array', () => {
    const data = [1, 2, 3];
    const encoded = encodeState(data);
    const decoded = decodeState<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  it('handles unicode characters', () => {
    const data = { text: 'hello\u2019world' };
    const encoded = encodeState(data);
    const decoded = decodeState<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  it('returns null for null input', () => {
    expect(decodeState(null)).toBeNull();
  });

  it('returns null for invalid base64', () => {
    expect(decodeState('not-valid-base64!!!')).toBeNull();
  });
});

describe('encodeStatePlain / decodeStatePlain', () => {
  it('round-trips a simple object', () => {
    const data = { mode: 'tree', depth: 3 };
    const encoded = encodeStatePlain(data);
    const decoded = decodeStatePlain<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });

  it('returns null for null input', () => {
    expect(decodeStatePlain(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(decodeStatePlain('not-json')).toBeNull();
  });
});
