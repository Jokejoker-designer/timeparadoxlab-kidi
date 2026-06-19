/**
 * EventLog — append-only, exportable record of simulation events. Rows are
 * clickable (cross-panel selection); Singular/Bottom events are colour-coded so
 * contradictions stay visible as data. Includes the Export Event Log JSON action.
 */
import { useEffect, useRef } from 'react';
import { SimEvent, EventLevel, EventType, arrivalText } from '../core/simulation';
import { format } from '../core/singular';

interface Props {
  events: SimEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onExport: () => void;
}

const levelColor: Record<EventLevel, string> = {
  info: '#9fb6d6',
  warn: '#ff7a3b',
  singular: '#ffd23b',
  bottom: '#ff6b6b',
};

const typeIcon: Record<EventType, string> = {
  SEND: '→',
  PHASE_CHANGE: '◆',
  LIGHT_BASELINE: '☀',
  BOUNDARY_TOUCH: '◈',
  REVERSE_ARRIVAL: '↺',
  FEEDBACK_CONTRADICTION: '⊥',
  RECEIVE: '✓',
  EXPORT: '⤓',
};

export function EventLog({ events, selectedEventId, onSelectEvent, onExport }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="panel eventlog">
      <div className="panel-head">
        <h3>Event log</h3>
        <button className="export-btn" onClick={onExport} disabled={events.length === 0} title="Export Event Log as JSON (E)">
          ⤓ Export JSON
        </button>
      </div>
      <div className="event-scroll" role="log" aria-label="Simulation events">
        {events.length === 0 && <div className="event-empty">No events yet — pick a phase and Play.</div>}
        {events.map((e) => (
          <div
            key={e.id}
            className={`event-row${e.id === selectedEventId ? ' selected' : ''}`}
            style={{ borderLeftColor: levelColor[e.level] }}
            onClick={() => onSelectEvent(e.id === selectedEventId ? null : e.id)}
            tabIndex={0}
            role="button"
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onSelectEvent(e.id === selectedEventId ? null : e.id);
              }
            }}
            title={`${e.id} · typedState ${format(e.typedState)}`}
          >
            <span className="event-icon" style={{ color: levelColor[e.level] }}>{typeIcon[e.type]}</span>
            <span className="event-type" style={{ color: levelColor[e.level] }}>{e.type}</span>
            <span className="event-at">{e.arrival ? arrivalText(e.arrival) : `t=${e.scenario.tSend}`}</span>
            <span className="event-msg">{e.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
