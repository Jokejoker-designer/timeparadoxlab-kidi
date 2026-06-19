/**
 * HelpOverlay — keyboard shortcut + interaction reference (opened with '?').
 */
interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / Pause timeline'],
  ['R', 'Reset simulation'],
  ['1 – 5', 'Jump to preset phase'],
  ['E', 'Export Event Log JSON'],
  ['C', 'Reset / cycle camera preset'],
  ['L', 'Toggle history trails'],
  ['?', 'Open / close this help'],
  ['Drag', 'Orbit 3D camera'],
  ['Shift/Right-drag', 'Pan 3D camera'],
  ['Wheel', 'Zoom 3D camera'],
  ['Click marker', 'Select corresponding event'],
];

export function HelpOverlay({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Keyboard help" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <h3>Keyboard &amp; interaction</h3>
          <button onClick={onClose} aria-label="Close help">✕</button>
        </div>
        <table>
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="help-note">
          The α-axis is a modeling coordinate for singular structure; +dα² is a speculative
          two-time signature, not standard special relativity. This is a research visualisation.
        </p>
      </div>
    </div>
  );
}
