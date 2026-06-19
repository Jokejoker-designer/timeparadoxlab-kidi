/**
 * ProjectionSpeedCanvas — "Kidi Light-Speed Projection".
 *
 * A faux-3D speed surface over axes  X = |dx|,  Z = |W|=|alpha|,  Y = beta_equiv.
 * Shows the glowing beta = 1 reference plane (light-speed constant c), the rising
 * speed surface beta = |dx| / sqrt(dx^2 - dW^2), the bright Kidi boundary edge
 * where |dW| = |dx|, the shaded no-real-projection region |dW| > |dx|, and the
 * current scenario marker.
 *
 * beta>1 is a PROJECTION statement inside the speculative model, not verified FTL.
 */
import { useRef, useEffect } from 'react';
import { Diagnostics } from '../core/simulation';
import { ProjectionClass } from '../core/physics';

interface Props {
  diag: Diagnostics;
  width: number;
  height: number;
  pulse: number;
}

const CLASS_COLOR: Record<ProjectionClass, string> = {
  LIGHT_SPEED: '#3fd0ff',
  PROJECTED_SUPERLUMINAL: '#56e39f',
  KIDI_BOUNDARY: '#ffd23b',
  W_DOMAIN_NO_REAL_DT: '#e23bd0',
  UNDEFINED_DX: '#ff6b6b',
};

const CLASS_LABEL: Record<ProjectionClass, string> = {
  LIGHT_SPEED: 'LIGHT-SPEED (β=1)',
  PROJECTED_SUPERLUMINAL: 'PROJECTED SUPERLUMINAL (β>1)',
  KIDI_BOUNDARY: 'KIDI BOUNDARY (Δ_signal=0)',
  W_DOMAIN_NO_REAL_DT: 'W DOMAIN — no real projected dt',
  UNDEFINED_DX: 'UNDEFINED (dx→0)',
};

const BETA_MAX = 6;

