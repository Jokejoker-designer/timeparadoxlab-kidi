/**
 * physics.ts — the three model layers, kept strictly separate.
 *
 *  (1) GEOMETRY LAYER  — split-complex plane  z = x + jα,  j² = 1
 *        norm  N(z) = x² − α²            (critique p.7)
 *        inverse fails on the null set  x² − α² = 0  ⇔  α = ±x
 *        This is a zero-divisor *boundary locus*, NOT 1/0.
 *
 *  (2) 5D DIAGNOSTIC LAYER — speculative kinematics for worldlines
 *        ds² = c²dt² − dx² − dy² − dz² + dα²       (two timelike directions!)
 *        u = dα/dt,  Δ₅D = 1 − (v² − u²)/c²,  γ₅D = 1/√Δ₅D   (critique p.9)
 *        Presented as a property of the ALTERED model, not standard SR.
 *
 *  (3) SIGNAL / PARADOX LAYER — see simulation.ts
 *        prototype null rule  0 = c²dt² − dx² + dα²
 *        ⇒ |dt_signal| = √(max(0, dx² − dα²)) / c
 *
 * NON-GOAL: this is a research visualisation, not a claim of verified physics.
 */

import {
  Real,
  Singular,
  Bottom,
  SingularValue,
  Branch,
} from './singular';

// --- domain classification --------------------------------------------------

export type Domain = 'REAL_DOMAIN' | 'SINGULAR_BOUNDARY' | 'ALPHA_DOMAIN';

/**
 * classifyDomain(Δ, ε) (critique p.13):
 *   Δ >  ε  ⇒ REAL_DOMAIN
 *  |Δ| ≤ ε  ⇒ SINGULAR_BOUNDARY
 *   Δ < −ε  ⇒ ALPHA_DOMAIN
 */
export function classifyDomain(delta: number, eps: number): Domain {
  if (delta > eps) return 'REAL_DOMAIN';
  if (delta < -eps) return 'ALPHA_DOMAIN';
  return 'SINGULAR_BOUNDARY';
}

// =============================================================================
// (1) GEOMETRY LAYER — split-complex numbers
// =============================================================================

export interface SplitComplex {
  x: number;
  alpha: number;
}

/** norm N(z) = x² − α²  =  Δ_split */
export function splitNorm(z: SplitComplex): number {
  return z.x * z.x - z.alpha * z.alpha;
}

/** conjugate z̄ = x − jα */
export function splitConjugate(z: SplitComplex): SplitComplex {
  return { x: z.x, alpha: -z.alpha };
}

/**
 * Split-complex inverse z⁻¹ = z̄ / N(z) — but tagged.
 * On the null set N(z)=0 the inverse genuinely fails: we return a Singular tag
 * (order ½, because it is a zero-divisor square-root-type boundary, and we record
 * which null sheet α=±x was approached) rather than a fake number.
 */
export function splitInverse(z: SplitComplex, eps: number): {
  norm: number;
  domain: Domain;
  value: { re: SingularValue; jcoeff: SingularValue };
} {
  const N = splitNorm(z);
  const domain = classifyDomain(N, eps);
  if (domain === 'SINGULAR_BOUNDARY') {
    const branch: Branch = z.alpha >= 0 ? '+' : '-';
    const tag = Singular(1, 0.5, branch, `split null set x²−α²=0 (α=${branch === '+' ? '+x' : '-x'})`);
    return { norm: N, domain, value: { re: tag, jcoeff: tag } };
  }
  // re part = x/N, j part = −α/N  (z̄ / N)
  return {
    norm: N,
    domain,
    value: { re: Real(z.x / N), jcoeff: Real(-z.alpha / N) },
  };
}

/** Which null sheet a point is nearest to: α=+x ('+') or α=−x ('−'). */
export function nullSheet(z: SplitComplex): Branch {
  const dPlus = Math.abs(z.alpha - z.x);
  const dMinus = Math.abs(z.alpha + z.x);
  return dPlus <= dMinus ? '+' : '-';
}

