import { beforeAll, describe, it, expect } from 'vitest';
import {
  findSubgroupOrder,
  buildPairingConfig,
  buildEcdlpChallenge,
  toyPairing,
  discreteLog,
  demonstrateBilinearity,
  simulateGroth16Verify,
  simulateKZGVerify,
  pairingTable,
  modPow,
  findPrimitiveRoot,
  PairingConfig,
} from '@/demos/elliptic/pairing';
import {
  DEFAULT_CURVE,
  enumerateCurvePoints,
  isOnCurve,
  addPoints,
  scalarMultiply,
} from '@/demos/elliptic/logic';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

let config: PairingConfig;

// Build once — reuse across tests
beforeAll(() => {
  config = buildPairingConfig(DEFAULT_CURVE);
});

// ---------------------------------------------------------------------------
// findSubgroupOrder
// ---------------------------------------------------------------------------

describe('findSubgroupOrder', () => {
  it('returns a positive order for the default generator', () => {
    const order = findSubgroupOrder(DEFAULT_CURVE, config.generator);
    expect(order).toBeGreaterThan(3);
  });

  it('order divides the total number of curve points plus one (group order)', () => {
    // By Lagrange's theorem, subgroup order divides group order.
    // Group order = |E(F_p)| = number of affine points + 1 (point at infinity).
    const groupSize = enumerateCurvePoints(DEFAULT_CURVE).length + 1;
    const order = findSubgroupOrder(DEFAULT_CURVE, config.generator);
    expect(groupSize % order).toBe(0);
  });

  it('repeated scalar multiplication by order yields the identity', () => {
    const result = scalarMultiply(
      config.generator,
      config.groupOrder,
      config.curve,
    ).result;
    expect(result).toBeNull(); // point at infinity
  });

  it('works on the small curve y^2 = x^3 + x + 1 (mod 7)', () => {
    const smallCurve = { p: 7, a: 1, b: 1 };
    const points = enumerateCurvePoints(smallCurve);
    // Group order = 4 affine points + 1 = 5
    // 5 is prime, so every non-identity point generates the full group.
    const order = findSubgroupOrder(smallCurve, points[0]!);
    expect(order).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildPairingConfig
// ---------------------------------------------------------------------------

describe('buildPairingConfig', () => {
  it('returns a config with a valid generator on the curve', () => {
    expect(isOnCurve(config.generator, config.curve)).toBe(true);
  });

  it('returns a subgroup order greater than 3', () => {
    expect(config.groupOrder).toBeGreaterThan(3);
  });

  it('returns a subgroup whose order divides the full group order', () => {
    // By Lagrange's theorem, the subgroup order must divide the group order.
    // Group order = |E(F_p)| = number of affine points + 1 (point at infinity).
    const groupSize = enumerateCurvePoints(DEFAULT_CURVE).length + 1;
    expect(groupSize % config.groupOrder).toBe(0);
    // And it should be the largest subgroup found (at least a significant fraction)
    expect(config.groupOrder).toBeGreaterThanOrEqual(Math.floor(groupSize / 4));
  });

  it('works with a provided curve', () => {
    const smallConfig = buildPairingConfig({ p: 23, a: 2, b: 3 });
    expect(smallConfig.groupOrder).toBeGreaterThan(3);
    expect(isOnCurve(smallConfig.generator, smallConfig.curve)).toBe(true);
  });
});

describe('buildEcdlpChallenge', () => {
  it('uses a valid generator and public point on the curve', () => {
    const challenge = buildEcdlpChallenge(DEFAULT_CURVE, 17);
    expect(isOnCurve(challenge.generator, challenge.curve)).toBe(true);
    expect(isOnCurve(challenge.publicPoint, challenge.curve)).toBe(true);
  });

  it('clamps the secret scalar below the generator order', () => {
    const challenge = buildEcdlpChallenge(DEFAULT_CURVE, 999);
    expect(challenge.secretScalar).toBeGreaterThanOrEqual(1);
    expect(challenge.secretScalar).toBeLessThan(challenge.groupOrder);
  });

  it('computes Q = kG for the chosen challenge scalar', () => {
    const challenge = buildEcdlpChallenge(DEFAULT_CURVE, 17);
    expect(challenge.publicPoint).toEqual(
      scalarMultiply(challenge.generator, challenge.secretScalar, challenge.curve).result,
    );
  });
});

// ---------------------------------------------------------------------------
// discreteLog
// ---------------------------------------------------------------------------

describe('discreteLog', () => {
  it('discrete log of the identity (null) is 0', () => {
    expect(discreteLog(config, null)).toBe(0);
  });

  it('discrete log of the generator is 1', () => {
    expect(discreteLog(config, config.generator)).toBe(1);
  });

  it('discrete log of 2G is 2', () => {
    const twoG = addPoints(config.generator, config.generator, config.curve);
    expect(discreteLog(config, twoG)).toBe(2);
  });

  it('discrete log of kG is k for several values', () => {
    for (const k of [3, 5, 10]) {
      const kG = scalarMultiply(config.generator, k, config.curve).result;
      expect(discreteLog(config, kG)).toBe(k);
    }
  });

  it('returns -1 for a point not in the subgroup', () => {
    // If the subgroup is the full group, every point is in it.
    // We only test this if there's a strict subgroup.
    const allPoints = enumerateCurvePoints(config.curve);
    if (config.groupOrder < allPoints.length + 1) {
      // Find a point NOT generated by our generator
      const subgroupPoints = new Set<string>();
      let cur = config.generator as ReturnType<typeof addPoints>;
      for (let i = 1; i < config.groupOrder; i++) {
        if (cur) subgroupPoints.add(`${cur.x},${cur.y}`);
        cur = addPoints(cur, config.generator, config.curve);
      }
      const outside = allPoints.find(
        (p) => !subgroupPoints.has(`${p.x},${p.y}`),
      );
      if (outside) {
        expect(discreteLog(config, outside)).toBe(-1);
      }
    }
    // If full group, just verify the generator case works (already tested above)
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toyPairing
// ---------------------------------------------------------------------------

describe('toyPairing', () => {
  it('e(G, G) is nonzero', () => {
    const result = toyPairing(config, config.generator, config.generator);
    expect(result.outputValue).not.toBe(0);
  });

  it('e(O, P) is 1 (identity in target group)', () => {
    const result = toyPairing(config, null, config.generator);
    // g_T^(0 * 1) = g_T^0 = 1
    expect(result.outputValue).toBe(1);
  });

  it('e(P, O) is 1 (identity in target group)', () => {
    const result = toyPairing(config, config.generator, null);
    expect(result.outputValue).toBe(1);
  });

  it('e(O, O) is 1', () => {
    const result = toyPairing(config, null, null);
    expect(result.outputValue).toBe(1);
  });

  it('returns discrete logs alongside the pairing value', () => {
    const twoG = scalarMultiply(config.generator, 2, config.curve).result;
    const result = toyPairing(config, twoG, config.generator);
    expect(result.pScalar).toBe(2);
    expect(result.qScalar).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// demonstrateBilinearity (core property tests)
// ---------------------------------------------------------------------------

describe('demonstrateBilinearity', () => {
  it('bilinearity holds for a=2, b=3', () => {
    const demo = demonstrateBilinearity(config, 2, 3);
    expect(demo.bilinearityHolds).toBe(true);
    expect(demo.eaPbQ).toBe(demo.ePQab);
  });

  it('bilinearity holds for a=1, b=1 (trivial case)', () => {
    const demo = demonstrateBilinearity(config, 1, 1);
    expect(demo.bilinearityHolds).toBe(true);
  });

  it('bilinearity holds for a=4, b=7', () => {
    const demo = demonstrateBilinearity(config, 4, 7);
    expect(demo.bilinearityHolds).toBe(true);
  });

  it('bilinearity holds for a=0 (e(O, bQ) = 1 = e(P,Q)^0)', () => {
    const demo = demonstrateBilinearity(config, 0, 5);
    expect(demo.bilinearityHolds).toBe(true);
  });

  it('e(2P, 3Q) = e(P, Q)^6', () => {
    const demo = demonstrateBilinearity(config, 2, 3);
    // e(2P, 3Q) should equal e(P,Q)^(2*3) = e(P,Q)^6
    const n = config.groupOrder;
    const ePQ = toyPairing(config, config.generator, config.generator).outputValue;
    const ePQ6 = modPow(ePQ, 6 % n, n);
    expect(demo.eaPbQ).toBe(ePQ6);
  });

  it('linearity in second argument: e(P, Q+R) = e(P,Q) * e(P,R) in exponent domain', () => {
    // e(P, Q+R) in exponent = dlog_P * dlog_{Q+R}
    // e(P,Q)*e(P,R) in exponent = dlog_P*dlog_Q + dlog_P*dlog_R = dlog_P*(dlog_Q+dlog_R)
    // Since Q+R has dlog = dlog_Q + dlog_R (mod n), these are equal.
    const n = config.groupOrder;
    const G = config.generator;
    const curve = config.curve;

    const P = scalarMultiply(G, 3, curve).result;
    const Q = scalarMultiply(G, 4, curve).result;
    const R = scalarMultiply(G, 5, curve).result;
    const QplusR = addPoints(Q, R, curve);

    const ePQR = toyPairing(config, P, QplusR).outputValue;
    // In the target group Z_n with generator g_T:
    // "multiplication" of pairing outputs corresponds to adding exponents.
    // ePQ = g_T^(3*4), ePR = g_T^(3*5), product = g_T^(3*4 + 3*5) = g_T^(3*9)
    // ePQR = g_T^(3 * 9) since dlog of Q+R = 4+5 = 9
    const gT = findPrimitiveRoot(n);
    const expPQ = (3 * 4) % n;
    const expPR = (3 * 5) % n;
    const productExp = (expPQ + expPR) % n;
    const product = modPow(gT, productExp, n);
    expect(ePQR).toBe(product);
  });

  it('bilinearity holds with explicit P and Q different from generator', () => {
    const G = config.generator;
    const curve = config.curve;
    const P = scalarMultiply(G, 5, curve).result!;
    const Q = scalarMultiply(G, 7, curve).result!;
    const demo = demonstrateBilinearity(config, 3, 4, P, Q);
    expect(demo.bilinearityHolds).toBe(true);
  });

  it('aP and bQ are correct scalar multiples', () => {
    const demo = demonstrateBilinearity(config, 3, 5);
    const expected_aP = scalarMultiply(config.generator, 3, config.curve).result;
    const expected_bQ = scalarMultiply(config.generator, 5, config.curve).result;
    expect(demo.aP).toEqual(expected_aP);
    expect(demo.bQ).toEqual(expected_bQ);
  });
});

// ---------------------------------------------------------------------------
// simulateGroth16Verify
// ---------------------------------------------------------------------------

describe('simulateGroth16Verify', () => {
  it('honest Groth16 verification passes', () => {
    const result = simulateGroth16Verify(config);
    expect(result.name).toBe('Groth16');
    expect(result.holds).toBe(true);
    expect(result.lhsValue).toBe(result.rhsValue);
  });

  it('returns a properly structured VerificationEquation', () => {
    const result = simulateGroth16Verify(config);
    expect(result.lhs.pairings).toHaveLength(1);
    expect(result.rhs.pairings).toHaveLength(3);
    expect(result.description).toContain('e(');
  });
});

// ---------------------------------------------------------------------------
// simulateKZGVerify
// ---------------------------------------------------------------------------

describe('simulateKZGVerify', () => {
  it('honest KZG verification passes with defaults', () => {
    const result = simulateKZGVerify(config);
    expect(result.name).toBe('KZG');
    expect(result.holds).toBe(true);
    expect(result.lhsValue).toBe(result.rhsValue);
  });

  it('honest KZG verification passes with custom parameters', () => {
    const result = simulateKZGVerify(config, 10, 2, 15);
    expect(result.holds).toBe(true);
  });

  it('returns a properly structured VerificationEquation', () => {
    const result = simulateKZGVerify(config);
    expect(result.lhs.pairings).toHaveLength(1);
    expect(result.rhs.pairings).toHaveLength(1);
    expect(result.description).toContain('e(');
  });
});

// ---------------------------------------------------------------------------
// pairingTable
// ---------------------------------------------------------------------------

describe('pairingTable', () => {
  it('has correct dimensions (order x order)', () => {
    const table = pairingTable(config);
    const n = config.groupOrder;
    expect(table).toHaveLength(n);
    for (const row of table) {
      expect(row).toHaveLength(n);
    }
  });

  it('first row and column are all 1 (pairing with identity)', () => {
    const table = pairingTable(config);
    const n = config.groupOrder;
    // e(0*G, j*G) = g_T^(0*j) = g_T^0 = 1 for all j
    for (let j = 0; j < n; j++) {
      expect(table[0]![j]).toBe(1);
      expect(table[j]![0]).toBe(1);
    }
  });

  it('diagonal entry [k][k] matches e(kG, kG)', () => {
    const table = pairingTable(config);
    const G = config.generator;
    for (const k of [1, 2, 3]) {
      const kG = scalarMultiply(G, k, config.curve).result;
      const pairing = toyPairing(config, kG, kG);
      expect(table[k]![k]).toBe(pairing.outputValue);
    }
  });

  it('table is symmetric: e(iG, jG) = e(jG, iG)', () => {
    const table = pairingTable(config);
    const n = config.groupOrder;
    for (let i = 0; i < Math.min(n, 10); i++) {
      for (let j = 0; j < Math.min(n, 10); j++) {
        expect(table[i]![j]).toBe(table[j]![i]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('modPow', () => {
  it('computes 2^10 mod 1000 = 24', () => {
    expect(modPow(2, 10, 1000)).toBe(24);
  });

  it('anything^0 mod m = 1 (for m > 1)', () => {
    expect(modPow(7, 0, 97)).toBe(1);
    expect(modPow(123, 0, 5)).toBe(1);
  });

  it('0^k mod m = 0 for k > 0', () => {
    expect(modPow(0, 5, 97)).toBe(0);
  });
});

describe('findPrimitiveRoot', () => {
  it('finds a primitive root of a small prime', () => {
    const g = findPrimitiveRoot(7);
    // g should generate all of Z_7*: {1, 2, 3, 4, 5, 6}
    const generated = new Set<number>();
    let val = 1;
    for (let i = 0; i < 6; i++) {
      generated.add(val);
      val = (val * g) % 7;
    }
    expect(generated.size).toBe(6);
  });
});
