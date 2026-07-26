import { describe, expect, it } from 'vitest';
import * as libDsl from '@/lib/dsl';
import * as shimDsl from '@/modes/debug/dsl';
import * as libLayout from '@/lib/circuitGraph/layout';
import * as shimLayout from '@/modes/debug/layout';
import * as libRenderer from '@/lib/circuitGraph/renderer';
import * as shimRenderer from '@/modes/debug/renderer';

describe('dsl relocation shims', () => {
  it('re-exports identical function references from @/modes/debug/dsl', () => {
    const keys = Object.keys(libDsl) as Array<keyof typeof libDsl>;
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(shimDsl[key as keyof typeof shimDsl]).toBe(libDsl[key]);
    }
  });

  it('re-exports identical layout references from @/modes/debug/layout', () => {
    expect(shimLayout.computeLayout).toBe(libLayout.computeLayout);
    expect(shimLayout.WIRE_RADIUS).toBe(libLayout.WIRE_RADIUS);
    expect(shimLayout.CONSTRAINT_WIDTH).toBe(libLayout.CONSTRAINT_WIDTH);
    expect(shimLayout.CONSTRAINT_HEIGHT).toBe(libLayout.CONSTRAINT_HEIGHT);
  });

  it('re-exports identical renderer references from @/modes/debug/renderer', () => {
    expect(shimRenderer.renderDebugGraph).toBe(libRenderer.renderDebugGraph);
    expect(shimRenderer.hitTest).toBe(libRenderer.hitTest);
  });
});
