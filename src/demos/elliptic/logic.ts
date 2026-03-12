export interface CurveConfig {
  p: number;
  a: number;
  b: number;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface ScalarStep {
  type: 'double' | 'add';
  scalarBit: number;
  accumulator: CurvePoint | null;
}

export const DEFAULT_CURVE: CurveConfig = { p: 97, a: 2, b: 3 };

export function mod(value: number, p: number): number {
  return ((value % p) + p) % p;
}

export function modInverse(value: number, p: number): number {
  let t = 0;
  let newT = 1;
  let r = p;
  let newR = mod(value, p);

  while (newR !== 0) {
    const quotient = Math.floor(r / newR);
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r !== 1) {
    throw new Error('Inverse does not exist');
  }

  return mod(t, p);
}

export function isOnCurve(point: CurvePoint | null, curve: CurveConfig = DEFAULT_CURVE): boolean {
  if (point === null) return true;
  const left = mod(point.y * point.y, curve.p);
  const right = mod(point.x * point.x * point.x + curve.a * point.x + curve.b, curve.p);
  return left === right;
}

export function enumerateCurvePoints(curve: CurveConfig = DEFAULT_CURVE): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let x = 0; x < curve.p; x++) {
    const rhs = mod(x * x * x + curve.a * x + curve.b, curve.p);
    for (let y = 0; y < curve.p; y++) {
      if (mod(y * y, curve.p) === rhs) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

export function negatePoint(point: CurvePoint | null, curve: CurveConfig = DEFAULT_CURVE): CurvePoint | null {
  if (point === null) return null;
  return { x: point.x, y: mod(-point.y, curve.p) };
}

export function addPoints(
  p1: CurvePoint | null,
  p2: CurvePoint | null,
  curve: CurveConfig = DEFAULT_CURVE
): CurvePoint | null {
  if (p1 === null) return p2;
  if (p2 === null) return p1;
  if (p1.x === p2.x && mod(p1.y + p2.y, curve.p) === 0) return null;

  const slope =
    p1.x === p2.x && p1.y === p2.y
      ? mod((3 * p1.x * p1.x + curve.a) * modInverse(2 * p1.y, curve.p), curve.p)
      : mod((p2.y - p1.y) * modInverse(p2.x - p1.x, curve.p), curve.p);

  const x3 = mod(slope * slope - p1.x - p2.x, curve.p);
  const y3 = mod(slope * (p1.x - x3) - p1.y, curve.p);
  return { x: x3, y: y3 };
}

export function scalarMultiply(
  point: CurvePoint | null,
  scalar: number,
  curve: CurveConfig = DEFAULT_CURVE
): { result: CurvePoint | null; steps: ScalarStep[] } {
  let accumulator: CurvePoint | null = null;
  let current = point;
  let k = scalar;
  const steps: ScalarStep[] = [];

  while (k > 0 && current) {
    const bit = k & 1;
    if (bit === 1) {
      accumulator = addPoints(accumulator, current, curve);
      steps.push({ type: 'add', scalarBit: bit, accumulator });
    }
    current = addPoints(current, current, curve);
    steps.push({ type: 'double', scalarBit: bit, accumulator: current });
    k >>= 1;
  }

  return { result: accumulator, steps };
}

export function pointLabel(point: CurvePoint | null): string {
  return point ? `(${point.x}, ${point.y})` : '∞';
}

export function getDefaultGenerator(curve: CurveConfig = DEFAULT_CURVE): CurvePoint {
  return enumerateCurvePoints(curve)[0]!;
}

export function pastaCycleSummary() {
  return [
    { curve: 'Pallas', field: 'F_pallas', scalar: 'F_vesta', role: 'Outer proof curve' },
    { curve: 'Vesta', field: 'F_vesta', scalar: 'F_pallas', role: 'Inner verifier curve' },
  ];
}
