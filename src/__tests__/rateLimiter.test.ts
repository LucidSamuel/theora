import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../modes/predict/ai/rateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 1000); // 3 per 1 second
  });

  it('allows requests within limit', () => {
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('rejects requests over limit', () => {
    limiter.tryAcquire();
    limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('canAcquire does not consume quota', () => {
    expect(limiter.canAcquire()).toBe(true);
    expect(limiter.canAcquire()).toBe(true);
    limiter.tryAcquire();
    limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.canAcquire()).toBe(false);
  });

  it('reports correct state', () => {
    const state1 = limiter.getState();
    expect(state1.remaining).toBe(3);
    expect(state1.maxPerWindow).toBe(3);
    expect(state1.windowMs).toBe(1000);

    limiter.tryAcquire();
    const state2 = limiter.getState();
    expect(state2.remaining).toBe(2);
  });

  it('resets', () => {
    limiter.tryAcquire();
    limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.canAcquire()).toBe(false);
    limiter.reset();
    expect(limiter.canAcquire()).toBe(true);
    expect(limiter.getState().remaining).toBe(3);
  });

  it('allows requests after window expires', () => {
    vi.useFakeTimers();
    try {
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.canAcquire()).toBe(false);

      vi.advanceTimersByTime(1001); // past 1s window
      expect(limiter.canAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
