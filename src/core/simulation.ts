/**
 * simulation.ts — scenario, phases, the escalation state machine and events.
 *
 * Escalation ladder (deep-research report → "promotion rules"):
 *   order 0   → Real                          (ordinary signalling)
 *   order ½   → BOUNDARY_TOUCH  (Singular)     (touch a singular boundary)
 *   order 1   → REVERSE_ARRIVAL (Singular,'-') (reverse-time causal event)
 *   Bottom    → FEEDBACK_CONTRADICTION (⊥)     (higher-order closed-loop paradox)
 *
 * The final instruction of the WO: contradictions are PRESERVED as data
 * (a typed Bottom / Singular state), never hidden or coerced to ∞.
 */

import {
  SingularValue,
  Real,
  Singular,
  Bottom,
  format,
  Branch,
} from './singular';
import {
  SignalSetup,
  SignalResult,
  propagateSignal,
  Kinematics,
  gamma5D,
  splitNorm,
  classifyDomain,
  Domain,
  computeProjectionSpeed,
  ProjectionSpeedResult,
  computeLightBaseline,
  LightBaselineResult,
  computeVWCorrelationField,
  VWCorrelationResult,
} from './physics';

// --- scenario & phases ------------------------------------------------------

export interface Scenario {
  xBob: number;
  xAlice: number;
  tSend: number;
  c: number;
  eps: number;
  /** local sub-c corridor speed ratio v/c (default 0.8) */
  betaSub?: number;
}

export const DEFAULT_SCENARIO: Scenario = {
  xBob: 0,
  xAlice: 5,
  tSend: 2,
  c: 1,
  eps: 1e-6,
  betaSub: 0.8,
};

export interface Phase {
  id: string;
  name: string;
  alpha: number;
  branch: Branch;
  /** expected arrival time used by the built-in demo / self-tests */
  expectedArrival: number;
  blurb: string;
  /**
   * When true, the phase additionally attempts to *close the causal loop*
   * (send a reply from the reverse arrival back before the cause). This is the
   * highest escalation rung and yields Bottom. Off by default so a reverse
   * arrival is still shown as data (arrives at t=1) rather than collapsing.
   */
  closeLoop?: boolean;
}

/**
 * Built-in demo sequence tuned to the WO example (Bob x=0, Alice x=5, send t=2, c=1).
 * The first three are the WO's named phases; the last two complete the escalation
 * ladder required by the promotion rules: order 0 → ½ → 1 → ⊥.
 */
export const DEMO_PHASES: Phase[] = [
  {
    id: 'ordinary',
    name: 'Ordinary (α = 0)',
    alpha: 0,
    branch: '+',
    expectedArrival: 7,
    blurb: 'α=0 recovers special relativity: signal crawls at light speed, arrives t=7.',
  },
  {
    id: 'shortcut',
    name: 'Mild shortcut (α = 4)',
    alpha: 4,
    branch: '+',
    expectedArrival: 5,
    blurb: 'Growing α shortens projected travel time. Still forward in time → arrives t=5.',
  },
  {
    id: 'boundary',
    name: 'Boundary touch (α = 5)',
    alpha: 5,
    branch: '+',
    expectedArrival: 2,
    blurb: 'dx²−dα²=0: the projected null boundary. dt=0, arrival t=2. Singular order ½ tag.',
  },
  {
    id: 'paradox',
    name: 'Paradox (α = √24)',
    alpha: Math.sqrt(24),
    branch: '-',
    expectedArrival: 1,
    blurb: 'Reverse (−) branch lands at t=1 < send t=2 — a singular causal event, kept as data.',
  },
  {
    id: 'feedback',
    name: 'Feedback contradiction (α = √24, reply)',
    alpha: Math.sqrt(24),
    branch: '-',
    expectedArrival: 1,
    closeLoop: true,
    blurb: 'Closing the loop: a reply from t=1 lands before the cause t=2 → ⊥ Bottom, preserved as data.',
  },
];

/** The three WO-named phases (used by self-tests / acceptance). */
export const CANONICAL_PHASE_IDS = ['ordinary', 'shortcut', 'paradox'] as const;

// --- events -----------------------------------------------------------------

export type EventType =
  | 'PHASE_CHANGE'
  | 'SEND'
  | 'LIGHT_BASELINE'
  | 'BOUNDARY_TOUCH'
  | 'REVERSE_ARRIVAL'
  | 'FEEDBACK_CONTRADICTION'
  | 'RECEIVE'
  | 'EXPORT';

export type EventLevel = 'info' | 'warn' | 'singular' | 'bottom';

/** Flat snapshot of the scenario + phase controls at event time (schema shape). */
export interface ScenarioSnapshot {
  xBob: number;
  xAlice: number;
  tSend: number;
  c: number;
  eps: number;
  alpha: number;
  branch: Branch;
  closeLoop: boolean;
}

/**
 * A research-grade, exportable event. Shape matches sim-event.schema.json so the
 * exported JSON validates. `typedState` is the event's typed singular value;
 * `arrival` is the (optional) numeric arrival; `payload` carries 3D coordinates.
 */
