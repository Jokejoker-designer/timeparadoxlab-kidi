/**
 * selfTest.ts — executable test cases + acceptance criteria from the WO.
 *
 * Pure functions only, so they run identically in Node, Vitest, or in-browser.
 * The UI exposes runSelfTests() behind a "Run self-tests" button.
 */

import {
  Real,
  Singular,
  Bottom,
  add,
  mul,
  divide,
  mergeBranch,
  isBottom,
  isSingular,
  format,
} from './singular';
import {
  splitNorm,
  splitInverse,
  delta5D,
  gamma5D,
  propagateSignal,
  computeProjectionSpeed,
  computeVWCorrelationField,
  requiredWForSubCSpeed,
  requiredVForW,
} from './physics';
import {
  DEFAULT_SCENARIO,
  DEMO_PHASES,
  evaluatePhase,
  buildEvents,
} from './simulation';
import { buildSceneGeometry, hasNonFinite, isFiniteVec } from './geometry3d';
import { ALL_PRESETS, presetCamera, isValidCamera, cameraPosition } from './camera';
import { projectPoint } from './projection';
import { buildExport, validateExport } from './export';
import { validateSimEvent } from './schemas';

const phaseById = (id: string) => {
  const p = DEMO_PHASES.find((q) => q.id === id);
  if (!p) throw new Error(`missing demo phase ${id}`);
  return p;
};

export interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const EPS = 1e-9;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

