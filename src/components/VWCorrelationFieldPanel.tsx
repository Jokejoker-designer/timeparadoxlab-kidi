/**
 * VWCorrelationFieldPanel — the Kidi V–W Correlation Field (core feasibility proof).
 *
 * A continuous feasibility map, not a single-value calculator. Reduced layer:
 * no 5D, negative time, or reverse branch needed.
 *
 * 2D map: X = η = |W|/D,  Y = β = V/c. The boundary curve  β² + η² = 1
 * separates SUBC_TOO_SLOW (β²+η²<1) from SUBC_BEATS_LIGHT (β²+η²>1, β<1, η<1).
 * η=1 is the Kidi Boundary; η>1 is NO_REAL_CORRIDOR. The live (η, β) is plotted.
 *
 * Insight: W ↑ ⇒ required V ↓, and V ↑ ⇒ required W ↓.
 * Local V stays below c — earlier arrival is geometric corridor shortening, not FTL.
 */
import { useRef, useEffect } from 'react';
import { Diagnostics } from '../core/simulation';
import { VWCorrelationClass } from '../core/physics';

interface Props {
  diag: Diagnostics;
  width: number;
  height: number;
  pulse: number;
}

const VW_FIELD_COLOR: Record<VWCorrelationClass, string> = {
  SUBC_BEATS_LIGHT: '#ffd23b',
  EQUAL_TO_LIGHT_BASELINE: '#3fd0ff',
  SUBC_TOO_SLOW: '#6f9bdc',
  KIDI_BOUNDARY: '#ff9d3b',
  NO_REAL_CORRIDOR: '#e23bd0',
  LIGHT_SPEED_LIMIT: '#ffb13b',
  INVALID_INPUT: '#ff6b6b',
};

const VW_FIELD_LABEL: Record<VWCorrelationClass, string> = {
  SUBC_BEATS_LIGHT: 'SUB-C BEATS LIGHT — V<c yet beats light',
  EQUAL_TO_LIGHT_BASELINE: 'EQUAL TO LIGHT BASELINE',
  SUBC_TOO_SLOW: 'TOO SLOW — increase W or V',
  KIDI_BOUNDARY: 'KIDI BOUNDARY — D_eff→0',
  NO_REAL_CORRIDOR: 'NO REAL CORRIDOR — |W|>|dx|',
  LIGHT_SPEED_LIMIT: 'LIGHT-SPEED LIMIT (V≥c)',
  INVALID_INPUT: 'INVALID INPUT',
};

export function VWCorrelationFieldPanel({ diag, width, height, pulse }: Props) {
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

    const vf = diag.vwCorrelation;
    const eta = Number.isFinite(vf.eta) ? vf.eta : 0;
    const beta = Number.isFinite(vf.beta) ? vf.beta : 0;
    const etaMax = Math.max(1.1, eta + 0.2);

    const padL = 48, padT = 26, padB = 42, padR = 18;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const X = (e: number) => padL + (e / etaMax) * plotW;
    const Y = (b: number) => padT + plotH - Math.max(0, Math.min(1.05, b)) * (plotH / 1.05);

    ctx.fillStyle = '#0a0e16';
    ctx.fillRect(0, 0, width, height);

    // region fill by coarse sampling of β² + η²
    const cells = 56;
    const cw = plotW / cells;
    const ch = plotH / cells;
    for (let i = 0; i < cells; i++) {
      for (let k = 0; k < cells; k++) {
        const e = ((i + 0.5) / cells) * etaMax;
        const b = (1 - (k + 0.5) / cells) * 1.05; // β up to ~1.05 (top)
        let color: string | null = null;
        if (e > 1) color = 'rgba(226,59,208,0.13)'; // no real corridor
        else if (b > 1) color = 'rgba(255,177,59,0.10)'; // V≥c light-speed limit band
        else {
          const score = b * b + e * e;
          if (Math.abs(score - 1) < 0.03) color = null; // leave boundary clear
          else if (score > 1) color = 'rgba(255,210,80,0.13)'; // beats light
          else color = 'rgba(90,130,210,0.10)'; // too slow
        }
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(padL + i * cw, padT + k * ch, cw + 1, ch + 1);
        }
      }
    }

    // axes
    ctx.strokeStyle = 'rgba(120,140,170,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(etaMax), Y(0));
    ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(0), Y(1.05));
    ctx.stroke();

    // β = 1 ceiling (sub-c limit)
    ctx.strokeStyle = 'rgba(63,208,255,0.6)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(X(0), Y(1)); ctx.lineTo(X(etaMax), Y(1)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,200,240,0.75)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('β=1 (V=c)', X(etaMax) - 58, Y(1) - 3);

    // boundary curve β² + η² = 1
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= 100; s++) {
      const e = (s / 100) * Math.min(1, etaMax);
      const b = Math.sqrt(Math.max(0, 1 - e * e));
      const x = X(e), y = Y(b);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#dfe7f5';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('β² + η² = 1', X(0.16), Y(Math.sqrt(Math.max(0, 1 - 0.16 * 0.16))) - 6);

    // η = 1 Kidi boundary line
    if (etaMax >= 1) {
      ctx.strokeStyle = 'rgba(255,157,59,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(X(1), Y(0)); ctx.lineTo(X(1), Y(1.05)); ctx.stroke();
      ctx.fillStyle = '#ff9d3b';
      ctx.fillText('η=1 Kidi', X(1) + 3, Y(0.92));
    }

    // region labels
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255,210,80,0.9)';
    ctx.fillText('SUB-C BEATS LIGHT', X(0.12), Y(0.9));
    ctx.fillStyle = 'rgba(140,170,230,0.9)';
    ctx.fillText('too slow', X(0.1), Y(0.18));

    // current point (η, β)
    const color = VW_FIELD_COLOR[vf.className];
    if (vf.className !== 'INVALID_INPUT') {
      const px = X(Math.min(eta, etaMax));
      const py = Y(beta);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(X(0), py); ctx.lineTo(px, py); ctx.moveTo(px, Y(0)); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);
      const r = vf.className === 'KIDI_BOUNDARY' ? 5 + 3 * (0.5 + 0.5 * Math.sin(pulse * 6)) : 5;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#e6eefc';
      ctx.fillText(`η=${eta.toFixed(2)}, β=${beta.toFixed(2)}`, px + 8, py - 8);
    }

    // title + axis labels + field score + status
    ctx.fillStyle = 'rgba(180,200,230,0.85)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Kidi V–W Correlation Field', padL, 16);
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(170,120,255,0.9)';
    ctx.fillText('η = |W|/D', X(etaMax) - 58, Y(0) + 16);
    ctx.save();
    ctx.translate(padL - 34, padT + plotH * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(86,227,159,0.95)';
    ctx.fillText('β = V/c', 0, 0);
    ctx.restore();

    const score = Number.isFinite(vf.fieldScore) ? vf.fieldScore.toFixed(3) : '—';
    const marg = Number.isFinite(vf.margin) ? (vf.margin >= 0 ? `+${vf.margin.toFixed(3)}` : vf.margin.toFixed(3)) : '—';
    ctx.fillStyle = color;
    ctx.font = 'bold 10.5px ui-monospace, monospace';
    ctx.fillText(`β²+η²=${score} (margin ${marg}) · ${VW_FIELD_LABEL[vf.className]}`, padL, height - 8);
  }, [diag, width, height, pulse]);

  return <canvas ref={ref} style={{ width, height, borderRadius: 8 }} />;
}
