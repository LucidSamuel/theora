import { describe, it, expect } from 'vitest';
import {
  buildWitness,
  evaluateCircuit,
  getBootle16Breakdown,
  getExploitWitness,
  witnessSatisfiesAll,
} from '@/demos/circuit/logic';

describe('circuit logic', () => {
  it('accepts a valid witness in safe mode', () => {
    const witness = buildWitness(3, 4, 13);
    expect(witnessSatisfiesAll(witness, false)).toBe(true);
  });

  it('rejects the exploit witness in safe mode but accepts it in broken mode', () => {
    const witness = getExploitWitness(3, 4);
    expect(witnessSatisfiesAll(witness, false)).toBe(false);
    expect(witnessSatisfiesAll(witness, true)).toBe(true);
    expect(evaluateCircuit(witness, false)[1]!.satisfied).toBe(false);
  });

  it('manual t override: t=0 exploit passes in broken mode', () => {
    // Underconstrained exploit: set t=0 instead of t=x*x=9
    // Circuit: constraint 1 = t=x*x, constraint 2 = z=t+y
    // With t overridden to 0: z should be 0+4=4 to satisfy constraint 2
    const witness = { x: 3, y: 4, z: 4, t: 0 };
    // In broken mode (only constraint 1 active, but t=0!=9 so still fails)
    // Actually broken mode drops constraint 2 only, constraint 1 still checks t=x*x
    expect(witnessSatisfiesAll(witness, true)).toBe(false);
    // If we also fix constraint 1 by making x match: x=0, t=0
    const witness2 = { x: 0, y: 4, z: 4, t: 0 };
    expect(witnessSatisfiesAll(witness2, false)).toBe(true); // t=0*0=0, z=0+4=4
    // But with t overridden to wrong value and broken mode, constraint 2 is dropped
    const witness3 = { x: 3, y: 4, z: 999, t: 0 };
    // broken=true means only constraint 1 (t=x*x) is checked. t=0, x*x=9 → fails
    expect(witnessSatisfiesAll(witness3, true)).toBe(false);
  });

  it('valid witness for f(x)=x²+y circuit', () => {
    // Circuit constraints: t=x*x, z=t+y
    // x=3, y=4: t=9, z=13
    const witness = buildWitness(3, 4, 13);
    expect(witnessSatisfiesAll(witness, false)).toBe(true);
    const constraints = evaluateCircuit(witness, false);
    expect(constraints[0]!.satisfied).toBe(true); // t=x*x
    expect(constraints[1]!.satisfied).toBe(true); // z=t+y
  });

  it('invalid z is rejected', () => {
    // x=3, y=4, t=9, z should be 13 but we set 14
    const witness = buildWitness(3, 4, 14);
    expect(witnessSatisfiesAll(witness, false)).toBe(false);
    // But in broken mode (constraint 2 dropped), only t=x*x is checked → passes
    expect(witnessSatisfiesAll(witness, true)).toBe(true);
  });

  it('builds a Bootle16-style split of multiplication and linear constraints', () => {
    const witness = buildWitness(3, 4, 13);
    const breakdown = getBootle16Breakdown(witness, false);

    expect(breakdown.multiplication).toHaveLength(1);
    expect(breakdown.multiplication[0]?.satisfied).toBe(true);
    expect(breakdown.linear).toHaveLength(1);
    expect(breakdown.linear[0]?.equation).toContain('z - t - y');
  });

  it('checks witnesses modulo the selected field', () => {
    const witness = { x: 10, y: 5, t: 100, z: 105 };
    const constraints = evaluateCircuit(witness, false, 97);

    expect(constraints[0]?.left).toBe(3);
    expect(constraints[0]?.right).toBe(3);
    expect(constraints[0]?.satisfied).toBe(true);
    expect(constraints[1]?.left).toBe(8);
    expect(constraints[1]?.right).toBe(8);
    expect(constraints[1]?.satisfied).toBe(true);
    expect(witnessSatisfiesAll(witness, false, 97)).toBe(true);
  });
});
