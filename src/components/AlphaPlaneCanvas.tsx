/**
 * AlphaPlaneCanvas — auxiliary viewport for the split-complex geometry.
 * Axes: x (horizontal, cyan) vs α (vertical, violet). Draws the two null lines
 * α = ±x (red), shades the wedge x²−α²>0 (teal, REAL) and x²−α²<0 (magenta,
 * ALPHA), and plots the signal trajectory (0,0)→(Δx, α) with an animated marker.
 *
 * Colour encoding follows the critique (p.13): hue ↔ sign(Δ_split), the marker
 * pulses on the SINGULAR_BOUNDARY.
 */
import { useRef, useEffect } from 'react';
import { Diagnostics } from '../core/simulation';

interface Props {
  diag: Diagnostics;
  progress: number;
  /** wall-clock phase for the pulse animation */
  pulse: number;
  width: number;
  height: number;
  /** optional cross-panel highlight at world point [x, t, alpha] */
  highlight?: [number, number, number] | null;
}

export function AlphaPlaneCanvas({ diag, progress, pulse, width, height, highlight }: Props) {
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

    const dx = diag.signal.dx;
    const aMax = Math.max(8, Math.abs(diag.phase.alpha) + 2, Math.abs(dx) + 2);
    const xMin = -1.5;
    const xMax = Math.max(dx + 2, aMax);
    const aMin = -aMax;
    const aHi = aMax;

    const pad = 38;
    const W = width - pad * 1.4;
    const H = height - pad * 1.4;
    const X = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * W;
    const A = (a: number) => pad * 0.4 + H - ((a - aMin) / (aHi - aMin)) * H;

    // background
    ctx.fillStyle = '#0a0e16';
    ctx.fillRect(0, 0, width, height);

    // shade regions by sampling sign(x²−α²) — coarse grid of translucent cells
    const cells = 60;
    const cw = W / cells;
    const ch = H / cells;
    for (let i = 0; i < cells; i++) {
      for (let k = 0; k < cells; k++) {
        const x = xMin + ((i + 0.5) / cells) * (xMax - xMin);
        const a = aMin + ((k + 0.5) / cells) * (aHi - aMin);
        const d = x * x - a * a;
        if (Math.abs(d) < 0.25) continue; // leave boundary clear
        ctx.fillStyle = d > 0 ? 'rgba(40,180,150,0.10)' : 'rgba(200,60,170,0.10)';
        ctx.fillRect(pad + i * cw, pad * 0.4 + k * ch, cw + 1, ch + 1);
      }
    }

    // axes
    ctx.strokeStyle = 'rgba(63,208,255,0.55)'; // x-axis cyan
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(xMin), A(0));
    ctx.lineTo(X(xMax), A(0));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(170,120,255,0.55)'; // α-axis violet
    ctx.beginPath();
    ctx.moveTo(X(0), A(aMin));
    ctx.lineTo(X(0), A(aHi));
    ctx.stroke();

    // null lines α = ±x (red)
    ctx.strokeStyle = 'rgba(255,70,70,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(X(xMin), A(xMin));
    ctx.lineTo(X(xMax), A(xMax));
    ctx.moveTo(X(xMin), A(-xMin));
    ctx.lineTo(X(xMax), A(-xMax));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,120,120,0.9)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('α = x', X(xMax) - 40, A(xMax) + 14);
    ctx.fillText('α = −x', X(xMax) - 44, A(-xMax) - 6);

    // signal trajectory (0,0) → (dx, alpha)
    const alpha = diag.phase.alpha;
    ctx.strokeStyle = 'rgba(220,230,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), A(0));
    ctx.lineTo(X(dx), A(alpha));
    ctx.stroke();

    // endpoint P = (dx, alpha), coloured by domain
    const domColor =
      diag.splitDomain === 'REAL_DOMAIN' ? '#56e39f'
      : diag.splitDomain === 'SINGULAR_BOUNDARY' ? '#ffd23b'
      : '#e23bd0';
    ctx.fillStyle = domColor;
    ctx.beginPath();
    ctx.arc(X(dx), A(alpha), 5, 0, Math.PI * 2);
    ctx.fill();

    // animated marker along trajectory, pulses on boundary
    const mp = Math.max(0, Math.min(1, progress));
    const mx = mp * dx;
    const ma = mp * alpha;
    const onBoundary = diag.splitDomain === 'SINGULAR_BOUNDARY';
    const pr = onBoundary ? 5 + 3 * (0.5 + 0.5 * Math.sin(pulse * 6)) : 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(X(mx), A(ma), pr, 0, Math.PI * 2);
    ctx.fill();
    if (onBoundary) {
      ctx.strokeStyle = '#ffd23b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(dx), A(alpha), 10 + 4 * (0.5 + 0.5 * Math.sin(pulse * 6)), 0, Math.PI * 2);
      ctx.stroke();
    }

    // cross-panel highlight ring at (x, alpha)
    if (highlight && Number.isFinite(highlight[0]) && Number.isFinite(highlight[2])) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(highlight[0]), A(highlight[2]), 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    // labels
    ctx.fillStyle = 'rgba(180,200,230,0.85)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Split plane (x, α)  z = x + jα,  j²=1', pad, 16);
    ctx.fillStyle = domColor;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(
      `Δ_split = x²−α² = ${diag.deltaSplit.toFixed(2)}  [${diag.splitDomain}]`,
      X(dx) + 8,
      A(alpha) - 6,
    );
    // teal/magenta legend
    ctx.fillStyle = 'rgba(86,227,159,0.9)';
    ctx.fillText('teal: x²−α²>0 (Real)', pad, height - 22);
    ctx.fillStyle = 'rgba(226,59,208,0.9)';
    ctx.fillText('magenta: x²−α²<0 (Alpha)', pad, height - 8);
  }, [diag, progress, pulse, width, height, highlight]);

  return <canvas ref={ref} style={{ width, height, borderRadius: 8 }} />;
}
