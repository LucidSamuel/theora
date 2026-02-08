// --- Easings ---

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

// --- Interpolation ---

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const;
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// --- Spring Physics ---

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface SpringState {
  value: number;
  velocity: number;
  target: number;
}

export const defaultSpringConfig: SpringConfig = {
  stiffness: 180,
  damping: 20,
  mass: 1,
};

export function springStep(state: SpringState, config: SpringConfig, dt: number): SpringState {
  const displacement = state.value - state.target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * state.velocity;
  const acceleration = (springForce + dampingForce) / config.mass;
  const velocity = state.velocity + acceleration * dt;
  const value = state.value + velocity * dt;
  return { value, velocity, target: state.target };
}

// --- Spring2D ---

export interface Spring2D {
  x: SpringState;
  y: SpringState;
  config: SpringConfig;
}

export function createSpring2D(x: number, y: number, config?: Partial<SpringConfig>): Spring2D {
  const cfg = { ...defaultSpringConfig, ...config };
  return {
    x: { value: x, velocity: 0, target: x },
    y: { value: y, velocity: 0, target: y },
    config: cfg,
  };
}

export function spring2DStep(spring: Spring2D, dt: number): Spring2D {
  return {
    x: springStep(spring.x, spring.config, dt),
    y: springStep(spring.y, spring.config, dt),
    config: spring.config,
  };
}

export function spring2DSetTarget(spring: Spring2D, tx: number, ty: number): Spring2D {
  return {
    ...spring,
    x: { ...spring.x, target: tx },
    y: { ...spring.y, target: ty },
  };
}

export function spring2DIsSettled(spring: Spring2D, threshold = 0.5): boolean {
  return (
    Math.abs(spring.x.value - spring.x.target) < threshold &&
    Math.abs(spring.y.value - spring.y.target) < threshold &&
    Math.abs(spring.x.velocity) < threshold &&
    Math.abs(spring.y.velocity) < threshold
  );
}

// --- Tweens ---

export interface Tween {
  start: number;
  end: number;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
}

export function tweenValue(tween: Tween, currentTime: number): number {
  const elapsed = currentTime - tween.startTime;
  const t = Math.min(1, Math.max(0, elapsed / tween.duration));
  return lerp(tween.start, tween.end, tween.easing(t));
}

export function tweenComplete(tween: Tween, currentTime: number): boolean {
  return currentTime - tween.startTime >= tween.duration;
}