export function ProjectionSpeedCanvas({ diag, width, height, pulse }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pj = diag.projection;
    const dxAbs = Math.abs(pj.dx);
    const dwAbs = Math.abs(pj.dW);

    const xMax = Math.max(dxAbs * 1.6, dwAbs * 1.2, 6);
    const zMax = xMax;

    // oblique projection params
    const padL = 60, padT = 30, padB = 36, padR = 24;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const A = (28 * Math.PI) / 180;
    const kx = (plotW * 0.62) / xMax;
    const depth = plotW * 0.32;
    const kz = depth / zMax;
    const ky = (plotH * 0.80) / BETA_MAX;
    const baseY = padT + plotH * 0.94;
    const baseX = padL + 6;
    const PX = (X: number, Z: number) => baseX + X * kx + Z * kz * Math.cos(A);
    const PY = (X: number, Z: number, Y: number) => baseY - Y * ky - Z * kz * Math.sin(A);

    // background
    ctx.fillStyle = '#0a0e16';
    ctx.fillRect(0, 0, width, height);

    // floor grid (beta=0)
    ctx.strokeStyle = 'rgba(120,140,170,0.12)';
    ctx.lineWidth = 1;
    const NX = 8, NZ = 8;
    for (let i = 0; i <= NX; i++) {
      const X = (i / NX) * xMax;
      ctx.beginPath(); ctx.moveTo(PX(X, 0), PY(X, 0, 0)); ctx.lineTo(PX(X, zMax), PY(X, zMax, 0)); ctx.stroke();
    }
    for (let k = 0; k <= NZ; k++) {
      const Z = (k / NZ) * zMax;
      ctx.beginPath(); ctx.moveTo(PX(0, Z), PY(0, Z, 0)); ctx.lineTo(PX(xMax, Z), PY(xMax, Z, 0)); ctx.stroke();
    }

    // no-real-projection region |Z| > |X| (floor triangle beyond the diagonal)
    ctx.fillStyle = 'rgba(226,59,208,0.14)';
    ctx.beginPath();
    ctx.moveTo(PX(0, 0), PY(0, 0, 0));
    ctx.lineTo(PX(0, zMax), PY(0, zMax, 0));
    ctx.lineTo(PX(xMax, zMax), PY(xMax, zMax, 0));
    // back to diagonal Z=X at X=xMax... close along Z=X
    ctx.lineTo(PX(xMax, xMax), PY(xMax, xMax, 0));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(226,59,208,0.85)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('W domain', PX(0.4, zMax * 0.78), PY(0.4, zMax * 0.78, 0));
    ctx.fillText('no real dt', PX(0.4, zMax * 0.78) , PY(0.4, zMax * 0.78, 0) + 12);

    // beta = 1 reference plane (light-speed constant c)
    ctx.fillStyle = 'rgba(63,208,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(PX(0, 0), PY(0, 0, 1));
    ctx.lineTo(PX(xMax, 0), PY(xMax, 0, 1));
    ctx.lineTo(PX(xMax, zMax), PY(xMax, zMax, 1));
    ctx.lineTo(PX(0, zMax), PY(0, zMax, 1));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(63,208,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PX(0, 0), PY(0, 0, 1)); ctx.lineTo(PX(xMax, 0), PY(xMax, 0, 1)); ctx.stroke();
    ctx.fillStyle = '#9fe0ff';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('Light-speed reference · β = 1', PX(xMax * 0.06, 0), PY(xMax * 0.06, 0, 1) - 6);
    ctx.fillStyle = 'rgba(120,200,240,0.7)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('cyan β=1 plane = ordinary α=0 light baseline', padL, height - 22);

    // speed surface beta = X / sqrt(X^2 - Z^2), as constant-X "fins"
    const fins = 9;
    for (let i = 1; i <= fins; i++) {
      const X = (i / fins) * xMax;
      ctx.strokeStyle = `rgba(86,227,159,${0.30 + 0.5 * (i / fins)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const Z = (s / steps) * X * 0.985;
        const d = X * X - Z * Z;
        if (d <= 1e-9) break;
        const beta = Math.min(BETA_MAX, X / Math.sqrt(d));
        const x = PX(X, Z), y = PY(X, Z, beta);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Kidi boundary edge: the diagonal Z=X, rising wall to BETA_MAX
    ctx.strokeStyle = '#ffd23b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(PX(0, 0), PY(0, 0, 0));
    ctx.lineTo(PX(xMax, xMax), PY(xMax, xMax, 0));
    ctx.stroke();
    // wall at the diagonal (pulse)
    const wallPulse = 0.5 + 0.4 * Math.sin(pulse * 4);
    ctx.strokeStyle = `rgba(255,210,59,${wallPulse})`;
    ctx.lineWidth = 1.2;
    for (let s = 1; s <= 6; s++) {
      const X = (s / 6) * xMax;
      ctx.beginPath();
      ctx.moveTo(PX(X, X), PY(X, X, 0));
      ctx.lineTo(PX(X, X), PY(X, X, BETA_MAX));
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23b';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('Kidi Boundary  Δ_signal = 0', PX(xMax, xMax) - 150, PY(xMax, xMax, BETA_MAX) + 14);

    // axes labels
    ctx.fillStyle = 'rgba(180,200,230,0.85)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('|dx|', PX(xMax, 0) + 4, PY(xMax, 0, 0) + 4);
    ctx.fillStyle = 'rgba(170,120,255,0.9)';
    ctx.fillText('|W| = |α|', PX(0, zMax) - 6, PY(0, zMax, 0) + 14);
    ctx.fillStyle = 'rgba(86,227,159,0.95)';
    ctx.save();
    ctx.translate(padL - 44, padT + plotH * 0.4);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('β = v/c', 0, 0);
    ctx.restore();

    // current marker — height depends on the projection class
    const color = CLASS_COLOR[pj.className];
    if (pj.className !== 'UNDEFINED_DX' && Number.isFinite(dxAbs)) {
      const Xc = Math.min(dxAbs, xMax);
      const Zc = Math.min(dwAbs, zMax);
      let Yc: number;
      if (pj.className === 'W_DOMAIN_NO_REAL_DT') {
        Yc = 0; // no real β — sits on the floor in the magenta no-real region
      } else if (pj.className === 'KIDI_BOUNDARY') {
        Yc = BETA_MAX; // diverging — at the top of the kidi wall
      } else {
        Yc = pj.betaEquiv.kind === 'Real' ? Math.min(BETA_MAX, pj.betaEquiv.value) : BETA_MAX;
      }
      // drop line
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(PX(Xc, Zc), PY(Xc, Zc, 0)); ctx.lineTo(PX(Xc, Zc), PY(Xc, Zc, Yc)); ctx.stroke();
      ctx.setLineDash([]);
      // marker
      const pulsing = pj.className === 'KIDI_BOUNDARY';
      const r = pulsing ? 5 + 3 * (0.5 + 0.5 * Math.sin(pulse * 6)) : 5;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(PX(Xc, Zc), PY(Xc, Zc, Yc), r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      if (pj.className === 'W_DOMAIN_NO_REAL_DT') {
        ctx.fillStyle = color;
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText('no real dt', PX(Xc, Zc) + 8, PY(Xc, Zc, 0));
      }
    }

    // title + readout
    ctx.fillStyle = 'rgba(180,200,230,0.9)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Kidi Light-Speed Projection', padL, 16);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px ui-monospace, monospace';
    const betaText =
      pj.betaEquiv.kind === 'Real' ? `β=${pj.betaEquiv.value.toFixed(3)}`
      : pj.betaEquiv.kind === 'Singular' ? `β=Singular(σ^½)` : 'β=⊥';
    ctx.fillText(`${CLASS_LABEL[pj.className]}   ${betaText}`, padL, height - 8);
  }, [diag, width, height, pulse]);

  return <canvas ref={ref} style={{ width, height, borderRadius: 8 }} />;
}
