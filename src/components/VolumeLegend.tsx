/**
 * VolumeLegend — explains the 3D visual language in text + swatches. No meaning
 * is conveyed by colour alone (each row has a label).
 */
const ROWS: { color: string; label: string; note: string }[] = [
  { color: '#3fd0ff', label: 'Real (λ=0)', note: 'ordinary propagation / Bob worldline' },
  { color: '#ffd23b', label: 'Singular λ=½', note: 'boundary touch — pulses' },
  { color: '#ff7a3b', label: 'Singular λ=1', note: 'reverse arrival — dashed' },
  { color: '#e23bd0', label: 'Singular λ>1', note: 'higher order — glow' },
  { color: '#ff3b3b', label: 'Bottom (⊥)', note: 'feedback contradiction' },
  { color: '#ff4646', label: 'Singular planes α = ±x', note: 'split-complex null loci' },
  { color: '#4aa3ff', label: 'Null surfaces', note: 'signal cone from the send event' },
  { color: '#ff61dc', label: 'Alice worldline', note: 'receiver line in t' },
];

export function VolumeLegend() {
  return (
    <div className="volume-legend" aria-label="3D legend">
      {ROWS.map((r) => (
        <div className="legend-row" key={r.label}>
          <span className="legend-swatch" style={{ background: r.color }} aria-hidden="true" />
          <span className="legend-label">{r.label}</span>
          <span className="legend-note">{r.note}</span>
        </div>
      ))}
    </div>
  );
}
