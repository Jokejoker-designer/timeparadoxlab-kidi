/**
 * geometry3d.ts — pure geometry builders for the (x, t, α) volume.
 *
 * Every builder returns a plain typed descriptor (no Three.js types here) so the
 * geometry can be unit-tested headlessly and re-used by any renderer. Builders
 * never emit NaN vertices (asserted by the self-tests).
 *
 * Scene convention (right-handed):  X = x (space),  Y = t (time),  Z = α (alpha).
 */

import { Diagnostics, arrivalNumber } from './simulation';

export type Vec3 = [number, number, number];

export interface LineGeometry {
  id: string;
  kind: 'line';
  points: Vec3[];
}

export interface MeshGeometry {
  id: string;
  kind: 'mesh';
  /** flat XYZ triples */
  positions: number[];
  /** triangle indices */
  indices: number[];
}

export interface PointGeometry {
  id: string;
  kind: 'point';
  position: Vec3;
  label?: string;
}

export interface Bounds {
  xMin: number;
  xMax: number;
  tMin: number;
  tMax: number;
  alphaMin: number;
  alphaMax: number;
}

export interface SceneGeometry {
  bounds: Bounds;
  worldlines: LineGeometry[];
  loci: MeshGeometry[];
  nullSurface: MeshGeometry[];
  signal: LineGeometry;
  markers: PointGeometry[];
}

// --- helpers ----------------------------------------------------------------

export function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a];
  const out = new Array<number>(n);
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + i * step;
  return out;
}

export function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

/** any NaN/∞ in a flat positions array? */
export function hasNonFinite(positions: number[]): boolean {
  for (let i = 0; i < positions.length; i++) if (!Number.isFinite(positions[i])) return true;
  return false;
}

// --- worldlines -------------------------------------------------------------

export function buildWorldline(id: string, x: number, tMin: number, tMax: number): LineGeometry {
  return { id, kind: 'line', points: [[x, tMin, 0], [x, tMax, 0]] };
}

// --- singular loci planes  α = ±x  (ruled along t) --------------------------

/**
 * Plane α = sign·x extruded across [tMin,tMax] as a quad (two triangles).
 * sign = +1 → Π₊ (α=x);  sign = −1 → Π₋ (α=−x).
 */
export function buildSingularPlane(
  id: string,
  sign: 1 | -1,
  xMin: number,
  xMax: number,
  tMin: number,
  tMax: number,
): MeshGeometry {
  const corners: Vec3[] = [
    [xMin, tMin, sign * xMin],
    [xMax, tMin, sign * xMax],
    [xMax, tMax, sign * xMax],
    [xMin, tMax, sign * xMin],
  ];
  const positions = corners.flat();
  const indices = [0, 1, 2, 0, 2, 3];
  return { id, kind: 'mesh', positions, indices };
}

// --- null surface from a send event -----------------------------------------

/**
 * The signal null condition  (x−xS)² − (α−αS)² = (cτ)²,  τ = t − tS.
 * For each (τ, α): rad = (cτ)² + (α−αS)² ≥ 0, so x = xS ± √rad is always real
 * (no NaN). Builds one triangulated sheet per ± branch.
 */
export function buildNullSurface(
  send: Vec3,
  c: number,
  tauMax: number,
  alphaMax: number,
  nT = 24,
  nA = 24,
): MeshGeometry[] {
  const [xS, tS, alphaS] = send;
  const taus = linspace(-tauMax, tauMax, nT);
  const alphas = linspace(alphaS - alphaMax, alphaS + alphaMax, nA);

  const buildSheet = (id: string, branch: 1 | -1): MeshGeometry => {
    const positions: number[] = [];
    for (let i = 0; i < nT; i++) {
      for (let k = 0; k < nA; k++) {
        const tau = taus[i];
        const a = alphas[k];
        const rad = (c * tau) ** 2 + (a - alphaS) ** 2;
        const x = xS + branch * Math.sqrt(rad);
        positions.push(x, tS + tau, a);
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < nT - 1; i++) {
      for (let k = 0; k < nA - 1; k++) {
        const v00 = i * nA + k;
        const v01 = i * nA + (k + 1);
        const v10 = (i + 1) * nA + k;
        const v11 = (i + 1) * nA + (k + 1);
        indices.push(v00, v10, v11, v00, v11, v01);
      }
    }
    return { id, kind: 'mesh', positions, indices };
  };

  return [buildSheet('null-plus', 1), buildSheet('null-minus', -1)];
}

// --- signal path ------------------------------------------------------------

/**
 * Didactic signal segment from the send point to the interpreted arrival point.
 * NOT a claim of a physical geodesic — a visualization aid only. If the arrival
 * is non-finite (e.g. Bottom), the segment degenerates to a point (no NaN).
 */
export function buildSignalPath(send: Vec3, arrive: Vec3): LineGeometry {
  const end = isFiniteVec(arrive) ? arrive : send;
  return { id: 'signal', kind: 'line', points: [send, end] };
}

// --- assemble the whole scene from diagnostics ------------------------------

export function computeBounds(diag: Diagnostics, pad = 1.5): Bounds {
  const { xBob, xAlice, tSend } = diag.scenario;
  const alpha = diag.phase.alpha;
  const xMin = Math.min(xBob, xAlice) - pad;
  const xMax = Math.max(xBob, xAlice) + pad;
  const span = Math.max(Math.abs(xMax), Math.abs(xMin), Math.abs(alpha) + pad, 6);
  return {
    xMin: -span,
    xMax: span,
    tMin: Math.min(-1, tSend - 4),
    tMax: Math.max(tSend + 6, 9),
    alphaMin: -span,
    alphaMax: span,
  };
}

export function buildSceneGeometry(diag: Diagnostics): SceneGeometry {
  const b = computeBounds(diag);
  const { xBob, xAlice, tSend, c } = diag.scenario;
  const alpha = diag.phase.alpha;
  const arriveT = arrivalNumber(diag.arrival);

  const send: Vec3 = [xBob, tSend, 0];
  const arrive: Vec3 = [xAlice, arriveT, alpha];

  const tauMax = Math.max(b.tMax - tSend, tSend - b.tMin, 6);
  const alphaMax = b.alphaMax;

  return {
    bounds: b,
    worldlines: [
      buildWorldline('bob', xBob, b.tMin, b.tMax),
      buildWorldline('alice', xAlice, b.tMin, b.tMax),
    ],
    loci: [
      buildSingularPlane('locus-plus', 1, b.xMin, b.xMax, b.tMin, b.tMax),
      buildSingularPlane('locus-minus', -1, b.xMin, b.xMax, b.tMin, b.tMax),
    ],
    nullSurface: buildNullSurface(send, c, tauMax, alphaMax),
    signal: buildSignalPath(send, arrive),
    markers: [
      { id: 'send', kind: 'point', position: send, label: 'SEND' },
      { id: 'arrive', kind: 'point', position: isFiniteVec(arrive) ? arrive : send, label: 'RECEIVE' },
    ],
  };
}
