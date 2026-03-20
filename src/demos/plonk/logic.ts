export interface PlonkGate {
  qL: number; // left input selector
  qR: number; // right input selector
  qO: number; // output selector
  qM: number; // multiplication selector
  qC: number; // constant selector
  a: number; // left wire value
  b: number; // right wire value
  c: number; // output wire value
  label: string; // human-readable description
}

export interface CopyConstraint {
  from: { gate: number; wire: 'a' | 'b' | 'c' };
  to: { gate: number; wire: 'a' | 'b' | 'c' };
}

export interface PlonkCircuit {
  gates: PlonkGate[];
  copyConstraints: CopyConstraint[];
}

export interface PlonkAnalysis {
  gates: (PlonkGate & { satisfied: boolean; equation: string })[];
  copyConstraints: (CopyConstraint & { satisfied: boolean })[];
  allGatesSatisfied: boolean;
  allCopiesSatisfied: boolean;
  valid: boolean;
}

// Gate equation: qL·a + qR·b + qO·c + qM·a·b + qC = 0
export function checkGate(gate: PlonkGate): boolean {
  const result =
    gate.qL * gate.a +
    gate.qR * gate.b +
    gate.qO * gate.c +
    gate.qM * gate.a * gate.b +
    gate.qC;
  return result === 0;
}

export function formatGateEquation(gate: PlonkGate): string {
  const terms: string[] = [];

  const fmt = (coeff: number, val: number, label: string): string => {
    if (coeff === 0) return `0·${label}`;
    return `${coeff}·${val}`;
  };

  terms.push(fmt(gate.qL, gate.a, 'a'));
  terms.push(fmt(gate.qR, gate.b, 'b'));
  terms.push(fmt(gate.qO, gate.c, 'c'));

  const mulTerm = gate.qM === 0
    ? `0·${gate.a}·${gate.b}`
    : `${gate.qM}·${gate.a}·${gate.b}`;
  terms.push(mulTerm);

  const constTerm = String(gate.qC);

  const lhs = [...terms, constTerm].join(' + ');
  const result =
    gate.qL * gate.a +
    gate.qR * gate.b +
    gate.qO * gate.c +
    gate.qM * gate.a * gate.b +
    gate.qC;

  return `${lhs} = ${result}`;
}

// Default circuit: (3 + 4 = 7), (7 * 2 = 14)
// Gate 0 (add):       qL=1,  qR=1,  qO=-1, qM=0, qC=0   → a=3,  b=4,  c=7
// Gate 1 (mul):       qL=0,  qR=0,  qO=-1, qM=1, qC=0   → a=7,  b=2,  c=14
// Gate 2 (pub out):   qL=1,  qR=0,  qO=0,  qM=0, qC=-14 → a=14, b=0,  c=0
// Copy: gate0.c → gate1.a (both = 7)
// Copy: gate1.c → gate2.a (both = 14)
export function buildDefaultCircuit(): PlonkCircuit {
  return {
    gates: [
      { qL: 1, qR: 1, qO: -1, qM: 0, qC: 0, a: 3, b: 4, c: 7, label: 'Add: a + b = c' },
      { qL: 0, qR: 0, qO: -1, qM: 1, qC: 0, a: 7, b: 2, c: 14, label: 'Mul: a × b = c' },
      { qL: 1, qR: 0, qO: 0, qM: 0, qC: -14, a: 14, b: 0, c: 0, label: 'PubOut: a = 14' },
    ],
    copyConstraints: [
      { from: { gate: 0, wire: 'c' }, to: { gate: 1, wire: 'a' } },
      { from: { gate: 1, wire: 'c' }, to: { gate: 2, wire: 'a' } },
    ],
  };
}

function getWireValue(gate: PlonkGate, wire: 'a' | 'b' | 'c'): number {
  return gate[wire];
}

export function analyzeCircuit(circuit: PlonkCircuit): PlonkAnalysis {
  const gates = circuit.gates.map((gate) => ({
    ...gate,
    satisfied: checkGate(gate),
    equation: formatGateEquation(gate),
  }));

  const copyConstraints = circuit.copyConstraints.map((cc) => {
    const fromGate = circuit.gates[cc.from.gate];
    const toGate = circuit.gates[cc.to.gate];
    const satisfied =
      fromGate !== undefined &&
      toGate !== undefined &&
      getWireValue(fromGate, cc.from.wire) === getWireValue(toGate, cc.to.wire);
    return { ...cc, satisfied };
  });

  const allGatesSatisfied = gates.every((g) => g.satisfied);
  const allCopiesSatisfied = copyConstraints.every((cc) => cc.satisfied);

  return {
    gates,
    copyConstraints,
    allGatesSatisfied,
    allCopiesSatisfied,
    valid: allGatesSatisfied && allCopiesSatisfied,
  };
}

export function modifyWireValue(
  circuit: PlonkCircuit,
  gateIdx: number,
  wire: 'a' | 'b' | 'c',
  newValue: number
): PlonkCircuit {
  return {
    ...circuit,
    gates: circuit.gates.map((gate, idx) =>
      idx === gateIdx ? { ...gate, [wire]: newValue } : gate
    ),
  };
}
