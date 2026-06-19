/**
 * export.ts — Event Log JSON export.
 *
 * `buildExport` is a pure function (testable headlessly); `downloadEventLog`
 * performs the browser download via a Blob + object URL, the standard way to
 * save generated text client-side with no backend.
 */

import { SimEvent } from './simulation';
import { SIM_EVENT_SCHEMA, validateSimEvent } from './schemas';

export interface EventLogExport {
  $schema: string;
  generator: string;
  version: string;
  exportedAt: string;
  count: number;
  events: SimEvent[];
}

export const EXPORT_VERSION = '1.1.0';

/** Build the export payload (pure — used by tests and the download path). */
export function buildExport(events: SimEvent[], now: Date = new Date()): EventLogExport {
  return {
    $schema: SIM_EVENT_SCHEMA.$id,
    generator: 'TimeParadoxLab',
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    count: events.length,
    events,
  };
}

/** Validate every event in an export. Returns { valid, errors }. */
export function validateExport(data: EventLogExport): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  data.events.forEach((e, i) => {
    for (const err of validateSimEvent(e)) errors.push(`events[${i}].${err}`);
  });
  return { valid: errors.length === 0, errors };
}

export function serializeExport(events: SimEvent[]): string {
  return JSON.stringify(buildExport(events), null, 2);
}

/**
 * Trigger a client-side download of the event log as JSON. Returns the filename.
 * Guards against non-browser environments so it can be imported anywhere.
 */
export function downloadEventLog(events: SimEvent[], filename?: string): string {
  const name = filename ?? `timeparadoxlab-events-${Date.now()}.json`;
  const text = serializeExport(events);
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return name; // headless: nothing to download, but serialization already succeeded
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return name;
}
