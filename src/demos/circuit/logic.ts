function mod(value: number, p: number): number {
  return ((value % p) + p) % p;
}

export function normalizeValue(value: number, fieldSize?: number): number {
  return fieldSize ? mod(value, fieldSize) : value;
}

export interface Witness {
  x: number;
  y: number;
  t: number;
  z: number;
}

export interface ConstraintCheck {
  label: string;
  left: number;
  right: number;
  satisfied: boolean;
}

export interface R1CSRow {
  label: string;
  A: number[];
  B: number[];
  C: number[];
}

export interface Bootle16MulConstraint {
  label: string;
  leftWire: keyof Witness;
  rightWire: keyof Witness;
  outputWire: keyof Witness;
  left: number;
  right: number;
  output: number;
  satisfied: boolean;
}

export interface Bootle16LinearConstraint {
  label: string;
  coefficients: number[];
  constant: number;
  evaluation: number;
  satisfied: boolean;
  equation: string;
}

export interface Bootle16Breakdown {
  columns: string[];
  multiplication: Bootle16MulConstraint[];
  linear: Bootle16LinearConstraint[];
}

export interface PlonkGate {
  label: string;
  // Selector coefficients
  qM: number; // multiplication selector
  qL: number; // left wire selector
  qR: number; // right wire selector
  qO: number; // output wire selector
  qC: number; // constant selector
  // Wire assignments
  a: { wire: string; value: number };
  b: { wire: string; value: number };
  c: { wire: string; value: number };
  // Evaluation: qM·a·b + qL·a + qR·b + qO·c + qC = 0
  evaluation: number;
  satisfied: boolean;
}

export function normalizeWitness(witness: Witness, fieldSize?: number): Witness {
  return {
    x: normalizeValue(witness.x, fieldSize),
    y: normalizeValue(witness.y, fieldSize),
    t: normalizeValue(witness.t, fieldSize),
    z: normalizeValue(witness.z, fieldSize),
  };
}

export function getExpectedT(x: number, fieldSize?: number): number {
  return normalizeValue(x * x, fieldSize);
}

export function getValidOutput(x: number, y: number, fieldSize?: number): number {
  return normalizeValue(getExpectedT(x, fieldSize) + y, fieldSize);
}

export function buildWitness(x: number, y: number, z: number, fieldSize?: number): Witness {
  return normalizeWitness({ x, y, t: getExpectedT(x, fieldSize), z }, fieldSize);
}

export function evaluateCircuit(witness: Witness, broken: boolean, fieldSize?: number): ConstraintCheck[] {
  const normalizedWitness = normalizeWitness(witness, fieldSize);
  const mul = getExpectedT(normalizedWitness.x, fieldSize);
  const add = normalizeValue(normalizedWitness.t + normalizedWitness.y, fieldSize);
  const constraints: ConstraintCheck[] = [
    {
      label: fieldSize ? `t ≡ x * x (mod ${fieldSize})` : 't = x * x',
      left: normalizedWitness.t,
      right: mul,
      satisfied: normalizedWitness.t === mul,
    },
  ];

  if (!broken) {
    constraints.push({
      label: fieldSize ? `z ≡ t + y (mod ${fieldSize})` : 'z = t + y',
      left: normalizedWitness.z,
      right: add,
      satisfied: normalizedWitness.z === add,
    });
  }

  return constraints;
}

export function witnessSatisfiesAll(witness: Witness, broken: boolean, fieldSize?: number): boolean {
  return evaluateCircuit(witness, broken, fieldSize).every((constraint) => constraint.satisfied);
}

export function getR1CSRows(broken: boolean): R1CSRow[] {
  // Witness vector: w = [1, x, y, t, z]
  //   index:           0  1  2  3  4
  return [
    { label: 'x · x = t', A: [0, 1, 0, 0, 0], B: [0, 1, 0, 0, 0], C: [0, 0, 0, 1, 0] },
    ...(broken ? [] : [{ label: '1 · (t + y) = z', A: [0, 0, 1, 1, 0], B: [1, 0, 0, 0, 0], C: [0, 0, 0, 0, 1] }]),
  ];
}

export function getBootle16Breakdown(witness: Witness, broken: boolean, fieldSize?: number): Bootle16Breakdown {
  const normalizedWitness = normalizeWitness(witness, fieldSize);
  const mul = getExpectedT(normalizedWitness.x, fieldSize);
  const linEval = normalizeValue(normalizedWitness.z - normalizedWitness.t - normalizedWitness.y, fieldSize);
  const columns = ['1', 'x', 'y', 't', 'z'];
  const multiplication: Bootle16MulConstraint[] = [
    {
      label: 'mul_0',
      leftWire: 'x',
      rightWire: 'x',
      outputWire: 't',
      left: normalizedWitness.x,
      right: normalizedWitness.x,
      output: normalizedWitness.t,
      satisfied: normalizedWitness.t === mul,
    },
  ];

  const linear: Bootle16LinearConstraint[] = broken
    ? []
    : [
        {
          label: 'lin_0',
          coefficients: [0, 0, -1, -1, 1],
          constant: 0,
          evaluation: linEval,
          satisfied: linEval === 0,
          equation: 'z - t - y = 0',
        },
      ];

  return { columns, multiplication, linear };
}

export function getExploitWitness(x: number, y: number, fieldSize?: number): Witness {
  const t = getExpectedT(x, fieldSize);
  const correctZ = getValidOutput(x, y, fieldSize);
  return normalizeWitness({ x, y, t, z: correctZ + 5 }, fieldSize);
}

export function getPlonkGates(witness: Witness, broken: boolean, fieldSize?: number): PlonkGate[] {
  const normalizedWitness = normalizeWitness(witness, fieldSize);
  const m = (v: number) => normalizeValue(v, fieldSize);
  const gates: PlonkGate[] = [
    {
      label: 'gate_0: x · x - t = 0',
      qM: 1, qL: 0, qR: 0, qO: -1, qC: 0,
      a: { wire: 'x', value: normalizedWitness.x },
      b: { wire: 'x', value: normalizedWitness.x },
      c: { wire: 't', value: normalizedWitness.t },
      evaluation: m(normalizedWitness.x * normalizedWitness.x - normalizedWitness.t),
      satisfied: m(normalizedWitness.x * normalizedWitness.x - normalizedWitness.t) === 0,
    },
  ];
  if (!broken) {
    gates.push({
      label: 'gate_1: t + y - z = 0',
      qM: 0, qL: 1, qR: 1, qO: -1, qC: 0,
      a: { wire: 't', value: normalizedWitness.t },
      b: { wire: 'y', value: normalizedWitness.y },
      c: { wire: 'z', value: normalizedWitness.z },
      evaluation: m(normalizedWitness.t + normalizedWitness.y - normalizedWitness.z),
      satisfied: m(normalizedWitness.t + normalizedWitness.y - normalizedWitness.z) === 0,
    });
  }
  return gates;
}