// =============================================================================
// (2) 5D DIAGNOSTIC LAYER
// =============================================================================

export interface Kinematics {
  /** ordinary 3-speed magnitude v = |dr/dt| */
  v: number;
  /** alpha-velocity u = dα/dt */
  u: number;
  /** light speed */
  c: number;
}

/** Δ₅D = 1 − (v² − u²)/c²  (critique p.12) */
export function delta5D(k: Kinematics): number {
  return 1 - (k.v * k.v - k.u * k.u) / (k.c * k.c);
}

/**
 * γ₅D = 1/√Δ₅D, returned as a typed value (critique p.6: γ ∼ Δ^(−1/2), order ½).
 *   Δ >  ε  ⇒ Real(1/√Δ)
 *  |Δ| ≤ ε  ⇒ Singular(coeff, ½) — Lorentz-type boundary
 *   Δ < −ε  ⇒ Singular(…, ½, branch) — γ would be imaginary (deep alpha domain)
 */
export function gamma5D(k: Kinematics, eps: number): {
  delta: number;
  domain: Domain;
  gamma: SingularValue;
} {
  const d = delta5D(k);
  const domain = classifyDomain(d, eps);
  if (domain === 'REAL_DOMAIN') {
    return { delta: d, domain, gamma: Real(1 / Math.sqrt(d)) };
  }
  if (domain === 'SINGULAR_BOUNDARY') {
    return {
      delta: d,
      domain,
      gamma: Singular(1, 0.5, 'plain', 'v²−u²=c² → Δ₅D=0, γ diverges (order ½)'),
    };
  }
  // Δ < 0: γ = 1/√(negative) is imaginary — superluminal-in-projection.
  const coeff = 1 / Math.sqrt(Math.abs(d));
  return {
    delta: d,
    domain,
    gamma: Singular(coeff, 0.5, '-', 'Δ₅D<0 → imaginary dilation (alpha domain)'),
  };
}

// =============================================================================
// (3) SIGNAL PROPAGATION LAYER
// =============================================================================

export interface SignalSetup {
  /** sender position on x-axis */
  xSender: number;
  /** receiver position on x-axis */
  xReceiver: number;
  /** coordinate time the signal is emitted */
  tSend: number;
  /** alpha-phase the signal travels through */
  alpha: number;
  /** light speed */
  c: number;
  /** causal branch to realise: '+' forward, '-' reverse */
  branch: Branch;
}

export interface SignalResult {
  /** spatial separation dx = xReceiver − xSender */
  dx: number;
  /** alpha displacement dα = alpha */
  dAlpha: number;
  /** the split-style invariant for the signal: dx² − dα² */
  underRoot: number;
  /** classification of underRoot */
  domain: Domain;
  /** |dt_signal| as a typed value */
  dtSignal: SingularValue;
  /** arrival coordinate time as a typed value (tSend ± dt) */
  tArrive: SingularValue;
  /** true when a '-' branch lands strictly before tSend → reverse causal event */
  reverse: boolean;
  /** singular order λ describing escalation (0, ½, 1, …) */
  order: number;
}

/**
 * Projected signal travel time from the null condition of the (x,t,α) subspace:
 *
 *     0 = c²dt² − dx² + dα²   ⇒   |dt_signal| = √(max(0, dx² − dα²)) / c
 *
 * Recovers the ordinary case at α=0, shortens travel as α grows, and hits a
 * singular boundary when dx² = dα². Beyond it (dα² > dx²) the projected interval
 * is imaginary and we keep it as a Singular tag rather than discarding it.
 */
