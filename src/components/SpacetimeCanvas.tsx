/**
 * SpacetimeCanvas — main viewport. x (horizontal) vs t (vertical).
 * Draws Bob/Alice worldlines, the light cone from the send event, the signal
 * path (forward or reverse), and an animated marker. Reverse arrivals are
 * flagged in red; a Bottom contradiction shows ⊥.
 *
 * Uses a canvas ref + useEffect for synchronization with drawing (WO rendering
 * requirements). Re-draws whenever diagnostics or animation progress change.
 */
import { useRef, useEffect } from 'react';
import { Diagnostics } from '../core/simulation';

interface Props {
  diag: Diagnostics;
  /** animation progress 0..1 */
  progress: number;
  width: number;
  height: number;
  /** optional cross-panel highlight at world point [x, t, alpha] */
  highlight?: [number, number, number] | null;
  /** show the ordinary α=0 light-speed reference baseline (default true) */
  showLightBaseline?: boolean;
  /** show the gold sub-c corridor arrival path when feasible (default true) */
  showSubCPath?: boolean;
}

export function SpacetimeCanvas({ diag, progress, width, height, highlight, showLightBaseline = true, showSubCPath = true }: Props) {
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

    const { scenario, signal, arrival, reverse, contradiction } = diag;

    // world ranges
    const xMin = Math.min(scenario.xBob, scenario.xAlice) - 1.5;
    const xMax = Math.max(scenario.xBob, scenario.xAlice) + 1.5;
    const tMin = -1;
    const tMax = Math.max(scenario.tSend + 6, 9);

    const pad = 42;
    const W = width - pad * 1.4;
    const H = height - pad * 1.4;
    const X = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * W;
    // t increases upward
    const Y = (t: number) => pad * 0.4 + H - ((t - tMin) / (tMax - tMin)) * H;

    // background
    ctx.fillStyle = '#0a0e16';
    ctx.fillRect(0, 0, width, height);

    // grid
    ctx.strokeStyle = 'rgba(120,140,170,0.10)';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(150,170,200,0.55)';
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      ctx.beginPath();
      ctx.moveTo(X(x), Y(tMin));
      ctx.lineTo(X(x), Y(tMax));
      ctx.stroke();
      ctx.fillText(`x=${x}`, X(x) + 2, Y(tMin) - 4);
    }
    for (let t = Math.ceil(tMin); t <= Math.floor(tMax); t++) {
      ctx.beginPath();
      ctx.moveTo(X(xMin), Y(t));
      ctx.lineTo(X(xMax), Y(t));
      ctx.stroke();
      ctx.fillText(`t=${t}`, X(xMin) + 2, Y(t) - 2);
    }

    // light cone from send event (forward + past), t = tSend ± (x - xBob)/c
    const sx = scenario.xBob;
    const st = scenario.tSend;
    ctx.fillStyle = 'rgba(80,160,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(X(sx), Y(st));
    ctx.lineTo(X(xMax), Y(st + (xMax - sx) / scenario.c));
    ctx.lineTo(X(xMin), Y(st + (sx - xMin) / scenario.c));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,160,255,0.35)';
    ctx.setLineDash([4, 4]);
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(X(sx), Y(st));
      ctx.lineTo(X(xMax), Y(st + (s * (xMax - sx)) / scenario.c));
      ctx.moveTo(X(sx), Y(st));
      ctx.lineTo(X(xMin), Y(st + (s * (xMin - sx)) / scenario.c));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // worldlines
    const drawWorldline = (x: number, color: string, label: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(x), Y(tMin));
      ctx.lineTo(X(x), Y(tMax));
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(label, X(x) - 12, Y(tMax) - 6);
    };
    drawWorldline(scenario.xBob, '#3fd0ff', 'Bob');
    drawWorldline(scenario.xAlice, '#ff61dc', 'Alice');

    // arrival time (numeric) for drawing
    const arriveT =
      arrival.kind === 'Real' ? arrival.value
      : arrival.kind === 'Singular' ? arrival.coeff
      : st;

    // --- Light-Speed Reference Baseline: ordinary α=0 ray (a fixed comparison ruler) ---
    const lb = diag.lightBaseline;
    const lbArrive = lb.tLightArrival.kind === 'Real' ? lb.tLightArrival.value : null;
    if (showLightBaseline && lbArrive !== null) {
      ctx.strokeStyle = 'rgba(63,208,255,0.85)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(X(scenario.xBob), Y(st));
      ctx.lineTo(X(scenario.xAlice), Y(lbArrive));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(120,210,255,0.95)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('Light baseline α=0, β=1', X(scenario.xAlice) - 4, Y(lbArrive) - 6);
    }

    // Sub-c corridor arrival path (gold) — local V<c that still beats light
    const sc = diag.vwCorrelation;
    if (showSubCPath && sc.className === 'SUBC_BEATS_LIGHT' && sc.tSubCArrival.kind === 'Real') {
      ctx.strokeStyle = 'rgba(255,205,60,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(scenario.xBob), Y(st));
      ctx.lineTo(X(scenario.xAlice), Y(sc.tSubCArrival.value));
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,120,0.95)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`sub-c corridor (v=${sc.beta.toFixed(2)}c)`, X(scenario.xAlice) - 4, Y(sc.tSubCArrival.value) + 14);
    }

    // signal path — coloured by projection class / escalation state
    const proj = diag.projection.className;
    const noReal = arrival.kind !== 'Real'; // W-domain / kidi: no honest real arrival
    const pathColor = contradiction
      ? '#ff3b3b'
      : reverse
      ? '#ff7a3b'
      : signal.domain === 'SINGULAR_BOUNDARY'
      ? '#ffd23b'
      : proj === 'PROJECTED_SUPERLUMINAL'
      ? '#b06bff'
      : '#56e39f';
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 2.5;
    if (noReal && !reverse) {
      // W_DOMAIN_NO_REAL_DT / boundary: do not imply a real arrival — dashed + blocked
      ctx.setLineDash([4, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(X(scenario.xBob), Y(st));
    ctx.lineTo(X(scenario.xAlice), Y(arriveT));
    ctx.stroke();
    ctx.setLineDash([]);

    // send event
    const dot = (x: number, t: number, color: string, r = 5) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(x), Y(t), r, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(scenario.xBob, st, '#3fd0ff', 5);
    ctx.fillStyle = '#cfe';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('SEND', X(scenario.xBob) + 8, Y(st) + 4);

    // animated marker along path
    const mp = Math.max(0, Math.min(1, progress));
    const mx = scenario.xBob + mp * (scenario.xAlice - scenario.xBob);
    const mt = st + mp * (arriveT - st);
    dot(mx, mt, '#ffffff', 4);

    // arrival event
    dot(scenario.xAlice, arriveT, pathColor, 6);
    if (contradiction) {
      ctx.fillStyle = '#ff3b3b';
      ctx.font = 'bold 14px ui-monospace, monospace';
      ctx.fillText('⊥ CONTRADICTION', X(scenario.xAlice) - 30, Y(arriveT) - 10);
    } else if (reverse) {
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(scenario.xAlice), Y(arriveT), 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff7a3b';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText('REVERSE ↓', X(scenario.xAlice) + 10, Y(arriveT) + 4);
    } else if (noReal) {
      ctx.strokeStyle = '#e23bd0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(scenario.xAlice), Y(arriveT), 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e6a3df';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('no real dt', X(scenario.xAlice) + 10, Y(arriveT) + 4);
    } else {
      ctx.fillStyle = '#cfe';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('RECEIVE', X(scenario.xAlice) + 10, Y(arriveT) + 4);
    }

    // cross-panel highlight ring
    if (highlight && Number.isFinite(highlight[0]) && Number.isFinite(highlight[1])) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(highlight[0]), Y(highlight[1]), 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    // title + gain-vs-light readout
    ctx.fillStyle = 'rgba(180,200,230,0.85)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Spacetime (x, t)  —  light cone dashed', pad, 16);
    if (lbArrive !== null) {
      let gainText: string;
      if (arrival.kind === 'Real') {
        const gain = lbArrive - arrival.value;
        gainText =
          Math.abs(gain) < 1e-9 ? 'matches light baseline'
          : gain > 0 ? `arrives ${gain.toFixed(3)} before light baseline`
          : `arrives ${Math.abs(gain).toFixed(3)} after light baseline`;
      } else {
        gainText = 'current arrival is typed kidi/non-real';
      }
      ctx.fillStyle = 'rgba(120,210,255,0.9)';
      ctx.font = '10px ui-monospace, monospace';
      const lbStr = Number.isInteger(lbArrive) ? String(lbArrive) : lbArrive.toFixed(3);
      ctx.fillText(`vs light (t=${lbStr}): ${gainText}`, pad, 29);
    }
  }, [diag, progress, width, height, highlight, showLightBaseline, showSubCPath]);

  return <canvas ref={ref} style={{ width, height, borderRadius: 8 }} />;
}
