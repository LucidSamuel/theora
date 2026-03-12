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

export function getR1CSRows(broken: boolean) {
  return [
    { label: 'x * x = t', A: [1, 0, 0, 0], B: [1, 0, 0, 0], C: [0, 0, 1, 0] },
    ...(broken ? [] : [{ label: '1 * (t + y) = z', A: [0, 0, 1, 1], B: [0, 0, 0, 0], C: [0, 0, 0, 1] }]),
  ];
}

export function getExploitWitness(x: number, y: number): Witness {
  return {
    x,
    y,
    t: x * x,
    z: x * x + y + 5,
  };
}