export interface SimEvent {
  id: string;
  seq: number;
  type: EventType;
  level: EventLevel;
  phaseId: string;
  message: string;
  timestamp: number;
  scenario: ScenarioSnapshot;
  typedState: SingularValue;
  arrival?: SingularValue;
  payload?: Record<string, unknown>;
}

export function snapshotOf(scn: Scenario, phase: Phase): ScenarioSnapshot {
  return {
    xBob: scn.xBob,
    xAlice: scn.xAlice,
    tSend: scn.tSend,
    c: scn.c,
    eps: scn.eps,
    alpha: phase.alpha,
    branch: phase.branch,
    closeLoop: !!phase.closeLoop,
  };
}

// --- full diagnostic snapshot for one phase ---------------------------------

export interface Diagnostics {
  scenario: Scenario;
  phase: Phase;
  signal: SignalResult;
  /** Δ_split = x² − α² evaluated at the receiver position with this phase */
  deltaSplit: number;
  splitDomain: Domain;
  /** 5D diagnostic for the worldline implied by this signalling */
  kinematics: Kinematics;
  delta5D: number;
  gamma5D: SingularValue;
  gamma5DDomain: Domain;
  /** overall escalation order reached */
  order: number;
  /** typed arrival */
  arrival: SingularValue;
  reverse: boolean;
  /** Bottom if a feedback contradiction is detected */
  contradiction: SingularValue | null;
  /** Kidi light-speed projection observable (equivalent projected 3D speed) */
  projection: ProjectionSpeedResult;
  /** ordinary α=0 light-speed reference baseline (a fixed comparison ruler) */
  lightBaseline: LightBaselineResult;
  /** reduced Kidi corridor V–W correlation field (can V<c still beat light?) */
  vwCorrelation: VWCorrelationResult;
}

/**
 * Evaluate one phase end-to-end: signal propagation + split-complex invariant +
 * 5D diagnostic, then decide whether a feedback contradiction (Bottom) arises.
 *
 * Feedback-contradiction rule: a reverse arrival could be used to send a *reply*
 * back to the sender. If that reply (same branch flipped to forward, same dt)
 * would itself land before the original cause, the loop is closed and the state
 * is structurally indeterminate → Bottom (highest escalation).
 */
export function evaluatePhase(scn: Scenario, phase: Phase): Diagnostics {
  const setup: SignalSetup = {
    xSender: scn.xBob,
    xReceiver: scn.xAlice,
    tSend: scn.tSend,
    alpha: phase.alpha,
    c: scn.c,
    branch: phase.branch,
  };
  const signal = propagateSignal(setup, scn.eps);

  // split-complex invariant at receiver under this phase
  const deltaSplit = splitNorm({ x: scn.xAlice - scn.xBob, alpha: phase.alpha });
  const splitDomain = classifyDomain(deltaSplit, scn.eps);

  // Kidi light-speed projection observable (equivalent projected 3D speed)
  const projection = computeProjectionSpeed({
    dx: signal.dx,
    dW: signal.dAlpha,
    c: scn.c,
    eps: scn.eps,
    branch: phase.branch,
  });

  // ordinary α=0 light-speed reference baseline (comparison ruler)
  const lightBaseline = computeLightBaseline({
    xSender: scn.xBob,
    xReceiver: scn.xAlice,
    tSend: scn.tSend,
    c: scn.c,
    eps: scn.eps,
  });

  // reduced Kidi corridor V–W correlation field (local V<c vs the α=0 light baseline)
  const betaSub = scn.betaSub ?? 0.8;
  const vwCorrelation = computeVWCorrelationField({
    dx: signal.dx,
    W: signal.dAlpha,
    V: betaSub * scn.c,
    c: scn.c,
    tSend: scn.tSend,
    eps: scn.eps,
    branch: phase.branch,
  });

  // kinematics implied by the signal: it covers dx in |dt| with alpha-rate u.
  const dtMag =
    signal.dtSignal.kind === 'Real'
      ? Math.abs(signal.dtSignal.value)
      : Math.abs(signal.dtSignal.kind === 'Singular' ? signal.dtSignal.coeff : 0);
  const v = dtMag > 0 ? Math.abs(signal.dx) / dtMag : Infinity;
  const u = dtMag > 0 ? Math.abs(signal.dAlpha) / dtMag : Infinity;
  const kinematics: Kinematics = { v, u, c: scn.c };
  const g = gamma5D(kinematics, scn.eps);

  // feedback contradiction detection — only when the phase opts to close the loop
  let contradiction: SingularValue | null = null;
  let order = signal.order;
  if (phase.closeLoop && signal.reverse && signal.tArrive.kind !== 'Bottom') {
    // A reply travels the same dt back; if cause precedes effect both ways, ⊥.
    const arriveT =
      signal.tArrive.kind === 'Real' ? signal.tArrive.value
      : signal.tArrive.coeff;
    const replyArrival = arriveT - dtMag; // reply sent from reverse arrival back to Bob
    if (replyArrival < scn.tSend - scn.eps) {
      // The contradiction is represented by the typed Bottom state, NOT by a
      // synthetic infinite singular order. `order` stays finite (1, reverse).
      contradiction = Bottom(
        `closed causal loop: reply lands t=${replyArrival.toFixed(3)} < cause t=${scn.tSend}`,
      );
    }
  }

  return {
    scenario: scn,
    phase,
    signal,
    deltaSplit,
    splitDomain,
    kinematics,
    delta5D: g.delta,
    gamma5D: g.gamma,
    gamma5DDomain: g.domain,
    order,
    arrival: signal.tArrive,
    reverse: signal.reverse,
    contradiction,
    projection,
    lightBaseline,
    vwCorrelation,
  };
}

