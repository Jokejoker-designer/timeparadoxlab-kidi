/**
 * HoverInspector — a live, screen-reader-friendly text region that describes the
 * hovered 3D geometry and the current typed state in plain language. This is the
 * non-pointer / accessibility fallback for the 3D scene.
 */
import { Diagnostics, arrivalText, SimEvent } from '../core/simulation';
import { format } from '../core/singular';
import { stateLabel } from '../core/colorRules';

interface Props {
  diag: Diagnostics;
  hoverText: string | null;
  selectedEvent: SimEvent | null;
}

export function HoverInspector({ diag, hoverText, selectedEvent }: Props) {
  const summary =
    `Phase ${diag.phase.name}. Split domain ${diag.splitDomain}. ` +
    `Signal interval dx²−dα² = ${diag.signal.underRoot.toFixed(2)}. ` +
    `Arrival ${arrivalText(diag.arrival)} (${stateLabel(diag.arrival)}). ` +
    (diag.reverse ? 'This is a reverse-time arrival. ' : '') +
    (diag.contradiction ? `Feedback contradiction: ${format(diag.contradiction)}.` : '');

  return (
    <div className="hover-inspector">
      <div className="hover-line" aria-live="polite">
        <span className="hover-label">hover:</span> {hoverText ?? '—'}
      </div>
      {selectedEvent && (
        <div className="hover-line selected">
          <span className="hover-label">selected:</span> {selectedEvent.type} · {selectedEvent.message}
        </div>
      )}
      <div className="sr-summary" aria-live="polite">{summary}</div>
    </div>
  );
}