export function propagateSignal(s: SignalSetup, eps: number): SignalResult {
  const dx = s.xReceiver - s.xSender;
  const dAlpha = s.alpha;
  const underRoot = dx * dx - dAlpha * dAlpha;
  const domain = classifyDomain(underRoot, eps);
  const sign = s.branch === '-' ? -1 : 1;

  let dtSignal: SingularValue;
  let order: number;

  if (domain === 'REAL_DOMAIN') {
    const dt = Math.sqrt(underRoot) / s.c;
    dtSignal = Real(dt);
    order = 0;
  } else if (domain === 'SINGULAR_BOUNDARY') {
    // dx² = dα²: light-cone-like boundary in projection — sqrt singularity.
    dtSignal = Singular(0, 0.5, s.branch, 'dx²=dα²: projected null boundary (order ½)');
    order = 0.5;
  } else {
    // dα² > dx²: imaginary projected interval — deep alpha / paradox domain.
    const mag = Math.sqrt(-underRoot) / s.c;
    dtSignal = Singular(mag, 0.5, s.branch, 'dα²>dx²: imaginary projected interval');
    order = 0.5;
  }

  // arrival time tSend ± dt
  let tArrive: SingularValue;
  let reverse = false;
  if (dtSignal.kind === 'Real') {
    const ta = s.tSend + sign * dtSignal.value;
    tArrive = Real(ta);
    if (sign < 0 && ta < s.tSend - eps) {
      reverse = true;
      order = Math.max(order, 1); // promote: reverse-arrival paradox is order 1
    }
  } else if (dtSignal.kind === 'Singular') {
    // boundary / imaginary interval: arrival itself is singular
    const ta = s.tSend + sign * dtSignal.coeff;
    tArrive = Singular(ta, dtSignal.order, dtSignal.branch, 'singular arrival time');
    if (sign < 0) {
      reverse = true;
      order = Math.max(order, 1);
    }
  } else {
    tArrive = dtSignal; // Bottom
  }

  return { dx, dAlpha, underRoot, domain, dtSignal, tArrive, reverse, order };
}

// =============================================================================
// (4) KIDI LIGHT-SPEED PROJECTION — equivalent projected speed observable
// =============================================================================
//
// Built ENTIRELY from the existing signal law; c stays a constant reference, the
// W axis is a display alias of the existing alpha coordinate.
//
//   deltaSignal = dx^2 - dW^2
//   |dt_signal| = sqrt(deltaSignal) / c           (real domain)
//   v_equiv     = |dx| / |dt_signal| = c|dx| / sqrt(deltaSignal)
//   beta_equiv  = v_equiv / c = |dx| / sqrt(deltaSignal) = 1 / sqrt(rho)
//   eta = |dW| / |dx|,   rho = deltaSignal / dx^2 = 1 - eta^2
//
// "v_equiv" is the equivalent ordinary 3D speed that would reproduce the same
// arrival time WITHOUT the W/alpha path. beta_equiv > 1 is a *projection*
// statement inside the speculative model, NOT a claim of verified physical FTL.

export type ProjectionClass =
  | 'LIGHT_SPEED'
  | 'PROJECTED_SUPERLUMINAL'
  | 'KIDI_BOUNDARY'
  | 'W_DOMAIN_NO_REAL_DT'
  | 'UNDEFINED_DX';

export interface ProjectionSpeedResult {
  dx: number;
  /** display alias of the alpha displacement */
  dW: number;
  c: number;
  deltaSignal: number; // dx^2 - dW^2
  eta: number; // |dW| / |dx|
  rho: number; // deltaSignal / dx^2
  betaEquiv: SingularValue;
  vEquiv: SingularValue;
  className: ProjectionClass;
  /** true only in LIGHT_SPEED / PROJECTED_SUPERLUMINAL (dt_signal real & nonzero) */
  isRealProjection: boolean;
  /** for the non-real W domain: √|Δ_signal|/c — NOT a real speed */
  imaginaryMagnitude?: number;
  warning?: string;
}

export interface ProjectionSpeedArgs {
  dx: number;
  dW: number; // display alias of alpha displacement
  c: number;
  eps?: number;
  branch?: Branch;
}

