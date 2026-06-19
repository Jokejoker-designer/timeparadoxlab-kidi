/**
 * colorRules.ts — shared appearance mapping for typed values, used by both the
 * 2D canvases and the 3D volume so the visual language is consistent.
 *
 *   strokeWidth = w0 + kw·λ
 *   opacity     = clamp(o0 + ko·λ, 0.25, 1.0)
 *   glowRadius  = g0 + kg·λ
 *
 * No information is encoded by colour alone — every Appearance also carries a
 * text `label`, satisfying the accessibility requirement.
 */

import { SingularValue, Branch } from './singular';

export interface Appearance {
  color: string;
  opacity: number;
  thickness: number;
  glow: number;
  pulse: boolean;
  dashed: boolean;
  /** human-readable state label (never rely on colour alone) */
  label: string;
}

// tuning constants for the formulas above
const W0 = 2,
  KW = 1;
const O0 = 0.55,
  KO = 0.18;
const G0 = 0,
  KG = 1.5;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** order λ used for sizing (Real→0, Singular→order, Bottom→2). */
export function orderOf(v: SingularValue): number {
  if (v.kind === 'Real') return 0;
  if (v.kind === 'Singular') return v.order;
  return 2;
}

/** Base colour family by state (cyan→amber→orange→magenta→red). */
export function baseColor(v: SingularValue): string {
  if (v.kind === 'Real') return '#3fd0ff'; // cyan/teal
  if (v.kind === 'Bottom') return '#ff3b3b'; // saturated red
  // Singular by order
  if (v.order <= 0.5) return '#ffd23b'; // amber
  if (v.order <= 1) return '#ff7a3b'; // orange
  return '#e23bd0'; // red → magenta for λ>1
}

/** Branch hue accent (forward greenish, reverse reddish, loop/feedback violet). */
export function branchAccent(branch: Branch): string {
  switch (branch) {
    case '+':
      return '#56e39f';
    case '-':
      return '#ff7a3b';
    case 'loop':
    case 'feedback':
    case 'mixed':
      return '#b06bff';
    default:
      return '#9fb6d6';
  }
}

export function stateLabel(v: SingularValue): string {
  if (v.kind === 'Real') return 'Real';
  if (v.kind === 'Bottom') return 'Bottom (⊥)';
  const ord = v.order === 0.5 ? '½' : String(v.order);
  return `Singular λ=${ord} (${v.branch})`;
}

/** Full appearance for a typed value, optionally biased by an explicit branch. */
export function appearanceForValue(v: SingularValue, branch: Branch = 'plain'): Appearance {
  const lambda = orderOf(v);
  const isReverse = branch === '-' || (v.kind === 'Singular' && v.branch === '-');
  return {
    color: baseColor(v),
    opacity: clamp(O0 + KO * lambda, 0.25, 1.0),
    thickness: W0 + KW * lambda,
    glow: G0 + KG * lambda,
    pulse: v.kind === 'Singular' && Math.abs(v.order - 0.5) < 1e-9,
    dashed: isReverse,
    label: stateLabel(v),
  };
}

// consistent domain colours reused across panels
export const DOMAIN_COLORS = {
  REAL_DOMAIN: '#56e39f',
  SINGULAR_BOUNDARY: '#ffd23b',
  ALPHA_DOMAIN: '#e23bd0',
} as const;
