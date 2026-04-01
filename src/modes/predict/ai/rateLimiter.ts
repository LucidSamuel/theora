import type { RateLimitState } from '../types';

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_PER_WINDOW = 10; // 10 requests per minute

/** Client-side rate limiter to protect the user's API quota. */
export class RateLimiter {
  private timestamps: number[] = [];
  private windowMs: number;
  private maxPerWindow: number;

  constructor(
    maxPerWindow = DEFAULT_MAX_PER_WINDOW,
    windowMs = DEFAULT_WINDOW_MS,
  ) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  /** Returns true if the request is allowed. */
  tryAcquire(): boolean {
    const now = Date.now();
    this.prune(now);
    if (this.timestamps.length >= this.maxPerWindow) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  /** Check if a request would be allowed without consuming it. */
  canAcquire(): boolean {
    this.prune(Date.now());
    return this.timestamps.length < this.maxPerWindow;
  }

  /** Get current rate limit state. */
  getState(): RateLimitState {
    const now = Date.now();
    this.prune(now);
    const oldest = this.timestamps[0];
    return {
      remaining: Math.max(0, this.maxPerWindow - this.timestamps.length),
      resetAt: oldest ? oldest + this.windowMs : now,
      windowMs: this.windowMs,
      maxPerWindow: this.maxPerWindow,
    };
  }

  /** Reset the limiter (for testing). */
  reset(): void {
    this.timestamps = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }
}

/** Singleton limiter shared across the app. */
export const globalRateLimiter = new RateLimiter();
