export interface V3 {
  x: number;
  y: number;
  z?: number;
}

const z = (p: V3) => p.z ?? 0;

export function sub(a: V3, b: V3): { x: number; y: number; z: number } {
  return { x: a.x - b.x, y: a.y - b.y, z: z(a) - z(b) };
}

export function mag(v: V3): number {
  return Math.hypot(v.x, v.y, z(v));
}

export function dist(a: V3, b: V3): number {
  return mag(sub(a, b));
}

/** Angle in degrees between two vectors (3D; 2D inputs treated as z=0). */
export function angleBetweenDeg(a: V3, b: V3): number {
  const d = a.x * b.x + a.y * b.y + z(a) * z(b);
  const m = mag(a) * mag(b);
  if (m === 0) return 0;
  const c = Math.min(1, Math.max(-1, d / m));
  return (Math.acos(c) * 180) / Math.PI;
}

/** Angle in degrees at vertex b, formed by points a-b-c. */
export function angleAtDeg(a: V3, b: V3, c: V3): number {
  return angleBetweenDeg(sub(a, b), sub(c, b));
}

/**
 * Frontal-plane valgus: deviation (deg) of the knee off the hip->ankle line,
 * signed positive when the knee sits medially (toward midlineX).
 * Uses x/y only — callers pass frontal-view world coords.
 */
export function valgusDeviationDeg(
  hip: V3,
  knee: V3,
  ankle: V3,
  midlineX: number,
): number {
  const line = sub(ankle, hip);
  const toKnee = sub(knee, hip);
  const dev = angleBetweenDeg(
    { x: line.x, y: line.y },
    { x: toKnee.x, y: toKnee.y },
  );
  const len2 = line.x * line.x + line.y * line.y;
  if (len2 === 0) return 0;
  const t = (toKnee.x * line.x + toKnee.y * line.y) / len2;
  const offsetX = knee.x - (hip.x + t * line.x);
  const medial = Math.sign(midlineX - hip.x) || 1;
  return Math.sign(offsetX) === medial ? dev : -dev;
}

/** Centered moving average, window must be odd. */
export function smooth(series: number[], window = 3): number[] {
  const half = (window - 1) / 2;
  return series.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(series.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += series[j];
    return sum / (hi - lo + 1);
  });
}
