/**
 * projection.ts — manual perspective-projection fallback for non-Three tooling
 * (and a parity reference for tests). Three.js performs the real projection in
 * the live view; this module mirrors it with an explicit look-at camera.
 */

import { Vec3 } from './geometry3d';

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

// rotation helpers (per the WO's stated convention)
export function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}
export function rotateX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
}

export interface Projected {
  x: number; // NDC x  [-1, 1] within frustum
  y: number; // NDC y
  depth: number; // view-space depth (>0 in front)
  visible: boolean;
}

/**
 * Perspective project a world point with an explicit look-at camera.
 * fov is the vertical field of view in radians; aspect = width/height.
 */
export function projectPoint(
  p: Vec3,
  eye: Vec3,
  target: Vec3,
  up: Vec3,
  fov: number,
  aspect: number,
): Projected {
  const forward = normalize(sub(target, eye));
  const right = normalize(cross(forward, up));
  const trueUp = cross(right, forward);

  const rel = sub(p, eye);
  const cx = dot(rel, right);
  const cy = dot(rel, trueUp);
  const cz = dot(rel, forward); // depth along view axis

  if (cz <= 1e-6) return { x: 0, y: 0, depth: cz, visible: false };

  const f = 1 / Math.tan(fov / 2);
  const x = (f / aspect) * (cx / cz);
  const y = f * (cy / cz);
  return { x, y, depth: cz, visible: Math.abs(x) <= 1 && Math.abs(y) <= 1 };
}
