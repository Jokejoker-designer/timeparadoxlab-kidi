/**
 * DiagnosticsPanel — the typed numeric readout. Shows the split-complex
 * invariant, the 5D diagnostic, the signal result, the escalation order, and
 * the typed arrival value (Real / Singular / Bottom). Contradictions are shown,
 * never hidden.
 */
import { Diagnostics } from '../core/simulation';
import { format, SingularValue } from '../core/singular';
import { Domain, ProjectionClass, VWCorrelationClass } from '../core/physics';

interface Props {
  diag: Diagnostics;
}

const PROJECTION_COLOR: Record<ProjectionClass, string> = {
  LIGHT_SPEED: '#3fd0ff',
  PROJECTED_SUPERLUMINAL: '#56e39f',
  KIDI_BOUNDARY: '#ffd23b',
  W_DOMAIN_NO_REAL_DT: '#e23bd0',
  UNDEFINED_DX: '#ff6b6b',
};

const PROJECTION_LABEL: Record<ProjectionClass, string> = {
  LIGHT_SPEED: 'Light-speed (β=1)',
  PROJECTED_SUPERLUMINAL: 'Projected superluminal',
  KIDI_BOUNDARY: 'Kidi Boundary',
  W_DOMAIN_NO_REAL_DT: 'W domain — no real projected dt',
  UNDEFINED_DX: 'Undefined (dx→0)',
};

const VW_COLOR: Record<VWCorrelationClass, string> = {
  SUBC_BEATS_LIGHT: '#ffd23b',
  EQUAL_TO_LIGHT_BASELINE: '#3fd0ff',
  SUBC_TOO_SLOW: '#6f9bdc',
  KIDI_BOUNDARY: '#ff9d3b',
  NO_REAL_CORRIDOR: '#e23bd0',
  LIGHT_SPEED_LIMIT: '#ffb13b',
  INVALID_INPUT: '#ff6b6b',
};

const VW_LABEL: Record<VWCorrelationClass, string> = {
  SUBC_BEATS_LIGHT: 'Sub-c beats light',
  EQUAL_TO_LIGHT_BASELINE: 'Equal to light baseline',
  SUBC_TOO_SLOW: 'Too slow',
  KIDI_BOUNDARY: 'Kidi Boundary',
  NO_REAL_CORRIDOR: 'No real corridor',
  LIGHT_SPEED_LIMIT: 'Light-speed limit (V≥c)',
  INVALID_INPUT: 'Invalid input',
};

const domainColor = (d: Domain) =>
  d === 'REAL_DOMAIN' ? '#56e39f' : d === 'SINGULAR_BOUNDARY' ? '#ffd23b' : '#e23bd0';

function orderLabel(order: number): string {
  if (!Number.isFinite(order)) return '⊥  (Bottom / contradiction)';
  if (order === 0) return '0  (Real domain)';
  if (order === 0.5) return '½  (boundary touch)';
  if (order === 1) return '1  (reverse-arrival paradox)';
  return String(order);
}

function valueColor(v: SingularValue): string {
  if (v.kind === 'Real') return '#9fe8c4';
  if (v.kind === 'Singular') return '#ffd23b';
  return '#ff6b6b';
}

