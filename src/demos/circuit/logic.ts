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

export function buildWitness(x: number, y: number, z: number): Witness {
  return { x, y, t: x * x, z };
}

export function evaluateCircuit(witness: Witness, broken: boolean): ConstraintCheck[] {
  const constraints: ConstraintCheck[] = [
    {
      label: 't = x * x',
      left: witness.t,
      right: witness.x * witness.x,
      satisfied: witness.t === witness.x * witness.x,
    },
  ];

  if (!broken) {
    constraints.push({
      label: 'z = t + y',
      left: witness.z,
      right: witness.t + witness.y,
      satisfied: witness.z === witness.t + witness.y,
    });
  }

  return constraints;
}

export function witnessSatisfiesAll(witness: Witness, broken: boolean): boolean {
  return evaluateCircuit(witness, broken).every((constraint) => constraint.satisfied);
}

export function getR1CSRows(broken: boolean): R1CSRow[] {
  // Witness vector: w = [1, x, y, t, z]
  //   index:           0  1  2  3  4
  return [
    { label: 'x · x = t', A: [0, 1, 0, 0, 0], B: [0, 1, 0, 0, 0], C: [0, 0, 0, 1, 0] },
    ...(broken ? [] : [{ label: '1 · (t + y) = z', A: [0, 0, 1, 1, 0], B: [1, 0, 0, 0, 0], C: [0, 0, 0, 0, 1] }]),
  ];
}

export function getBootle16Breakdown(witness: Witness, broken: boolean): Bootle16Breakdown {
  const columns = ['1', 'x', 'y', 't', 'z'];
  const multiplication: Bootle16MulConstraint[] = [
    {
      label: 'mul_0',
      leftWire: 'x',
      rightWire: 'x',
      outputWire: 't',
      left: witness.x,
      right: witness.x,
      output: witness.t,
      satisfied: witness.t === witness.x * witness.x,
    },
  ];

  const linear: Bootle16LinearConstraint[] = broken
    ? []
    : [
        {
          label: 'lin_0',
          coefficients: [0, 0, -1, -1, 1],
          constant: 0,
          evaluation: witness.z - witness.t - witness.y,
          satisfied: witness.z - witness.t - witness.y === 0,
          equation: 'z - t - y = 0',
        },
      ];

  return { columns, multiplication, linear };
}

export function getExploitWitness(x: number, y: number): Witness {
  return {
    x,
    y,
    t: x * x,
    z: x * x + y + 5,
  };
}
