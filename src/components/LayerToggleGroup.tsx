/**
 * LayerToggleGroup — focusable checkboxes to show/hide each 3D layer.
 */
import { LayerVisibility } from './Volume3DView';

interface Props {
  visibility: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
}

const LABELS: { key: keyof LayerVisibility; label: string }[] = [
  { key: 'axes', label: 'Axes box' },
  { key: 'grids', label: 'Grid planes' },
  { key: 'worldlines', label: 'Worldlines' },
  { key: 'signal', label: 'Signal + markers' },
  { key: 'loci', label: 'Singular planes α=±x' },
  { key: 'nullSurfaces', label: 'Null surfaces' },
  { key: 'shadows', label: 'Slice shadows' },
  { key: 'history', label: 'History trails' },
];

export function LayerToggleGroup({ visibility, onToggle }: Props) {
  return (
    <fieldset className="layer-toggles">
      <legend>3D layers</legend>
      <div className="layer-grid">
        {LABELS.map((l) => (
          <label key={l.key} className="layer-check">
            <input
              type="checkbox"
              checked={visibility[l.key]}
              onChange={() => onToggle(l.key)}
            />
            {l.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
