export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % mod;
    }
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function nextPrime(n: number): number {
  if (n < 2) return 2;
  let candidate = n % 2 === 0 ? n + 1 : n + 2;
  while (!isPrime(candidate)) candidate += 2;
  return candidate;
}

export function generatePrimes(count: number): number[] {
  const primes: number[] = [];
  let n = 2;
  while (primes.length < count) {
    if (isPrime(n)) primes.push(n);
    n++;
  }
  return primes;
}

export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b > 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function extendedGcd(a: bigint, b: bigint): { gcd: bigint; x: bigint; y: bigint } {
  if (a === 0n) return { gcd: b, x: 0n, y: 1n };
  const result = extendedGcd(b % a, a);
  return {
    gcd: result.gcd,
    x: result.y - (b / a) * result.x,
    y: result.x,
  };
}

export function modInverse(a: bigint, mod: bigint): bigint {
  const result = extendedGcd(((a % mod) + mod) % mod, mod);
  if (result.gcd !== 1n) throw new Error('No modular inverse exists');
  return ((result.x % mod) + mod) % mod;
}

export function polynomialEvaluate(coeffs: number[], x: number): number {
  // Horner's method: coeffs[0] + coeffs[1]*x + coeffs[2]*x^2 + ...
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * x + (coeffs[i] ?? 0);
  }
  return result;
}

export function lagrangeInterpolation(points: { x: number; y: number }[]): number[] {
  const n = points.length;
  const coeffs = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    // Build the i-th Lagrange basis polynomial
    let basis = [points[i]!.y];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const denom = points[i]!.x - points[j]!.x;
      if (Math.abs(denom) < 1e-10) continue;
      const scale = 1 / denom;
      // Multiply basis by (x - points[j].x) * scale
      const newBasis = new Array(basis.length + 1).fill(0);
      for (let k = 0; k < basis.length; k++) {
        newBasis[k + 1]! += basis[k]! * scale;
        newBasis[k]! += basis[k]! * (-points[j]!.x * scale);
      }
      basis = newBasis;
    }
    for (let k = 0; k < basis.length && k < n; k++) {
      coeffs[k]! += basis[k]!;
    }
  }

  return coeffs.map((c) => Math.round(c * 1e10) / 1e10);
}

export function polynomialAdd(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    result.push((a[i] ?? 0) + (b[i] ?? 0));
  }
  return result;
}

export function polynomialMultiply(a: number[], b: number[]): number[] {
  if (a.length === 0 || b.length === 0) return [];
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] += (a[i] ?? 0) * (b[j] ?? 0);
    }
  }
  return result;
}

export function polynomialScale(coeffs: number[], scalar: number): number[] {
  return coeffs.map((c) => c * scalar);
}