/**
 * Equivalent projected-speed observable (PATCHED, tolerance-based classification).
 *
 * `Kidi` is the user-facing name for typed singular boundary states; the internal
 * algebra remains Singular / Bottom for code stability. Classification uses
 * tolerances (never exact `dW===0` / `|dW|===|dx|`):
 *
 *   dxAbs <= epsSafe          → UNDEFINED_DX          (checked BEFORE dividing)
 *   eta <= etaMin             → LIGHT_SPEED           (β=1)
 *   etaMin < eta < 1-tol      → PROJECTED_SUPERLUMINAL (β>1, real)
 *   |eta-1| <= tol            → KIDI_BOUNDARY         (Singular, order ½)
 *   eta > 1+tol               → W_DOMAIN_NO_REAL_DT   (typed, NOT a real speed, NOT ∞)
 */
export function computeProjectionSpeed(args: ProjectionSpeedArgs): ProjectionSpeedResult {
  const { dx, dW, c } = args;
  const epsSafe = Math.max(args.eps ?? 1e-9, 1e-9);
  const branch = args.branch ?? 'plain';

  const dxAbs = Math.abs(dx);
  const dWAbs = Math.abs(dW);
  const deltaSignal = dx * dx - dW * dW;

  // dx ≈ 0 must be checked BEFORE computing eta (avoid divide-by-zero)
  if (dxAbs <= epsSafe) {
    return {
      dx, dW, c, deltaSignal,
      eta: NaN, rho: NaN,
      betaEquiv: Bottom('dx≈0 makes projected speed undefined'),
      vEquiv: Bottom('dx≈0 makes projected speed undefined'),
      className: 'UNDEFINED_DX',
      isRealProjection: false,
      warning: 'Projected speed is undefined because dx≈0.',
    };
  }

  const eta = dWAbs / dxAbs;
  const rho = deltaSignal / (dxAbs * dxAbs);
  const etaMin = Math.max(1e-6, epsSafe / dxAbs);
  const boundaryTol = Math.max(1e-6, epsSafe / dxAbs);
  const base = { dx, dW, c, deltaSignal, eta, rho };

  if (eta <= etaMin) {
    return { ...base, betaEquiv: Real(1), vEquiv: Real(c), className: 'LIGHT_SPEED', isRealProjection: true };
  }

  if (eta < 1 - boundaryTol) {
    const beta = dxAbs / Math.sqrt(deltaSignal);
    return {
      ...base,
      betaEquiv: Real(beta),
      vEquiv: Real(c * beta),
      className: 'PROJECTED_SUPERLUMINAL',
      isRealProjection: true,
    };
  }

  if (Math.abs(eta - 1) <= boundaryTol) {
    return {
      ...base,
      betaEquiv: Singular(dxAbs, 0.5, branch, 'β_equiv reaches Kidi Boundary: |dW|≈|dx|'),
      vEquiv: Singular(c * dxAbs, 0.5, branch, 'v_equiv reaches Kidi Boundary: |dW|≈|dx|'),
      className: 'KIDI_BOUNDARY',
      isRealProjection: false,
      warning: 'Projected travel time approaches zero at the Kidi Boundary.',
    };
  }

  // eta > 1+tol : no real projected travel time — typed, but NOT a real speed and NOT ∞
  return {
    ...base,
    betaEquiv: Singular(dxAbs, 0.5, branch, 'β_equiv is outside the real projected domain: |dW|>|dx|'),
    vEquiv: Singular(c * dxAbs, 0.5, branch, 'v_equiv is outside the real projected domain: |dW|>|dx|'),
    className: 'W_DOMAIN_NO_REAL_DT',
    isRealProjection: false,
    imaginaryMagnitude: Math.sqrt(Math.abs(deltaSignal)) / c,
    warning: 'No real projected travel time exists for |dW|>|dx|.',
  };
}

// =============================================================================
// (5) LIGHT-SPEED REFERENCE BASELINE — the ordinary α=0 comparison ray
// =============================================================================
//
// NOT a photon rest frame and NOT a new coordinate: a fixed comparison ruler.
// It is always the α=0 special case of the existing signal law:
//   |dt_light| = √(dx²) / c = |dx| / c,   t_light_arrival = t_send + |dx|/c.