/**
 * Build the ordered event list for a phase from its diagnostics.
 * Events carry the full schema shape (id, scenario snapshot, typedState, 3D
 * payload), so the event log can be exported as valid JSON.
 */
export function buildEvents(diag: Diagnostics, startSeq: number, now = Date.now() / 1000): SimEvent[] {
  const out: SimEvent[] = [];
  const snap = snapshotOf(diag.scenario, diag.phase);
  const arriveN = arrivalNumber(diag.arrival);
  const send3: Triple = [diag.scenario.xBob, diag.scenario.tSend, 0];
  const arrive3: Triple = [diag.scenario.xAlice, arriveN, diag.phase.alpha];
  let seq = startSeq;

  const push = (
    type: EventType,
    level: EventLevel,
    message: string,
    typedState: SingularValue,
    arrival?: SingularValue,
    payload?: Record<string, unknown>,
  ) => {
    out.push({
      id: `evt-${String(seq).padStart(4, '0')}`,
      seq,
      type,
      level,
      phaseId: diag.phase.id,
      message,
      timestamp: now + seq * 1e-3,
      scenario: snap,
      typedState,
      arrival,
      payload,
    });
    seq++;
  };

  push('PHASE_CHANGE', 'info', `Phase → ${diag.phase.name} (branch ${diag.phase.branch})`, Real(diag.scenario.tSend));
  push(
    'SEND',
    'info',
    `Bob emits at x=${diag.scenario.xBob}, t=${diag.scenario.tSend}, α=${num(diag.phase.alpha)}`,
    Real(diag.scenario.tSend),
    undefined,
    { send: send3 },
  );

  if (diag.lightBaseline.label === 'LIGHT_SPEED_BASELINE') {
    const lbN = diag.lightBaseline.tLightArrival.kind === 'Real' ? diag.lightBaseline.tLightArrival.value : NaN;
    push(
      'LIGHT_BASELINE',
      'info',
      `Light baseline: Bob emits α=0 reference ray, arrival ${arrivalText(diag.lightBaseline.tLightArrival)} (β=1)`,
      diag.lightBaseline.dtLight,
      diag.lightBaseline.tLightArrival,
      { send: send3, arrival: [diag.scenario.xAlice, lbN, 0] },
    );
  }

  if (diag.splitDomain === 'SINGULAR_BOUNDARY' || diag.signal.domain === 'SINGULAR_BOUNDARY') {
    push(
      'BOUNDARY_TOUCH',
      'singular',
      `Singular boundary touched (Δ_split=${num(diag.deltaSplit)}, dx²−dα²=${num(diag.signal.underRoot)}) — order ½ tag created`,
      diag.signal.dtSignal,
      diag.arrival,
      { deltaSplit: diag.deltaSplit, deltaSignal: diag.signal.underRoot, send: send3, arrival: arrive3 },
    );
  }

  if (diag.reverse) {
    push(
      'REVERSE_ARRIVAL',
      'singular',
      `Alice receives before Bob sends: lands ${arrivalText(diag.arrival)} < send ${diag.scenario.tSend}. Preserved as Singular(order 1).`,
      Singular(1, 1, '-', 'reverse arrival'),
      diag.arrival,
      { send: send3, arrival: arrive3, deltaSignal: diag.signal.underRoot },
    );
  }

  if (diag.contradiction) {
    push(
      'FEEDBACK_CONTRADICTION',
      'bottom',
      `Higher-order feedback contradiction → ${format(diag.contradiction)}. Kept as Bottom, NOT discarded.`,
      diag.contradiction,
      diag.arrival,
      { send: send3, arrival: arrive3, branch: 'feedback' },
    );
  } else {
    push(
      'RECEIVE',
      diag.reverse ? 'warn' : 'info',
      `Alice ${diag.reverse ? '(paradoxically) ' : ''}receives at x=${diag.scenario.xAlice}, t=${arrivalText(diag.arrival)}`,
      diag.arrival,
      diag.arrival,
      { send: send3, arrival: arrive3, deltaSignal: diag.signal.underRoot },
    );
  }

  return out;
}

// --- small formatters / helpers ---------------------------------------------

type Triple = [number, number, number];

export function arrivalNumber(v: SingularValue): number {
  if (v.kind === 'Real') return v.value;
  if (v.kind === 'Singular') return v.coeff;
  return NaN;
}

function num(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(3);
}
export function arrivalText(v: SingularValue): string {
  if (v.kind === 'Real') return `t=${num(v.value)}`;
  if (v.kind === 'Singular') return `t≈${num(v.coeff)} (σ^${v.order})`;
  return '⊥';
}
