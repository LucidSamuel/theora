import { describe, it, expect } from 'vitest';
import { buildWitness, evaluateCircuit, getExploitWitness, witnessSatisfiesAll } from '@/demos/circuit/logic';

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
});
