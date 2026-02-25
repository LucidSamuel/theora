import { describe, it, expect } from 'vitest';
import { fnv1a, sha256, hashLeaf, hashInternal } from '@/lib/hash';

describe('fnv1a', () => {
  it('returns an 8-character hex string', () => {
    const result = fnv1a('hello');
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    expect(fnv1a('test')).toBe(fnv1a('test'));
  });

  it('produces different hashes for different inputs', () => {
    expect(fnv1a('abc')).not.toBe(fnv1a('def'));
  });

  it('handles empty string', () => {
    const result = fnv1a('');
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('sha256', () => {
  it('returns a 64-character hex string', async () => {
    const result = await sha256('hello');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', async () => {
    const a = await sha256('test');
    const b = await sha256('test');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await sha256('abc');
    const b = await sha256('def');
    expect(a).not.toBe(b);
  });

  it('matches known SHA-256 test vector', async () => {
    // SHA-256 of empty string
    const result = await sha256('');
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('hashLeaf', () => {
  it('prefixes data with \\x00 before hashing (fnv1a)', async () => {
    const leafHash = await hashLeaf('data', 'fnv1a');
    const manualHash = fnv1a('\x00data');
    expect(leafHash).toBe(manualHash);
  });

  it('prefixes data with \\x00 before hashing (sha256)', async () => {
    const leafHash = await hashLeaf('data', 'sha256');
    const manualHash = await sha256('\x00data');
    expect(leafHash).toBe(manualHash);
  });

  it('produces different hashes for different leaf data', async () => {
    const a = await hashLeaf('leaf1', 'fnv1a');
    const b = await hashLeaf('leaf2', 'fnv1a');
    expect(a).not.toBe(b);
  });
});

describe('hashInternal', () => {
  it('prefixes concatenation with \\x01 (fnv1a)', async () => {
    const internalHash = await hashInternal('left', 'right', 'fnv1a');
    const manualHash = fnv1a('\x01leftright');
    expect(internalHash).toBe(manualHash);
  });

  it('prefixes concatenation with \\x01 (sha256)', async () => {
    const internalHash = await hashInternal('left', 'right', 'sha256');
    const manualHash = await sha256('\x01leftright');
    expect(internalHash).toBe(manualHash);
  });

  it('is order-dependent', async () => {
    const ab = await hashInternal('a', 'b', 'fnv1a');
    const ba = await hashInternal('b', 'a', 'fnv1a');
    expect(ab).not.toBe(ba);
  });
});