export interface LightBaselineResult {
  dx: number;
  c: number;
  tSend: number;
  dtLight: SingularValue;
  tLightArrival: SingularValue;
  /** β of the baseline — always 1 in the valid (real) case */
  beta: number;
  label: 'LIGHT_SPEED_BASELINE' | 'UNDEFINED_BASELINE';
  warning?: string;
}

export function computeLightBaseline(args: {
  xSender: number;
  xReceiver: number;
  tSend: number;
  c: number;
  eps?: number;
}): LightBaselineResult {
  const epsSafe = Math.max(args.eps ?? 1e-9, 1e-9);
  const dx = args.xReceiver - args.xSender;
  const dxAbs = Math.abs(dx);

  if (Math.abs(args.c) <= epsSafe) {
    return {
      dx,
      c: args.c,
      tSend: args.tSend,
      dtLight: Bottom('c≈0 makes light baseline undefined'),
      tLightArrival: Bottom('c≈0 makes light baseline undefined'),
      beta: NaN,
      label: 'UNDEFINED_BASELINE',
      warning: 'Light-speed baseline is undefined because c≈0.',
    };
  }

  const dt = dxAbs / args.c;
  return {
    dx,
    c: args.c,
    tSend: args.tSend,
    dtLight: Real(dt),
    tLightArrival: Real(args.tSend + dt),
    beta: 1,
    label: 'LIGHT_SPEED_BASELINE',
  };
}

// =============================================================================
// (6) REDUCED KIDI CORRIDOR - V-W CORRELATION FIELD (core feasibility proof)
// =============================================================================
//
// Reduced feasibility layer (no 5D / negative time / reverse branch needed):
// can a *local* speed V < c still arrive before the ordinary alpha=0 light
// baseline, because the W/alpha corridor shortens the effective distance?
//
//   D = |dx|,  eta = |W|/D,  beta = V/c
//   D_eff   = sqrt(D^2 - W^2) = D*sqrt(1 - eta^2)
//   t_light = D/c            t_sub-c = D_eff/V = D*sqrt(1-eta^2)/(beta*c)
//   beats light  <=>  t_sub-c < t_light  <=>  beta^2 + eta^2 > 1   (0<beta<1, 0<eta<1)
//
// NOT a claim of verified physical FTL: V stays below c; the earlier arrival is a
// geometric corridor shortening inside the speculative model.

export type VWCorrelationClass =
  | 'SUBC_TOO_SLOW'
  | 'EQUAL_TO_LIGHT_BASELINE'
  | 'SUBC_BEATS_LIGHT'
  | 'KIDI_BOUNDARY'
  | 'NO_REAL_CORRIDOR'
  | 'LIGHT_SPEED_LIMIT'
  | 'INVALID_INPUT';

export interface VWCorrelationResult {
  dx: number;
  D: number;
  W: number;
  WAbs: number;
  V: number;
  c: number;
  eta: number;
  beta: number;
  fieldScore: number;
  boundaryValue: number;
  margin: number;
  betaThreshold: number;
  etaThreshold: number;
  effectiveDistance: SingularValue;
  dtLight: SingularValue;
  dtSubC: SingularValue;
  tSend: number;
  tLightArrival: SingularValue;
  tSubCArrival: SingularValue;
  gainVsLight: SingularValue;
  className: VWCorrelationClass;
  beatsLight: boolean;
  isSubC: boolean;
  isRealCorridor: boolean;
  message: string;
  warning?: string;
}

