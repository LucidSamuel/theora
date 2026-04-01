/**
 * GKR Protocol — pure logic.
 *
 * The GKR (Goldwasser–Kalai–Rothblum) protocol enables a verifier to check
 * the output of a layered arithmetic circuit in O(d · log(S)) time (where d
 * is the depth and S is the width) instead of re-executing the full circuit.
 *
 * It works by reducing a claim about the output layer to a claim about the
 * input layer, one layer at a time, using sumcheck as the inner subroutine.
 * At each layer the verifier checks:
 *
 *   V_i(r) = Σ_{x,y} [ add_i(r,x,y)·(V_{i+1}(x) + V_{i+1}(y))
 *                      + mul_i(r,x,y)·V_{i+1}(x)·V_{i+1}(y) ]
 *
 * For this demo we use a simplified single-round reduction per layer that
 * captures the key insight — layer-by-layer claim reduction — without
 * duplicating the full sumcheck mechanics (sumcheck already has its own demo).
 *
 * All arithmetic is BigInt mod fieldSize.
 */

import { createPolynomial, evaluateAtPoint } from '../sumcheck/logic';
import type { MultivariatePolynomial } from '../sumcheck/logic';

/* ── helpers ─────────────────────────────────────────────── */

/** Reduce a mod p into [0, p). */
function mod(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

/** Number of bits needed to index `n` elements (ceil(log2(n)), min 1). */
function bitsNeeded(n: number): number {
  if (n <= 1) return 1;
  return Math.ceil(Math.log2(n));
}

/** Pad an array to the next power of 2 with zeros. */
function padToPow2(values: bigint[]): bigint[] {
  const target = 1 << bitsNeeded(values.length);
  if (values.length === target) return values;
  const padded = [...values];
  while (padded.length < target) padded.push(0n);
  return padded;
}

/* ── types ───────────────────────────────────────────────── */

export type GateType = 'add' | 'mul';

export interface LayerGate {
  type: GateType;
  leftInput: number; // index in previous layer
  rightInput: number; // index in previous layer
}

export interface CircuitLayer {
  gates: LayerGate[];
  values: bigint[]; // computed values at this layer
}

export interface LayeredCircuit {
  numLayers: number; // including input layer
  layers: CircuitLayer[]; // index 0 = input, last = output
  fieldSize: bigint;
}

export interface GKRLayerProof {
  layerIndex: number;
  claim: bigint; // claimed value V_i(r)
  sumcheckPoly: bigint[][]; // univariate polys from sumcheck rounds
  challenges: bigint[]; // verifier challenges for this layer's sumcheck
  reducedClaim: bigint; // claim on next layer after reduction
  nextPoint: bigint[]; // evaluation point for next layer
}

export interface GKRProof {
  outputClaim: bigint; // V_d(r_0) — the output layer claim
  outputPoint: bigint[]; // r_0 — random point for output layer
  layerProofs: GKRLayerProof[]; // one per non-input layer (output toward input)
  inputEval: bigint; // final evaluation at input layer
}

export interface GKRVerification {
  passed: boolean;
  failedLayer: number | null; // which layer's check failed (null = passed)
  reason: string | null;
}

export interface GKRStepInfo {
  layerProof: GKRLayerProof;
  layerIndex: number;
  totalLayers: number;
  description: string;
}

/* ── core functions ──────────────────────────────────────── */

/**
 * Build a layered circuit from input values and layer definitions.
 *
 * `layerDefs[0]` are the gates for layer 1 (the first layer above inputs),
 * `layerDefs[1]` for layer 2, etc.  Each gate references indices in the
 * previous layer.
 *
 * Returns a LayeredCircuit where `layers[0]` is the input layer (no gates)
 * and `layers[layers.length - 1]` is the output layer.
 */
export function buildLayeredCircuit(
  inputValues: bigint[],
  layerDefs: LayerGate[][],
  fieldSize: bigint,
): LayeredCircuit {
  if (inputValues.length === 0) {
    throw new Error('Input values must be non-empty');
  }

  const layers: CircuitLayer[] = [];

  // Layer 0: input layer (no gates)
  layers.push({
    gates: [],
    values: inputValues.map((v) => mod(v, fieldSize)),
  });

  // Evaluate forward through each layer definition
  for (let d = 0; d < layerDefs.length; d++) {
    const gateDefs = layerDefs[d]!;
    const prevValues = layers[d]!.values;
    const values: bigint[] = [];

    for (const gate of gateDefs) {
      if (gate.leftInput < 0 || gate.leftInput >= prevValues.length) {
        throw new Error(
          `Layer ${d + 1} gate references invalid left input ${gate.leftInput} (previous layer has ${prevValues.length} values)`,
        );
      }
      if (gate.rightInput < 0 || gate.rightInput >= prevValues.length) {
        throw new Error(
          `Layer ${d + 1} gate references invalid right input ${gate.rightInput} (previous layer has ${prevValues.length} values)`,
        );
      }

      const left = prevValues[gate.leftInput]!;
      const right = prevValues[gate.rightInput]!;

      if (gate.type === 'add') {
        values.push(mod(left + right, fieldSize));
      } else {
        values.push(mod(left * right, fieldSize));
      }
    }

    layers.push({ gates: gateDefs, values });
  }

  return {
    numLayers: layers.length,
    layers,
    fieldSize,
  };
}

/**
 * Build a small demo circuit:
 *   4 inputs → 2 gates (layer 1) → 1 gate (layer 2, output).
 *
 *   Inputs: [3, 5, 7, 11]
 *   Layer 1: gate0 = add(input0, input1) = 8, gate1 = mul(input2, input3) = 77
 *   Layer 2: gate0 = add(layer1_gate0, layer1_gate1) = 85
 */
export function buildDefaultCircuit(fieldSize: bigint): LayeredCircuit {
  return buildLayeredCircuit(
    [3n, 5n, 7n, 11n],
    [
      // Layer 1: add(0,1), mul(2,3)
      [
        { type: 'add', leftInput: 0, rightInput: 1 },
        { type: 'mul', leftInput: 2, rightInput: 3 },
      ],
      // Layer 2: add(0,1)
      [{ type: 'add', leftInput: 0, rightInput: 1 }],
    ],
    fieldSize,
  );
}

/**
 * Create the multilinear extension (MLE) of a layer's values.
 *
 * Pads to the next power of 2 with zeros if needed, then wraps via
 * the sumcheck `createPolynomial` utility.
 */
export function multilinearExtension(
  values: bigint[],
  fieldSize: bigint,
): MultivariatePolynomial {
  const padded = padToPow2(values);
  const numVars = bitsNeeded(padded.length);
  return createPolynomial(numVars, fieldSize, padded);
}

/**
 * For a given layer, compute the "add" wiring predicate evaluations.
 *
 * add_i(g, x, y) = 1 if gate g in this layer is an ADD gate with
 * left input x and right input y from the previous layer; 0 otherwise.
 *
 * Returns a flat array of evaluations over the boolean hypercube
 * {0,1}^(gBits + xBits + yBits) in binary order.
 */
export function computeAddMultilinear(
  layer: CircuitLayer,
  prevLayerSize: number,
  fieldSize: bigint,
): MultivariatePolynomial {
  const numGates = layer.gates.length;
  const gBits = bitsNeeded(numGates);
  const xBits = bitsNeeded(prevLayerSize);
  const yBits = bitsNeeded(prevLayerSize);
  const totalBits = gBits + xBits + yBits;
  const totalSize = 1 << totalBits;

  const xPad = 1 << xBits;
  const yPad = 1 << yBits;

  const values: bigint[] = new Array(totalSize).fill(0n);

  for (let g = 0; g < numGates; g++) {
    const gate = layer.gates[g]!;
    if (gate.type !== 'add') continue;
    const idx = g * xPad * yPad + gate.leftInput * yPad + gate.rightInput;
    values[idx] = mod(1n, fieldSize);
  }

  return createPolynomial(totalBits, fieldSize, values);
}

/**
 * Same as computeAddMultilinear but for multiplication gates.
 */
export function computeMulMultilinear(
  layer: CircuitLayer,
  prevLayerSize: number,
  fieldSize: bigint,
): MultivariatePolynomial {
  const numGates = layer.gates.length;
  const gBits = bitsNeeded(numGates);
  const xBits = bitsNeeded(prevLayerSize);
  const yBits = bitsNeeded(prevLayerSize);
  const totalBits = gBits + xBits + yBits;
  const totalSize = 1 << totalBits;

  const xPad = 1 << xBits;
  const yPad = 1 << yBits;

  const values: bigint[] = new Array(totalSize).fill(0n);

  for (let g = 0; g < numGates; g++) {
    const gate = layer.gates[g]!;
    if (gate.type !== 'mul') continue;
    const idx = g * xPad * yPad + gate.leftInput * yPad + gate.rightInput;
    values[idx] = mod(1n, fieldSize);
  }

  return createPolynomial(totalBits, fieldSize, values);
}

/**
 * Compute the GKR "layer reduction polynomial" for a single layer.
 *
 * Given a random point r (for indexing into the current layer's MLE),
 * this function computes:
 *
 *   f(x, y) = add(r, x, y) · (V_next(x) + V_next(y))
 *           + mul(r, x, y) · V_next(x) · V_next(y)
 *
 * and returns evaluations over {0,1}^(xBits + yBits).
 *
 * This is the polynomial whose sum the sumcheck proves equals V_current(r).
 */
export function computeLayerReductionPoly(
  layer: CircuitLayer,
  prevLayerSize: number,
  nextLayerMLE: MultivariatePolynomial,
  rPoint: bigint[],
  fieldSize: bigint,
): MultivariatePolynomial {
  const xBits = bitsNeeded(prevLayerSize);
  const yBits = bitsNeeded(prevLayerSize);

  const addMLE = computeAddMultilinear(layer, prevLayerSize, fieldSize);
  const mulMLE = computeMulMultilinear(layer, prevLayerSize, fieldSize);

  const xySize = 1 << (xBits + yBits);
  const values: bigint[] = [];

  for (let xyIdx = 0; xyIdx < xySize; xyIdx++) {
    // Decompose xyIdx into x and y bits
    const xVal = xyIdx >> yBits;
    const yVal = xyIdx & ((1 << yBits) - 1);

    // Build point for the wiring predicates: (r, x, y)
    const xBin: bigint[] = [];
    for (let b = xBits - 1; b >= 0; b--) {
      xBin.push(BigInt((xVal >> b) & 1));
    }
    const yBin: bigint[] = [];
    for (let b = yBits - 1; b >= 0; b--) {
      yBin.push(BigInt((yVal >> b) & 1));
    }

    const wiringPoint = [...rPoint, ...xBin, ...yBin];

    // Pad rPoint if needed to match gBits
    while (wiringPoint.length < addMLE.numVars) {
      // This shouldn't happen if dimensions are correct, but safety check
      wiringPoint.push(0n);
    }

    const addVal = evaluateAtPoint(addMLE, wiringPoint.slice(0, addMLE.numVars));
    const mulVal = evaluateAtPoint(mulMLE, wiringPoint.slice(0, mulMLE.numVars));

    // Evaluate V_next at x and y
    const vx = evaluateAtPoint(nextLayerMLE, xBin);
    const vy = evaluateAtPoint(nextLayerMLE, yBin);

    // f(x,y) = add(r,x,y) * (V(x) + V(y)) + mul(r,x,y) * V(x) * V(y)
    const term =
      mod(addVal * mod(vx + vy, fieldSize), fieldSize) +
      mod(mulVal * mod(vx * vy, fieldSize), fieldSize);

    values.push(mod(term, fieldSize));
  }

  return createPolynomial(xBits + yBits, fieldSize, values);
}

/**
 * Run the GKR prover.
 *
 * Starting from a claim about the output layer V_d(outputPoint), reduces
 * layer by layer toward the input using a simplified sumcheck at each level.
 *
 * `layerChallenges[i]` provides the random challenges for the reduction
 * at layer i (from output toward input, excluding the input layer).
 *
 * Each entry in `layerChallenges` is a bigint[] whose length equals the
 * number of variables in the next layer's MLE (for deriving the next point).
 */
export function gkrProve(
  circuit: LayeredCircuit,
  outputPoint: bigint[],
  layerChallenges: bigint[][],
): GKRProof {
  const { layers, fieldSize, numLayers } = circuit;
  const numNonInputLayers = numLayers - 1;

  if (layerChallenges.length !== numNonInputLayers) {
    throw new Error(
      `Need ${numNonInputLayers} sets of layer challenges, got ${layerChallenges.length}`,
    );
  }

  // Compute MLE for the output layer and evaluate at outputPoint
  const outputLayer = layers[numLayers - 1]!;
  const outputMLE = multilinearExtension(outputLayer.values, fieldSize);
  const outputClaim = evaluateAtPoint(outputMLE, outputPoint);

  const layerProofs: GKRLayerProof[] = [];
  let currentPoint = outputPoint;
  let currentClaim = outputClaim;

  // Work from output layer (index numLayers-1) toward layer 1 (first non-input layer)
  for (let step = 0; step < numNonInputLayers; step++) {
    // layerIdx is the index of the current layer being proved
    const layerIdx = numLayers - 1 - step;
    const layer = layers[layerIdx]!;
    const prevLayer = layers[layerIdx - 1]!;
    const prevLayerSize = prevLayer.values.length;
    const challenges = layerChallenges[step]!;

    // Compute the MLE of the previous (input-side) layer
    const prevMLE = multilinearExtension(prevLayer.values, fieldSize);

    // Compute the reduction polynomial f(x,y) for this layer
    const reductionPoly = computeLayerReductionPoly(
      layer,
      prevLayerSize,
      prevMLE,
      currentPoint,
      fieldSize,
    );

    // Simplified sumcheck: compute the honest sum over the boolean hypercube
    // and produce a single-round "sumcheck polynomial" — the univariate
    // restriction along each challenge coordinate.
    const numReductionVars = reductionPoly.numVars;
    const sumcheckPolys: bigint[][] = [];
    const fixedSoFar: bigint[] = [];

    // For each variable in the reduction polynomial, compute the
    // univariate poly g_i(x_i) = sum over remaining free vars
    for (let v = 0; v < numReductionVars; v++) {
      const challengeIdx = v < challenges.length ? v : challenges.length - 1;
      const challenge = challenges[challengeIdx]!;

      // Compute g_v(0) and g_v(1)
      const freeCount = numReductionVars - v - 1;
      const numFree = 1 << freeCount;
      let g0 = 0n;
      let g1 = 0n;

      for (let mask = 0; mask < numFree; mask++) {
        const point0: bigint[] = [...fixedSoFar, 0n];
        const point1: bigint[] = [...fixedSoFar, 1n];
        for (let b = freeCount - 1; b >= 0; b--) {
          const bit = BigInt((mask >> b) & 1);
          point0.push(bit);
          point1.push(bit);
        }
        g0 = mod(g0 + evaluateAtPoint(reductionPoly, point0), fieldSize);
        g1 = mod(g1 + evaluateAtPoint(reductionPoly, point1), fieldSize);
      }

      // Coefficients: g(x) = g0 + (g1 - g0) * x
      const c0 = g0;
      const c1 = mod(g1 - g0, fieldSize);
      sumcheckPolys.push([c0, c1]);

      fixedSoFar.push(challenge);
    }

    // The next point is derived from the challenges — split into x and y parts
    const prevBits = bitsNeeded(prevLayerSize);
    const nextPoint: bigint[] = [];
    for (let i = 0; i < prevBits; i++) {
      nextPoint.push(i < challenges.length ? challenges[i]! : 0n);
    }

    // Evaluate the previous layer's MLE at the next point
    const reducedClaim = evaluateAtPoint(prevMLE, nextPoint);

    layerProofs.push({
      layerIndex: layerIdx,
      claim: currentClaim,
      sumcheckPoly: sumcheckPolys,
      challenges,
      reducedClaim,
      nextPoint,
    });

    currentPoint = nextPoint;
    currentClaim = reducedClaim;
  }

  // Final evaluation at the input layer
  const inputMLE = multilinearExtension(layers[0]!.values, fieldSize);
  const inputEval = evaluateAtPoint(inputMLE, currentPoint);

  return {
    outputClaim,
    outputPoint,
    layerProofs,
    inputEval,
  };
}

/**
 * Verify a GKR proof.
 *
 * 1. Check the output claim: V_output(outputPoint) matches the actual MLE.
 * 2. For each layer proof, verify the sumcheck consistency:
 *    - The round polynomials g_i(0) + g_i(1) chain correctly.
 *    - The final reduced claim at the next point matches V_{next}(nextPoint).
 * 3. Check that the final input evaluation matches the actual input MLE.
 */
export function gkrVerify(
  circuit: LayeredCircuit,
  proof: GKRProof,
): GKRVerification {
  const { layers, fieldSize, numLayers } = circuit;

  // Step 1: verify the output claim
  const outputLayer = layers[numLayers - 1]!;
  const outputMLE = multilinearExtension(outputLayer.values, fieldSize);
  const actualOutputEval = evaluateAtPoint(outputMLE, proof.outputPoint);

  if (actualOutputEval !== proof.outputClaim) {
    return {
      passed: false,
      failedLayer: numLayers - 1,
      reason: `Output claim mismatch: expected ${actualOutputEval}, got ${proof.outputClaim}`,
    };
  }

  // Step 2: verify each layer proof
  let expectedClaim = proof.outputClaim;

  for (let step = 0; step < proof.layerProofs.length; step++) {
    const lp = proof.layerProofs[step]!;

    // Check that the claim matches what we expect
    if (lp.claim !== expectedClaim) {
      return {
        passed: false,
        failedLayer: lp.layerIndex,
        reason: `Layer ${lp.layerIndex} claim mismatch: expected ${expectedClaim}, got ${lp.claim}`,
      };
    }

    // Verify sumcheck round consistency:
    // For each round polynomial, g_i(0) + g_i(1) should equal the previous
    // round's evaluation at its challenge.
    if (lp.sumcheckPoly.length > 0) {
      // The sum of the first round poly at 0 and 1 should equal the layer claim
      const firstCoeffs = lp.sumcheckPoly[0]!;
      const firstG0 = firstCoeffs[0]!; // g(0) = c0
      const firstG1 = mod(firstCoeffs[0]! + firstCoeffs[1]!, fieldSize); // g(1) = c0 + c1
      const firstSum = mod(firstG0 + firstG1, fieldSize);

      // Compute the actual sum over the reduction polynomial's boolean hypercube
      const layer = layers[lp.layerIndex]!;
      const prevLayer = layers[lp.layerIndex - 1]!;
      const prevMLE = multilinearExtension(prevLayer.values, fieldSize);

      // Determine current point for this layer
      const currentPoint =
        step === 0 ? proof.outputPoint : proof.layerProofs[step - 1]!.nextPoint;

      const reductionPoly = computeLayerReductionPoly(
        layer,
        prevLayer.values.length,
        prevMLE,
        currentPoint,
        fieldSize,
      );

      // Compute the actual sum over the boolean hypercube
      let actualSum = 0n;
      const numEvals = 1 << reductionPoly.numVars;
      for (let i = 0; i < numEvals; i++) {
        const bits = i.toString(2).padStart(reductionPoly.numVars, '0');
        actualSum = mod(
          actualSum + (reductionPoly.evaluations.get(bits) ?? 0n),
          fieldSize,
        );
      }

      if (firstSum !== actualSum) {
        return {
          passed: false,
          failedLayer: lp.layerIndex,
          reason: `Layer ${lp.layerIndex} sumcheck round 1 failed: sum ${firstSum} != expected ${actualSum}`,
        };
      }

      // Verify chaining of round polynomials
      let prevEval = lp.claim;
      for (let r = 0; r < lp.sumcheckPoly.length; r++) {
        const coeffs = lp.sumcheckPoly[r]!;
        const g0 = coeffs[0]!;
        const g1 = mod(coeffs[0]! + (coeffs[1] ?? 0n), fieldSize);
        const roundSum = mod(g0 + g1, fieldSize);

        if (roundSum !== prevEval) {
          return {
            passed: false,
            failedLayer: lp.layerIndex,
            reason: `Layer ${lp.layerIndex} sumcheck round ${r + 1} sum ${roundSum} != expected ${prevEval}`,
          };
        }

        // Evaluate at the challenge for next round
        const challenge =
          r < lp.challenges.length ? lp.challenges[r]! : lp.challenges[lp.challenges.length - 1]!;
        prevEval = mod(g0 + mod((coeffs[1] ?? 0n) * challenge, fieldSize), fieldSize);
      }
    }

    // Check the reduced claim against the actual next layer MLE
    const prevLayer = layers[lp.layerIndex - 1]!;
    const prevMLE = multilinearExtension(prevLayer.values, fieldSize);
    const actualReduced = evaluateAtPoint(prevMLE, lp.nextPoint);

    if (actualReduced !== lp.reducedClaim) {
      return {
        passed: false,
        failedLayer: lp.layerIndex,
        reason: `Layer ${lp.layerIndex} reduced claim mismatch: expected ${actualReduced}, got ${lp.reducedClaim}`,
      };
    }

    expectedClaim = lp.reducedClaim;
  }

  // Step 3: check the final input evaluation
  const inputMLE = multilinearExtension(layers[0]!.values, fieldSize);
  const lastProof = proof.layerProofs[proof.layerProofs.length - 1]!;
  const actualInputEval = evaluateAtPoint(inputMLE, lastProof.nextPoint);

  if (actualInputEval !== proof.inputEval) {
    return {
      passed: false,
      failedLayer: 0,
      reason: `Input evaluation mismatch: expected ${actualInputEval}, got ${proof.inputEval}`,
    };
  }

  return {
    passed: true,
    failedLayer: null,
    reason: null,
  };
}

/**
 * Return data for a single step of the GKR proof (for animation).
 *
 * Step 0 corresponds to the output layer proof, step 1 to the next layer
 * inward, etc.  Returns null if stepIndex is out of range.
 */
export function gkrStep(
  circuit: LayeredCircuit,
  proof: GKRProof,
  stepIndex: number,
): GKRStepInfo | null {
  if (stepIndex < 0 || stepIndex >= proof.layerProofs.length) {
    return null;
  }

  const lp = proof.layerProofs[stepIndex]!;
  const layer = circuit.layers[lp.layerIndex]!;
  const numGates = layer.gates.length;
  const gateTypes = layer.gates.map((g) => g.type).join(', ');

  const totalLayers = circuit.numLayers;
  const isLast = stepIndex === proof.layerProofs.length - 1;

  let description: string;
  if (stepIndex === 0) {
    description =
      `Reducing output layer (${numGates} gate${numGates > 1 ? 's' : ''}: ${gateTypes}). ` +
      `Claim: V(r) = ${lp.claim}. ` +
      `After sumcheck, reduced claim on layer ${lp.layerIndex - 1}: ${lp.reducedClaim}.`;
  } else if (isLast) {
    description =
      `Final reduction at layer ${lp.layerIndex} (${numGates} gate${numGates > 1 ? 's' : ''}: ${gateTypes}). ` +
      `Claim: ${lp.claim} → reduced to input layer claim: ${lp.reducedClaim}. ` +
      `Input MLE evaluation: ${proof.inputEval}.`;
  } else {
    description =
      `Reducing layer ${lp.layerIndex} (${numGates} gate${numGates > 1 ? 's' : ''}: ${gateTypes}). ` +
      `Claim: ${lp.claim} → reduced claim: ${lp.reducedClaim}.`;
  }

  return {
    layerProof: lp,
    layerIndex: lp.layerIndex,
    totalLayers,
    description,
  };
}
