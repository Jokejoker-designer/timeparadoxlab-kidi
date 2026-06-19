/**
 * singular.ts — Typed singular-value algebra.
 *
 * Implements the value type recommended by the uploaded critique
 * ("Rigorous Critique and Defense of the Singular-Coefficient Alpha-Axis Model",
 * pp. 12–14): a tagged state machine, NOT a fake number system.
 *
 *     Real(r)
 *     Singular(c, λ, b, reason)
 *     Bottom(reason)
 *
 * The crucial discipline (critique p.1, p.5): there is no honest ring element K
 * with 0·K = 1. So a division-by-zero / boundary event is recorded as a *labelled
 * singular object* produced by an external operator D0(a)=a#, graded by singular
 * order λ. We never coerce a singularity into ∞ or pretend 1/0 is a number.
 *
 * Arithmetic mirrors the "computational form of the graded singular algebra"
 * (critique p.13):   (a σ^λ)(b σ^μ) = ab σ^(λ+μ).
 */

/**
 * Branch label b. '+'/'−' identify which null sheet / causal branch was hit
 * (critique p.12: "attach a branch b∈{+,−}"). The extra labels are richer
 * visualization/escalation tags used by the 3D layer and event export:
 *   loop     — a closed causal loop was attempted
 *   feedback — a feedback/reply event
 *   mixed    — metadata from incompatible branches was combined
 */
export type Branch = 'plain' | '+' | '-' | 'loop' | 'feedback' | 'mixed';

/** A value flowing through the simulator. */
export type SingularValue =
  | Real
  | Singular
  | Bottom;

export interface Real {
  readonly kind: 'Real';
  readonly value: number;
}

export interface Singular {
  readonly kind: 'Singular';
  /** coefficient c — the preserved numerator information */
  readonly coeff: number;
  /** singular order λ (0 = regular, 1/2 = sqrt/Lorentz singularity, 1 = simple pole, …) */
  readonly order: number;
  /** branch label */
  readonly branch: Branch;
  /** human-readable reason the singular tag was created */
  readonly reason: string;
}

export interface Bottom {
  readonly kind: 'Bottom';
  /** why the computation became structurally indeterminate */
  readonly reason: string;
}

// --- constructors -----------------------------------------------------------

export const Real = (value: number): Real => ({ kind: 'Real', value });

export const Singular = (
  coeff: number,
  order: number,
  branch: Branch = 'plain',
  reason = '',
): Singular => ({ kind: 'Singular', coeff, order, branch, reason });

export const Bottom = (reason: string): Bottom => ({ kind: 'Bottom', reason });

// --- predicates -------------------------------------------------------------

export const isReal = (v: SingularValue): v is Real => v.kind === 'Real';
export const isSingular = (v: SingularValue): v is Singular => v.kind === 'Singular';
export const isBottom = (v: SingularValue): v is Bottom => v.kind === 'Bottom';

// --- branch merge -----------------------------------------------------------

/**
 * merge(b, d): combining metadata. plain is the identity; '+' and '-' are
 * incompatible and produce Bottom (critique p.13: "mixing incompatible branch
 * metadata … becomes Bottom") — signalled by returning null. Other mismatched
 * non-plain labels combine into the 'mixed' tag rather than collapsing.
 */
export function mergeBranch(b: Branch, d: Branch): Branch | null {
  if (b === 'plain') return d;
  if (d === 'plain') return b;
  if (b === d) return b;
  // the two causal null sheets are genuinely incompatible
  if ((b === '+' && d === '-') || (b === '-' && d === '+')) return null;
  return 'mixed';
}

// --- arithmetic (graded singular algebra) -----------------------------------

/** Real(a) + Real(b) = Real(a+b); singular orders combine by domination near the
 *  boundary (higher λ wins); incompatible branches ⇒ Bottom. */
export function add(x: SingularValue, y: SingularValue): SingularValue {
  if (isBottom(x)) return x;
  if (isBottom(y)) return y;

  if (isReal(x) && isReal(y)) return Real(x.value + y.value);

  // Real + Singular: the singular σ^λ term dominates the regular σ^0 term
  // as we approach the boundary, so the singular tag survives.
  if (isReal(x) && isSingular(y)) return y;
  if (isSingular(x) && isReal(y)) return x;

  // Singular + Singular
  if (isSingular(x) && isSingular(y)) {
    const branch = mergeBranch(x.branch, y.branch);
    if (branch === null) {
      return Bottom(`incompatible branches ${x.branch} + ${y.branch}`);
    }
    if (x.order === y.order) {
      return Singular(x.coeff + y.coeff, x.order, branch, x.reason || y.reason);
    }
    // dominant (more singular) term survives
    const dom = x.order > y.order ? x : y;
    return Singular(dom.coeff, dom.order, branch, dom.reason);
  }
  return Bottom('unhandled add');
}

/** Multiplication: (a σ^λ)(b σ^μ) = ab σ^(λ+μ); branches merge. */
export function mul(x: SingularValue, y: SingularValue): SingularValue {
  if (isBottom(x)) return x;
  if (isBottom(y)) return y;

  if (isReal(x) && isReal(y)) return Real(x.value * y.value);

  if (isReal(x) && isSingular(y)) {
    return Singular(x.value * y.coeff, y.order, y.branch, y.reason);
  }
  if (isSingular(x) && isReal(y)) {
    return Singular(x.coeff * y.value, x.order, x.branch, x.reason);
  }
  if (isSingular(x) && isSingular(y)) {
    const branch = mergeBranch(x.branch, y.branch);
    if (branch === null) {
      return Bottom(`incompatible branches ${x.branch} · ${y.branch}`);
    }
    return Singular(x.coeff * y.coeff, x.order + y.order, branch, x.reason || y.reason);
  }
  return Bottom('unhandled mul');
}

/**
 * Division with singular bookkeeping — the heart of the model.
 *
 *   a / 0  with a ≠ 0  ⇒  Singular(a, 1, plain, "a/0")          (simple pole, order 1)
 *   0 / 0              ⇒  Bottom("0/0 indeterminate")
 *   a / b  with b ≠ 0  ⇒  Real(a/b)
 *
 * `eps` is the boundary tolerance for "denominator ≈ 0".
 * This realises D0(a)=a# WITHOUT asserting 0·a# = a (critique pp.2,5).
 */
export function divide(a: SingularValue, b: SingularValue, eps = 1e-12): SingularValue {
  if (isBottom(a)) return a;
  if (isBottom(b)) return b;
  if (!isReal(a) || !isReal(b)) {
    // keep the prototype's arithmetic in the Real layer; singular ÷ singular is
    // out of scope and flagged rather than guessed.
    return Bottom('non-Real division operand');
  }
  const denom = b.value;
  if (Math.abs(denom) <= eps) {
    if (Math.abs(a.value) <= eps) return Bottom('0/0 indeterminate');
    return Singular(a.value, 1, 'plain', `${a.value}/0 — division by zero`);
  }
  return Real(a.value / denom);
}

// --- rendering --------------------------------------------------------------

/** Compact human-readable form, e.g. "Real(2.000)", "Singular(5·σ^0.5, +)", "⊥". */
export function format(v: SingularValue): string {
  switch (v.kind) {
    case 'Real':
      return `Real(${fmtNum(v.value)})`;
    case 'Singular': {
      const ord = v.order === 0.5 ? '½' : String(v.order);
      const br = v.branch === 'plain' ? '' : `, ${v.branch}`;
      return `Singular(${fmtNum(v.coeff)}·σ^${ord}${br})`;
    }
    case 'Bottom':
      return `⊥ (${v.reason})`;
  }
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3);
}