export function computeVWCorrelationField(args: {
  dx: number;
  W: number;
  V: number;
  c: number;
  tSend?: number;
  eps?: number;
  branch?: Branch;
}): VWCorrelationResult {
  const epsSafe = Math.max(args.eps ?? 1e-9, 1e-9);
  const branch = args.branch ?? 'plain';
  const tSend = args.tSend ?? 0;
  const D = Math.abs(args.dx);
  const WAbs = Math.abs(args.W);
  const { V, c } = args;

  if (D <= epsSafe || c <= epsSafe || V <= epsSafe) {
    const b = Bottom('invalid D, c, or V');
    return {
      dx: args.dx, D, W: args.W, WAbs, V, c,
      eta: NaN, beta: NaN, fieldScore: NaN, boundaryValue: 1, margin: NaN,
      betaThreshold: NaN, etaThreshold: NaN,
      effectiveDistance: b, dtLight: b, dtSubC: b, tSend,
      tLightArrival: b, tSubCArrival: b, gainVsLight: b,
      className: 'INVALID_INPUT', beatsLight: false, isSubC: false, isRealCorridor: false,
      message: 'Invalid input: D, c, and V must be positive.',
      warning: 'Invalid input for V-W correlation field.',
    };
  }

  const eta = WAbs / D;
  const beta = V / c;
  const fieldScore = beta * beta + eta * eta;
  const margin = fieldScore - 1;
  const boundaryTol = Math.max(1e-6, epsSafe / D);
  const marginTol = Math.max(1e-6, epsSafe / D);
  const betaThreshold = eta < 1 ? Math.sqrt(Math.max(0, 1 - eta * eta)) : NaN;
  const etaThreshold = beta < 1 ? Math.sqrt(Math.max(0, 1 - beta * beta)) : NaN;
  const dtLightValue = D / c;
  const tLightArrivalValue = tSend + dtLightValue;
  const fieldBase = {
    dx: args.dx, D, W: args.W, WAbs, V, c, eta, beta, fieldScore, boundaryValue: 1, margin,
    betaThreshold, etaThreshold, tSend,
  };

  if (eta > 1 + boundaryTol) {
    const mag = Math.sqrt(Math.abs(D * D - WAbs * WAbs));
    return {
      ...fieldBase,
      effectiveDistance: Singular(mag, 0.5, branch, 'No real Kidi corridor for |W|>|dx|'),
      dtLight: Real(dtLightValue),
      dtSubC: Singular(mag / V, 0.5, branch, 'No real sub-c corridor time for |W|>|dx|'),
      tLightArrival: Real(tLightArrivalValue),
      tSubCArrival: Singular(tSend, 0.5, branch, 'No real sub-c corridor arrival'),
      gainVsLight: Singular(dtLightValue, 0.5, branch, 'No real gain outside real corridor'),
      className: 'NO_REAL_CORRIDOR', beatsLight: false, isSubC: beta < 1, isRealCorridor: false,
      message: 'No real corridor: |W| exceeds D.',
      warning: 'Do not interpret this as faster-than-light. The projected corridor is non-real.',
    };
  }

  if (Math.abs(eta - 1) <= boundaryTol) {
    return {
      ...fieldBase, betaThreshold: 0,
      effectiveDistance: Singular(0, 0.5, branch, 'Kidi Boundary: effective corridor distance -> 0'),
      dtLight: Real(dtLightValue),
      dtSubC: Singular(0, 0.5, branch, 'Kidi Boundary: sub-c corridor time -> 0'),
      tLightArrival: Real(tLightArrivalValue),
      tSubCArrival: Singular(tSend, 0.5, branch, 'Kidi Boundary arrival is typed, not zero-time travel'),
      gainVsLight: Singular(dtLightValue, 0.5, branch, 'Gain reaches Kidi Boundary'),
      className: 'KIDI_BOUNDARY', beatsLight: false, isSubC: beta < 1, isRealCorridor: false,
      message: 'Kidi Boundary: effective distance tends to zero.',
      warning: 'Do not display as ordinary finite-speed travel.',
    };
  }

  const effectiveDistanceValue = Math.sqrt(D * D - WAbs * WAbs);
  const dtSubCValue = effectiveDistanceValue / V;
  const tSubCArrivalValue = tSend + dtSubCValue;
  const gainValue = dtLightValue - dtSubCValue;
  const realBase = {
    ...fieldBase,
    effectiveDistance: Real(effectiveDistanceValue),
    dtLight: Real(dtLightValue),
    dtSubC: Real(dtSubCValue),
    tLightArrival: Real(tLightArrivalValue),
    tSubCArrival: Real(tSubCArrivalValue),
    gainVsLight: Real(gainValue),
    isRealCorridor: true as const,
  };

  if (beta >= 1 - marginTol) {
    return {
      ...realBase,
      className: 'LIGHT_SPEED_LIMIT', beatsLight: gainValue > epsSafe, isSubC: false,
      message: 'V is at or above c; this module is for sub-c feasibility.',
      warning: 'Use the projection-speed module for non-sub-c cases.',
    };
  }

  if (Math.abs(margin) <= marginTol) {
    return { ...realBase, className: 'EQUAL_TO_LIGHT_BASELINE', beatsLight: false, isSubC: true,
      message: 'Equal to light baseline: beta^2 + eta^2 ~ 1.' };
  }
  if (margin > marginTol) {
    return { ...realBase, className: 'SUBC_BEATS_LIGHT', beatsLight: true, isSubC: true,
      message: 'Sub-c feasible: V<c but W is large enough to beat the light baseline.' };
  }
  return { ...realBase, className: 'SUBC_TOO_SLOW', beatsLight: false, isSubC: true,
    message: 'Too slow: increase W or V to beat the light baseline.' };
}

