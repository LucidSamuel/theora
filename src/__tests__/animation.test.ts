import { describe, it, expect } from 'vitest';
import {
  easeOutCubic,
  easeInOutCubic,
  lerp,
  createSpring2D,
  spring2DStep,
  spring2DSetTarget,
  spring2DIsSettled,
  defaultSpringConfig,
} from '@/lib/animation';

describe('easeOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is monotonically increasing', () => {
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.1) {
      const val = easeOutCubic(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });
});

describe('easeInOutCubic', () => {
  it('returns 0 at t=0 and 1 at t=1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('returns 0.5 at t=0.5', () => {
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });
});

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});

describe('Spring2D', () => {
  it('creates a spring at given position', () => {
    const spring = createSpring2D(10, 20);
    expect(spring.x.value).toBe(10);
    expect(spring.y.value).toBe(20);
    expect(spring.x.velocity).toBe(0);
    expect(spring.y.velocity).toBe(0);
  });

  it('moves towards target after stepping', () => {
    let spring = createSpring2D(0, 0);
    spring = spring2DSetTarget(spring, 100, 100);

    // Step several times
    for (let i = 0; i < 100; i++) {
      spring = spring2DStep(spring, 0.016);
    }

    expect(spring.x.value).toBeCloseTo(100, 0);
    expect(spring.y.value).toBeCloseTo(100, 0);
  });

  it('reports settled when near target', () => {
    let spring = createSpring2D(100, 100);
    spring = spring2DSetTarget(spring, 100, 100);
    expect(spring2DIsSettled(spring)).toBe(true);
  });

  it('reports not settled when far from target', () => {
    let spring = createSpring2D(0, 0);
    spring = spring2DSetTarget(spring, 100, 100);
    expect(spring2DIsSettled(spring)).toBe(false);
  });

  it('accepts custom config', () => {
    const spring = createSpring2D(0, 0, { stiffness: 500, damping: 30 });
    expect(spring.config.stiffness).toBe(500);
    expect(spring.config.damping).toBe(30);
    expect(spring.config.mass).toBe(defaultSpringConfig.mass);
  });
});