export function DiagnosticsPanel({ diag }: Props) {
  const Row = ({ label, children }: { label: string; children: any }) => (
    <div className="diag-row">
      <span className="diag-label">{label}</span>
      <span className="diag-val">{children}</span>
    </div>
  );

  const lb = diag.lightBaseline;
  const lightArrival = lb.tLightArrival.kind === 'Real' ? lb.tLightArrival.value : null;
  const currentArrival = diag.arrival.kind === 'Real' ? diag.arrival.value : null;
  const gain = lightArrival !== null && currentArrival !== null ? lightArrival - currentArrival : null;
  const gainText =
    gain === null ? 'current arrival is typed kidi/non-real; gain not a normal real number'
    : Math.abs(gain) < 1e-9 ? 'matches light baseline'
    : gain > 0 ? `arrives before light baseline by ${gain.toFixed(3)}`
    : `arrives after light baseline by ${Math.abs(gain).toFixed(3)}`;

  const vc = diag.vwCorrelation;
  const wMin = Number.isFinite(vc.etaThreshold) ? vc.D * vc.etaThreshold : NaN;
  const validW = Number.isFinite(wMin) ? `${wMin.toFixed(3)} < |W| < ${vc.D.toFixed(3)}` : 'n/a (V≥c)';
  const vMin = Number.isFinite(vc.betaThreshold) ? vc.c * vc.betaThreshold : NaN;
  const validV = Number.isFinite(vMin) ? `${vMin.toFixed(3)} < V < ${vc.c.toFixed(3)}` : 'n/a (|W|≥|dx|)';

  return (
    <div className="panel diagnostics">
      <h3>Diagnostics</h3>

      <div className="diag-group">
        <div className="diag-group-title">Geometry — split-complex z = x + jα</div>
        <Row label="Δ_split = x²−α²">{diag.deltaSplit.toFixed(4)}</Row>
        <Row label="domain">
          <span style={{ color: domainColor(diag.splitDomain) }}>{diag.splitDomain}</span>
        </Row>
      </div>

      <div className="diag-group">
        <div className="diag-group-title">5D diagnostic — ds²=c²dt²−dr²+dα²</div>
        <Row label="v (3-speed)">{fmt(diag.kinematics.v)}</Row>
        <Row label="u = dα/dt">{fmt(diag.kinematics.u)}</Row>
        <Row label="Δ₅D = 1−(v²−u²)/c²">{diag.delta5D.toFixed(4)}</Row>
        <Row label="γ₅D">
          <span style={{ color: valueColor(diag.gamma5D) }}>{format(diag.gamma5D)}</span>
        </Row>
        <Row label="domain">
          <span style={{ color: domainColor(diag.gamma5DDomain) }}>{diag.gamma5DDomain}</span>
        </Row>
      </div>

      <div className="diag-group">
        <div className="diag-group-title">Signal — |dt|=√(dx²−dα²)/c</div>
        <Row label="dx, dα">{`${fmt(diag.signal.dx)}, ${fmt(diag.signal.dAlpha)}`}</Row>
        <Row label="dx²−dα²">{diag.signal.underRoot.toFixed(4)}</Row>
        <Row label="branch">{diag.phase.branch}</Row>
        <Row label="|dt_signal|">
          <span style={{ color: valueColor(diag.signal.dtSignal) }}>{format(diag.signal.dtSignal)}</span>
        </Row>
        <Row label="arrival t">
          <span style={{ color: valueColor(diag.arrival) }}>{format(diag.arrival)}</span>
        </Row>
        <Row label="reverse?">
          <span style={{ color: diag.reverse ? '#ff7a3b' : '#9fe8c4' }}>
            {diag.reverse ? 'YES — reverse-time arrival' : 'no'}
          </span>
        </Row>
      </div>

      <div className="diag-group">
        <div className="diag-group-title">Light-Speed Reference Baseline</div>
        <Row label="dx">{fmt(lb.dx)}</Row>
        <Row label="c">{fmt(lb.c)}</Row>
        <Row label="dt_light = |dx|/c">
          <span style={{ color: valueColor(lb.dtLight) }}>{format(lb.dtLight)}</span>
        </Row>
        <Row label="t_light_arrival">
          <span style={{ color: valueColor(lb.tLightArrival) }}>{format(lb.tLightArrival)}</span>
        </Row>
        <Row label="β_light">{Number.isFinite(lb.beta) ? lb.beta : '—'}</Row>
        <Row label="current arrival">
          <span style={{ color: valueColor(diag.arrival) }}>{format(diag.arrival)}</span>
        </Row>
        <Row label="vs light">
          <span style={{ color: gain === null ? '#ffd23b' : gain > 1e-9 ? '#9fe8c4' : gain < -1e-9 ? '#ff7a3b' : '#9fb6d6' }}>
            {gainText}
          </span>
        </Row>
        {lb.warning && <div className="diag-warn">{lb.warning}</div>}
        <div className="diag-note">
          The α=0 light baseline is a fixed comparison ruler — not a photon rest frame and
          not a new coordinate system.
        </div>
      </div>

      <div className="diag-group">
        <div className="diag-group-title">Kidi Light-Speed Projection</div>
        <Row label="c (constant)">{fmt(diag.projection.c)}</Row>
        <Row label="Δ_signal = dx²−dW²">{diag.projection.deltaSignal.toFixed(4)}</Row>
        <Row label="η = |dW|/|dx|">{fmt(diag.projection.eta)}</Row>
        <Row label="ρ = Δ_signal/dx²">{fmt(diag.projection.rho)}</Row>
        <Row label="β_equiv = v_equiv/c">
          {diag.projection.isRealProjection ? (
            <span style={{ color: valueColor(diag.projection.betaEquiv) }}>{format(diag.projection.betaEquiv)}</span>
          ) : (
            <span style={{ color: '#ffd23b' }}>Kidi-tagged / non-real</span>
          )}
        </Row>
        <Row label="v_equiv">
          {diag.projection.isRealProjection ? (
            <span style={{ color: valueColor(diag.projection.vEquiv) }}>{format(diag.projection.vEquiv)}</span>
          ) : (
            <span style={{ color: '#ffd23b' }}>not a real speed</span>
          )}
        </Row>
        <Row label="real projection?">
          <span style={{ color: diag.projection.isRealProjection ? '#9fe8c4' : '#e23bd0' }}>
            {diag.projection.isRealProjection ? 'yes' : 'no'}
          </span>
        </Row>
        <Row label="class">
          <span style={{ color: PROJECTION_COLOR[diag.projection.className] }}>
            {PROJECTION_LABEL[diag.projection.className]}
          </span>
        </Row>
        {diag.projection.warning && <div className="diag-warn">{diag.projection.warning}</div>}
        <div className="diag-note">
          v_equiv is the equivalent 3D speed needed to reproduce the same arrival time —
          projected superluminal <em>inside the simulator</em>, not verified real-world FTL.
        </div>
      </div>

      <div className="diag-group">
        <div className="diag-group-title">V–W Correlation Field (reduced Kidi corridor)</div>
        <Row label="D = |dx|">{fmt(vc.D)}</Row>
        <Row label="V, c">{`${fmt(vc.V)}, ${fmt(vc.c)}`}</Row>
        <Row label="β = V/c">{fmt(vc.beta)}</Row>
        <Row label="η = |W|/D">{fmt(vc.eta)}</Row>
        <Row label="β² + η²">{Number.isFinite(vc.fieldScore) ? vc.fieldScore.toFixed(3) : '—'}</Row>
        <Row label="margin = β²+η²−1">
          <span style={{ color: vc.margin > 1e-6 ? '#9fe8c4' : vc.margin < -1e-6 ? '#6f9bdc' : '#3fd0ff' }}>
            {Number.isFinite(vc.margin) ? (vc.margin >= 0 ? `+${vc.margin.toFixed(3)}` : vc.margin.toFixed(3)) : '—'}
          </span>
        </Row>
        <Row label="effective distance">
          <span style={{ color: valueColor(vc.effectiveDistance) }}>{format(vc.effectiveDistance)}</span>
        </Row>
        <Row label="valid W region">{validW}</Row>
        <Row label="valid V region">{validV}</Row>
        <Row label="t_light = D/c">
          <span style={{ color: valueColor(vc.dtLight) }}>{format(vc.dtLight)}</span>
        </Row>
        <Row label="t_sub-c = D_eff/V">
          <span style={{ color: valueColor(vc.dtSubC) }}>{format(vc.dtSubC)}</span>
        </Row>
        <Row label="gain vs light">
          <span style={{ color: valueColor(vc.gainVsLight) }}>{format(vc.gainVsLight)}</span>
        </Row>
        <Row label="classification">
          <span style={{ color: VW_COLOR[vc.className] }}>{VW_LABEL[vc.className]}</span>
        </Row>
        <div className="diag-note">
          Higher W/α corridor contribution lowers the local V needed to beat the light baseline.
          {' '}{vc.message}
        </div>
      </div>

      <div className="diag-group">
        <div className="diag-group-title">Escalation</div>
        <Row label="singular order λ">
          <span style={{ color: Number.isFinite(diag.order) ? (diag.order > 0 ? '#ffd23b' : '#9fe8c4') : '#ff6b6b' }}>
            {orderLabel(diag.order)}
          </span>
        </Row>
        {diag.contradiction && (
          <Row label="contradiction">
            <span style={{ color: '#ff6b6b' }}>{format(diag.contradiction)}</span>
          </Row>
        )}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
  return Number.isInteger(n) ? n.toString() : n.toFixed(3);
}