/** Required |W| window so a sub-c speed v beats light:  D·√(1−β²) < |W| < D. */
export function requiredWForSubCSpeed(args: { dx: number; c: number; v: number; eps?: number }): {
  D: number;
  beta: number;
  wMinExclusive: SingularValue;
  wMaxExclusive: SingularValue;
  conditionText: string;
} {
  const epsSafe = Math.max(args.eps ?? 1e-9, 1e-9);
  const D = Math.abs(args.dx);
  const beta = args.c > epsSafe ? args.v / args.c : NaN;
  if (D <= epsSafe || !(args.c > epsSafe) || !(args.v > epsSafe)) {
    const b = Bottom('undefined: dx≈0 or invalid c/v');
    return { D, beta, wMinExclusive: b, wMaxExclusive: b, conditionText: 'undefined' };
  }
  const wMin = D * Math.sqrt(Math.max(0, 1 - beta * beta));
  return {
    D,
    beta,
    wMinExclusive: Real(wMin),
    wMaxExclusive: Real(D),
    conditionText: `${wMin.toFixed(3)} < |W| < ${D.toFixed(3)}`,
  };
}

/** Required local speed window so a given |W| beats light:  c·√(1−η²) < v < c. */
export function requiredVForW(args: { dx: number; W: number; c: number; eps?: number }): {
  D: number;
  eta: number;
  vMinExclusive: SingularValue;
  vMaxExclusive: SingularValue;
  conditionText: string;
} {
  const epsSafe = Math.max(args.eps ?? 1e-9, 1e-9);
  const D = Math.abs(args.dx);
  if (D <= epsSafe || !(args.c > epsSafe)) {
    const b = Bottom('undefined: dx≈0 or invalid c');
    return { D, eta: NaN, vMinExclusive: b, vMaxExclusive: b, conditionText: 'undefined' };
  }
  const eta = Math.abs(args.W) / D;
  if (eta >= 1) {
    return {
      D, eta,
      vMinExclusive: Bottom('|W| ≥ |dx|: no real sub-c corridor'),
      vMaxExclusive: Real(args.c),
      conditionText: 'no real corridor (|W| ≥ |dx|)',
    };
  }
  const vMin = args.c * Math.sqrt(Math.max(0, 1 - eta * eta));
  return {
    D,
    eta,
    vMinExclusive: Real(vMin),
    vMaxExclusive: Real(args.c),
    conditionText: `${vMin.toFixed(3)} < v < ${args.c.toFixed(3)}`,
  };
}