export function runSelfTests(): TestResult[] {
  const r: TestResult[] = [];
  const check = (name: string, pass: boolean, detail = '') =>
    r.push({ name, pass, detail });

  // ---- WO demo arrivals (acceptance criteria) ----------------------------
  const d0 = evaluatePhase(DEFAULT_SCENARIO, phaseById('ordinary'));
  const d1 = evaluatePhase(DEFAULT_SCENARIO, phaseById('shortcut'));
  const d2 = evaluatePhase(DEFAULT_SCENARIO, phaseById('paradox'));
  const dBoundary = evaluatePhase(DEFAULT_SCENARIO, phaseById('boundary'));
  const dFeedback = evaluatePhase(DEFAULT_SCENARIO, phaseById('feedback'));

  check(
    'Ordinary phase α=0 arrives at t=7',
    d0.arrival.kind === 'Real' && near(d0.arrival.value, 7),
    format(d0.arrival),
  );
  check(
    'Shortcut phase α=4 arrives at t=5',
    d1.arrival.kind === 'Real' && near(d1.arrival.value, 5),
    format(d1.arrival),
  );
  check(
    'Paradox phase α=√24 arrives at t=1 (reverse branch)',
    d2.arrival.kind === 'Real' && near(d2.arrival.value, 1) && d2.reverse,
    `${format(d2.arrival)}, reverse=${d2.reverse}`,
  );
  check(
    'Ordinary phase is NOT a reverse/paradox event',
    !d0.reverse && d0.contradiction === null,
    `reverse=${d0.reverse}`,
  );
  check(
    'Boundary phase α=5 (dx²=dα²) is a SINGULAR_BOUNDARY, order ½',
    dBoundary.signal.domain === 'SINGULAR_BOUNDARY' && dBoundary.signal.order === 0.5,
    `domain=${dBoundary.signal.domain}, order=${dBoundary.signal.order}, arrival=${format(dBoundary.arrival)}`,
  );

  // ---- split-complex geometry (critique p.13) ----------------------------
  check(
    'N(2+j) = 3 and z is invertible (REAL_DOMAIN)',
    near(splitNorm({ x: 2, alpha: 1 }), 3) &&
      splitInverse({ x: 2, alpha: 1 }, EPS).domain === 'REAL_DOMAIN',
    `N=${splitNorm({ x: 2, alpha: 1 })}`,
  );
  {
    const inv = splitInverse({ x: 1, alpha: 1 }, EPS);
    check(
      'N(1+j) = 0 → not invertible, SINGULAR_BOUNDARY tag',
      near(splitNorm({ x: 1, alpha: 1 }), 0) &&
        inv.domain === 'SINGULAR_BOUNDARY' &&
        isSingular(inv.value.re),
      format(inv.value.re),
    );
  }

  // ---- 5D diagnostic (critique p.14) -------------------------------------
  {
    const k = { v: 1.2, u: 0.8, c: 1 };
    const g = gamma5D(k, EPS);
    check(
      'Δ₅D(v=1.2c,u=0.8c)=0.20, γ₅D≈2.236 (Real)',
      near(delta5D(k), 0.2) && g.gamma.kind === 'Real' && near(g.gamma.value, 2.236, 1e-3),
      `Δ=${delta5D(k).toFixed(3)}, γ=${format(g.gamma)}`,
    );
  }
  {
    // v=u: Δ₅D = 1, ordinary
    const g = gamma5D({ v: 0.6, u: 0.6, c: 1 }, EPS);
    check('v=u ⇒ Δ₅D=1, γ₅D=1', g.gamma.kind === 'Real' && near(g.gamma.value, 1), format(g.gamma));
  }

  // ---- singular arithmetic (graded algebra, critique p.13) ---------------
  check(
    'Real(2)+Real(3)=Real(5)',
    add(Real(2), Real(3)).kind === 'Real' && (add(Real(2), Real(3)) as any).value === 5,
    format(add(Real(2), Real(3))),
  );
  check(
    'Singular(a,λ,b)·Singular(c,μ,d): coeff×, order+, branch merge',
    (() => {
      const m = mul(Singular(2, 0.5, 'plain'), Singular(3, 1, '+'));
      return isSingular(m) && m.coeff === 6 && m.order === 1.5 && m.branch === '+';
    })(),
    format(mul(Singular(2, 0.5, 'plain'), Singular(3, 1, '+'))),
  );
  check(
    'Singular(_,_,+) + Singular(_,_,−) ⇒ Bottom (incompatible branches)',
    isBottom(add(Singular(1, 1, '+'), Singular(1, 1, '-'))),
    format(add(Singular(1, 1, '+'), Singular(1, 1, '-'))),
  );
  check(
    'a/0 ⇒ Singular(a,1) — division by zero is tagged, not ∞',
    (() => {
      const q = divide(Real(7), Real(0), EPS);
      return isSingular(q) && q.coeff === 7 && q.order === 1;
    })(),
    format(divide(Real(7), Real(0), EPS)),
  );
  check(
    '0/0 ⇒ Bottom (indeterminate)',
    isBottom(divide(Real(0), Real(0), EPS)),
    format(divide(Real(0), Real(0), EPS)),
  );
  check(
    'mergeBranch(+,−) is incompatible (null)',
    mergeBranch('+', '-') === null && mergeBranch('plain', '+') === '+',
    '',
  );

  // ---- escalation ladder: order 0 → ½ → 1 → ⊥ -----------------------------
  check(
    'Paradox phase reaches reverse-arrival escalation (order ≥ 1)',
    d2.order >= 1 && d2.reverse,
    `order=${d2.order}`,
  );
  check(
    'Feedback phase (closeLoop) escalates to Bottom contradiction (finite order, no synthetic ∞)',
    isBottom(dFeedback.contradiction as any) && Number.isFinite(dFeedback.order),
    dFeedback.contradiction ? `${format(dFeedback.contradiction)}, order=${dFeedback.order}` : 'no contradiction',
  );
  check(
    'Plain paradox (no closeLoop) is preserved as data, NOT collapsed to ⊥',
    d2.contradiction === null && d2.arrival.kind === 'Real',
    `contradiction=${d2.contradiction}`,
  );

  // ---- 3D geometry builders (no NaN vertices) -----------------------------
  {
    const G = buildSceneGeometry(d2);
    const allPositions = [
      ...G.loci.flatMap((m) => m.positions),
      ...G.nullSurface.flatMap((m) => m.positions),
    ];
    const linesFinite =
      G.worldlines.every((w) => w.points.every(isFiniteVec)) &&
      G.signal.points.every(isFiniteVec) &&
      G.markers.every((m) => isFiniteVec(m.position));
    check(
      '3D geometry: no NaN vertices in loci/null-surface/worldlines/signal',
      !hasNonFinite(allPositions) && linesFinite,
      `${allPositions.length} mesh coords sampled`,
    );
    check(
      '3D geometry: 2 singular planes + 2 null sheets + 2 worldlines built',
      G.loci.length === 2 && G.nullSurface.length === 2 && G.worldlines.length === 2,
      `loci=${G.loci.length}, null=${G.nullSurface.length}, world=${G.worldlines.length}`,
    );
  }

  // ---- camera math + presets ----------------------------------------------
  check(
    'All camera presets produce valid cameras with finite positions',
    ALL_PRESETS.every((p) => {
      const cam = presetCamera(p, [2.5, 3, 0], 20);
      return isValidCamera(cam) && cameraPosition(cam).every(Number.isFinite);
    }),
    ALL_PRESETS.join(','),
  );
  {
    const cam = presetCamera('front', [2.5, 3, 0], 20);
    const eye = cameraPosition(cam);
    const pr = projectPoint([2.5, 3, 0], eye, cam.target, [0, 1, 0], Math.PI / 4, 1.5);
    check(
      'Camera projection: a camera target lands at screen centre, in front',
      Math.abs(pr.x) < 1e-6 && Math.abs(pr.y) < 1e-6 && pr.depth > 0,
      `x=${pr.x.toFixed(4)}, y=${pr.y.toFixed(4)}, depth=${pr.depth.toFixed(2)}`,
    );
  }

  // ---- event export validates against the JSON schema ----------------------
  {
    const evs = [
      ...buildEvents(d0, 0),
      ...buildEvents(d1, 100),
      ...buildEvents(d2, 200),
      ...buildEvents(dBoundary, 300),
      ...buildEvents(dFeedback, 400),
    ];
    const perEventErrors = evs.flatMap((e) => validateSimEvent(e));
    const exp = buildExport(evs);
    const v = validateExport(exp);
    check(
      'Exported event log validates against sim-event.schema.json',
      perEventErrors.length === 0 && v.valid && exp.count === evs.length,
      perEventErrors.length ? perEventErrors.slice(0, 3).join('; ') : `${evs.length} events valid`,
    );
    const reverse = evs.find((e) => e.type === 'REVERSE_ARRIVAL');
    check(
      'Reverse-arrival event carries Singular(order 1, branch −) typedState + finite arrival',
      !!reverse &&
        reverse.typedState.kind === 'Singular' &&
        reverse.typedState.order === 1 &&
        reverse.typedState.branch === '-' &&
        reverse.arrival?.kind === 'Real',
      reverse ? format(reverse.typedState) : 'missing',
    );
  }

  // ---- Kidi Light-Speed Projection (patched, tolerance-based) --------------
  {
    const light = computeProjectionSpeed({ dx: 5, dW: 0, c: 1, eps: 1e-9 });
    check(
      'Kidi: dx=5, W=0 ⇒ LIGHT_SPEED, β_equiv=Real(1), v_equiv=Real(1)',
      light.className === 'LIGHT_SPEED' &&
        light.betaEquiv.kind === 'Real' && near(light.betaEquiv.value, 1) &&
        light.vEquiv.kind === 'Real' && near(light.vEquiv.value, 1) &&
        light.isRealProjection,
      `${light.className}, ${format(light.betaEquiv)}`,
    );

    const sup = computeProjectionSpeed({ dx: 5, dW: 4, c: 1, eps: 1e-9 });
    check(
      'Kidi: dx=5, W=4 ⇒ PROJECTED_SUPERLUMINAL, β_equiv=Real(5/3)',
      sup.className === 'PROJECTED_SUPERLUMINAL' &&
        sup.betaEquiv.kind === 'Real' && near(sup.betaEquiv.value, 5 / 3) &&
        sup.vEquiv.kind === 'Real' && near(sup.vEquiv.value, 5 / 3) &&
        sup.isRealProjection,
      `${sup.className}, ${format(sup.betaEquiv)}`,
    );

    const bnd = computeProjectionSpeed({ dx: 5, dW: 5, c: 1, eps: 1e-9 });
    check(
      'Kidi: dx=5, W=5 ⇒ KIDI_BOUNDARY, β/v Singular order ½, not real',
      bnd.className === 'KIDI_BOUNDARY' &&
        bnd.betaEquiv.kind === 'Singular' && bnd.betaEquiv.order === 0.5 &&
        bnd.vEquiv.kind === 'Singular' && bnd.vEquiv.order === 0.5 &&
        !bnd.isRealProjection,
      `${bnd.className}, ${format(bnd.betaEquiv)}`,
    );

    const wdom = computeProjectionSpeed({ dx: 5, dW: 6, c: 1, eps: 1e-9 });
    check(
      'Kidi: dx=5, W=6 ⇒ W_DOMAIN_NO_REAL_DT, typed (not ∞/Bottom), isReal=false',
      wdom.className === 'W_DOMAIN_NO_REAL_DT' &&
        wdom.betaEquiv.kind === 'Singular' &&
        Number.isFinite((wdom.betaEquiv as any).coeff) &&
        wdom.isRealProjection === false &&
        !!wdom.warning,
      `${wdom.className}, ${format(wdom.betaEquiv)}`,
    );

    const undef = computeProjectionSpeed({ dx: 0, dW: 1, c: 1, eps: 1e-9 });
    check(
      'Kidi: dx=0 ⇒ UNDEFINED_DX, β/v Bottom, eta=NaN',
      undef.className === 'UNDEFINED_DX' &&
        undef.betaEquiv.kind === 'Bottom' &&
        undef.vEquiv.kind === 'Bottom' &&
        !Number.isFinite(undef.eta),
      undef.className,
    );

    // tolerance: near-zero W is still LIGHT_SPEED (no exact equality)
    const nearZero = computeProjectionSpeed({ dx: 5, dW: 1e-12, c: 1, eps: 1e-9 });
    check(
      'Kidi tolerance: W≈0 (1e-12) stays LIGHT_SPEED, β≈1',
      nearZero.className === 'LIGHT_SPEED' && nearZero.betaEquiv.kind === 'Real' && near(nearZero.betaEquiv.value, 1, 1e-9),
      nearZero.className,
    );

    // tolerance: near-boundary collapses to KIDI_BOUNDARY
    const nearBnd = computeProjectionSpeed({ dx: 5, dW: 5 - 1e-10, c: 1, eps: 1e-9 });
    check(
      'Kidi tolerance: W=5−1e-10 ⇒ KIDI_BOUNDARY (Singular)',
      nearBnd.className === 'KIDI_BOUNDARY' && nearBnd.betaEquiv.kind === 'Singular',
      nearBnd.className,
    );

    // null-geometry identity v² − u² = c²  — REAL DOMAIN ONLY
    {
      const pj = sup; // PROJECTED_SUPERLUMINAL
      if (pj.className === 'LIGHT_SPEED' || pj.className === 'PROJECTED_SUPERLUMINAL') {
        const dt = Math.sqrt(pj.deltaSignal) / pj.c;
        const v = Math.abs(pj.dx) / dt;
        const u = Math.abs(pj.dW) / dt;
        check(
          'Kidi null-geometry identity (real domain): v_equiv² − u² = c²',
          near(v * v - u * u, pj.c * pj.c, 1e-9),
          `${(v * v - u * u).toFixed(6)} vs ${pj.c * pj.c}`,
        );
      }
    }

    // integration: Diagnostics carries the same canonical projection
    check(
      'Kidi integration: phase projections classify ordinary→LIGHT_SPEED, shortcut→SUPERLUMINAL, boundary→KIDI_BOUNDARY',
      d0.projection.className === 'LIGHT_SPEED' &&
        d1.projection.className === 'PROJECTED_SUPERLUMINAL' &&
        dBoundary.projection.className === 'KIDI_BOUNDARY',
      `${d0.projection.className}/${d1.projection.className}/${dBoundary.projection.className}`,
    );
  }

  // ---- Light-Speed Reference Baseline (α=0 comparison ruler) ---------------
  check(
    'Light baseline: default dx=5,c=1,tSend=2 arrives at t=7',
    d0.lightBaseline.tLightArrival.kind === 'Real' && near(d0.lightBaseline.tLightArrival.value, 7),
    format(d0.lightBaseline.tLightArrival),
  );
  check(
    'Ordinary α=0 current signal matches light baseline',
    d0.arrival.kind === 'Real' &&
      d0.lightBaseline.tLightArrival.kind === 'Real' &&
      near(d0.arrival.value, d0.lightBaseline.tLightArrival.value),
    `arrival=${format(d0.arrival)}, baseline=${format(d0.lightBaseline.tLightArrival)}`,
  );
  check(
    'Shortcut α=4 arrives before light baseline by 2 time units',
    d1.arrival.kind === 'Real' &&
      d1.lightBaseline.tLightArrival.kind === 'Real' &&
      near(d1.lightBaseline.tLightArrival.value - d1.arrival.value, 2),
    `arrival=${format(d1.arrival)}, baseline=${format(d1.lightBaseline.tLightArrival)}`,
  );
  check(
    'Boundary α=5 keeps finite light baseline (t=7) while current path reaches Kidi Boundary',
    dBoundary.lightBaseline.tLightArrival.kind === 'Real' &&
      near(dBoundary.lightBaseline.tLightArrival.value, 7) &&
      dBoundary.signal.domain === 'SINGULAR_BOUNDARY',
    `baseline=${format(dBoundary.lightBaseline.tLightArrival)}, domain=${dBoundary.signal.domain}`,
  );
  check(
    'Paradox reverse arrival (t=1) occurs before send while light baseline stays forward causal (t=7)',
    d2.arrival.kind === 'Real' && near(d2.arrival.value, 1) &&
      d2.lightBaseline.tLightArrival.kind === 'Real' && near(d2.lightBaseline.tLightArrival.value, 7),
    `arrival=${format(d2.arrival)}, baseline=${format(d2.lightBaseline.tLightArrival)}`,
  );

  // ---- Sub-c Kidi Corridor feasibility solver ------------------------------
  {
    const realV = (v: any) => (v.kind === 'Real' ? v.value : NaN);

    const beats = computeVWCorrelationField({ dx: 5, W: 4, V: 0.8, c: 1, tSend: 2 });
    check(
      'Sub-c: v=0.8c,W=4 beats light (t_sub-c=3.75, gain=1.25)',
      beats.className === 'SUBC_BEATS_LIGHT' && beats.beatsLight &&
        near(realV(beats.dtSubC), 3.75) && near(realV(beats.gainVsLight), 1.25),
      `${beats.className}, dtSubC=${format(beats.dtSubC)}, gain=${format(beats.gainVsLight)}`,
    );

    const slow = computeVWCorrelationField({ dx: 5, W: 2, V: 0.8, c: 1, tSend: 2 });
    check(
      'Sub-c: v=0.8c,W=2 is SUBC_TOO_SLOW',
      slow.className === 'SUBC_TOO_SLOW' && !slow.beatsLight,
      slow.className,
    );

    const reqW = requiredWForSubCSpeed({ dx: 5, c: 1, v: 0.8 });
    check(
      'Sub-c: required W window for v=0.8c is 3 < |W| < 5',
      reqW.wMinExclusive.kind === 'Real' && near(reqW.wMinExclusive.value, 3) &&
        reqW.wMaxExclusive.kind === 'Real' && near(reqW.wMaxExclusive.value, 5),
      reqW.conditionText,
    );

    const reqV = requiredVForW({ dx: 5, W: 4, c: 1 });
    check(
      'Sub-c: required V window for W=4 is 0.6 < v < 1',
      reqV.vMinExclusive.kind === 'Real' && near(reqV.vMinExclusive.value, 0.6) &&
        reqV.vMaxExclusive.kind === 'Real' && near(reqV.vMaxExclusive.value, 1),
      reqV.conditionText,
    );

    const bnd = computeVWCorrelationField({ dx: 5, W: 5, V: 0.8, c: 1, tSend: 2 });
    check('Sub-c: W=5 ⇒ KIDI_BOUNDARY (typed, not zero-time travel)',
      bnd.className === 'KIDI_BOUNDARY' && bnd.dtSubC.kind === 'Singular', bnd.className);

    const noReal = computeVWCorrelationField({ dx: 5, W: 6, V: 0.8, c: 1, tSend: 2 });
    check('Sub-c: W=6 ⇒ NO_REAL_CORRIDOR (isRealCorridor=false)',
      noReal.className === 'NO_REAL_CORRIDOR' && !noReal.isRealCorridor, noReal.className);

    const limit = computeVWCorrelationField({ dx: 5, W: 4, V: 1.0, c: 1, tSend: 2 });
    check('Sub-c: v=1.0c ⇒ LIGHT_SPEED_LIMIT, isSubC=false',
      limit.className === 'LIGHT_SPEED_LIMIT' && limit.isSubC === false, limit.className);
  }

  // ---- V–W correlation field (β²+η²) ---------------------------------------
  {
    const f1 = computeVWCorrelationField({ dx: 5, W: 4, c: 1, V: 0.8 });
    check('V–W field: D=5,W=4,V=0.8 ⇒ β²+η²=1.28 ⇒ SUBC_BEATS_LIGHT',
      f1.className === 'SUBC_BEATS_LIGHT' && near(f1.fieldScore, 1.28) && f1.margin > 0,
      `score=${f1.fieldScore.toFixed(3)}, ${f1.className}`);

    const f2 = computeVWCorrelationField({ dx: 5, W: 2, c: 1, V: 0.8 });
    check('V–W field: D=5,W=2,V=0.8 ⇒ β²+η²=0.80 ⇒ SUBC_TOO_SLOW',
      f2.className === 'SUBC_TOO_SLOW' && near(f2.fieldScore, 0.8) && f2.margin < 0,
      `score=${f2.fieldScore.toFixed(3)}, ${f2.className}`);

    const f3 = computeVWCorrelationField({ dx: 5, W: 3, c: 1, V: 0.8 });
    check('V–W field: D=5,W=3,V=0.8 ⇒ β²+η²=1.0 ⇒ EQUAL_TO_LIGHT_BASELINE',
      f3.className === 'EQUAL_TO_LIGHT_BASELINE' && near(f3.fieldScore, 1, 1e-6),
      `score=${f3.fieldScore.toFixed(6)}, ${f3.className}`);

    const f4 = computeVWCorrelationField({ dx: 5, W: 5, c: 1, V: 0.8 });
    check('V–W field: W=5 (η=1) ⇒ KIDI_BOUNDARY', f4.className === 'KIDI_BOUNDARY', f4.className);

    const f5 = computeVWCorrelationField({ dx: 5, W: 6, c: 1, V: 0.8 });
    check('V–W field: W=6 (η=1.2) ⇒ NO_REAL_CORRIDOR', f5.className === 'NO_REAL_CORRIDOR', f5.className);

    // integration: Diagnostics carries the field (default β_sub=0.8, paradox W=√24≈4.9)
    check('V–W field integration: shortcut phase (W=4, v=0.8c) is SUBC_BEATS_LIGHT in Diagnostics',
      d1.vwCorrelation.className === 'SUBC_BEATS_LIGHT', d1.vwCorrelation.className);
  }

  return r;
}

/** Convenience: true if every test passes. */
export function allPass(results: TestResult[]): boolean {
  return results.every((t) => t.pass);
}
