/**
 * schemas.ts — JSON Schemas (Draft 2020-12) for the exported research data, plus
 * a tiny dependency-free validator used by export validation and self-tests.
 *
 * We do NOT pull in a JSON-Schema library (keeps the offline standalone free of
 * extra vendored deps). The validators below check exactly the constraints the
 * schemas declare for our value/event shapes.
 */

import { SingularValue, Branch } from './singular';
import { EventType, EventLevel } from './simulation';

// --- the schemas as data (also embedded into exports for provenance) --------

export const REAL_VALUE_SCHEMA = {
  $id: 'https://timeparadoxlab.local/schemas/real-value.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'RealValue',
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'value'],
  properties: { kind: { const: 'Real' }, value: { type: 'number' } },
} as const;

export const SINGULAR_VALUE_SCHEMA = {
  $id: 'https://timeparadoxlab.local/schemas/singular-value.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SingularValueTagged',
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'coeff', 'order', 'branch', 'reason'],
  properties: {
    kind: { const: 'Singular' },
    coeff: { type: 'number' },
    order: { type: 'number', exclusiveMinimum: 0 },
    branch: { type: 'string', enum: ['plain', '+', '-', 'loop', 'feedback', 'mixed'] },
    reason: { type: 'string', minLength: 1 },
  },
} as const;

export const BOTTOM_VALUE_SCHEMA = {
  $id: 'https://timeparadoxlab.local/schemas/bottom-value.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'BottomValue',
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'reason'],
  properties: { kind: { const: 'Bottom' }, reason: { type: 'string', minLength: 1 } },
} as const;

export const TYPED_VALUE_SCHEMA = {
  $id: 'https://timeparadoxlab.local/schemas/typed-value.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'TypedValue',
  oneOf: [
    { $ref: 'real-value.schema.json' },
    { $ref: 'singular-value.schema.json' },
    { $ref: 'bottom-value.schema.json' },
  ],
} as const;

export const SIM_EVENT_SCHEMA = {
  $id: 'https://timeparadoxlab.local/schemas/sim-event.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SimEvent',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'seq', 'type', 'level', 'phaseId', 'scenario', 'typedState', 'message', 'timestamp'],
  properties: {
    id: { type: 'string' },
    seq: { type: 'integer', minimum: 0 },
    type: {
      type: 'string',
      enum: ['PHASE_CHANGE', 'SEND', 'LIGHT_BASELINE', 'BOUNDARY_TOUCH', 'REVERSE_ARRIVAL', 'FEEDBACK_CONTRADICTION', 'RECEIVE', 'EXPORT'],
    },
    level: { type: 'string', enum: ['info', 'warn', 'singular', 'bottom'] },
    phaseId: { type: 'string' },
    message: { type: 'string' },
    timestamp: { type: 'number' },
    scenario: {
      type: 'object',
      additionalProperties: false,
      required: ['xBob', 'xAlice', 'tSend', 'c', 'eps', 'alpha', 'branch', 'closeLoop'],
      properties: {
        xBob: { type: 'number' },
        xAlice: { type: 'number' },
        tSend: { type: 'number' },
        c: { type: 'number', exclusiveMinimum: 0 },
        eps: { type: 'number', exclusiveMinimum: 0 },
        alpha: { type: 'number' },
        branch: { type: 'string' },
        closeLoop: { type: 'boolean' },
      },
    },
    typedState: { $ref: 'typed-value.schema.json' },
    arrival: { $ref: 'typed-value.schema.json' },
    payload: { type: 'object' },
  },
} as const;

// --- validators -------------------------------------------------------------

const BRANCHES: Branch[] = ['plain', '+', '-', 'loop', 'feedback', 'mixed'];
const EVENT_TYPES: EventType[] = [
  'PHASE_CHANGE', 'SEND', 'LIGHT_BASELINE', 'BOUNDARY_TOUCH', 'REVERSE_ARRIVAL', 'FEEDBACK_CONTRADICTION', 'RECEIVE', 'EXPORT',
];
const LEVELS: EventLevel[] = ['info', 'warn', 'singular', 'bottom'];

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';

/** Validate a TypedValue (Real | Singular | Bottom). Returns a list of errors. */
export function validateTypedValue(v: unknown, path = 'typedState'): string[] {
  const errs: string[] = [];
  if (typeof v !== 'object' || v === null) return [`${path}: not an object`];
  const o = v as Record<string, unknown>;
  switch (o.kind) {
    case 'Real':
      if (!isNum(o.value)) errs.push(`${path}.value: expected number`);
      break;
    case 'Singular':
      if (!isNum(o.coeff)) errs.push(`${path}.coeff: expected number`);
      if (!isNum(o.order) || (o.order as number) <= 0) errs.push(`${path}.order: expected number > 0`);
      if (!isStr(o.branch) || !BRANCHES.includes(o.branch as Branch)) errs.push(`${path}.branch: invalid`);
      if (!isStr(o.reason) || (o.reason as string).length < 1) errs.push(`${path}.reason: expected non-empty string`);
      break;
    case 'Bottom':
      if (!isStr(o.reason) || (o.reason as string).length < 1) errs.push(`${path}.reason: expected non-empty string`);
      break;
    default:
      errs.push(`${path}.kind: must be Real | Singular | Bottom`);
  }
  return errs;
}

/** Validate a SimEvent against sim-event.schema.json. Returns a list of errors. */
export function validateSimEvent(e: unknown): string[] {
  const errs: string[] = [];
  if (typeof e !== 'object' || e === null) return ['event: not an object'];
  const o = e as Record<string, unknown>;

  if (!isStr(o.id)) errs.push('id: expected string');
  if (typeof o.seq !== 'number' || !Number.isInteger(o.seq) || (o.seq as number) < 0) errs.push('seq: expected integer ≥ 0');
  if (!isStr(o.type) || !EVENT_TYPES.includes(o.type as EventType)) errs.push('type: invalid enum');
  if (!isStr(o.level) || !LEVELS.includes(o.level as EventLevel)) errs.push('level: invalid enum');
  if (!isStr(o.phaseId)) errs.push('phaseId: expected string');
  if (!isStr(o.message)) errs.push('message: expected string');
  if (!isNum(o.timestamp)) errs.push('timestamp: expected number');

  const s = o.scenario as Record<string, unknown> | undefined;
  if (typeof s !== 'object' || s === null) {
    errs.push('scenario: expected object');
  } else {
    for (const k of ['xBob', 'xAlice', 'tSend', 'alpha'] as const) {
      if (!isNum(s[k])) errs.push(`scenario.${k}: expected number`);
    }
    if (!isNum(s.c) || (s.c as number) <= 0) errs.push('scenario.c: expected number > 0');
    if (!isNum(s.eps) || (s.eps as number) <= 0) errs.push('scenario.eps: expected number > 0');
    if (!isStr(s.branch)) errs.push('scenario.branch: expected string');
    if (typeof s.closeLoop !== 'boolean') errs.push('scenario.closeLoop: expected boolean');
  }

  errs.push(...validateTypedValue(o.typedState, 'typedState'));
  if (o.arrival !== undefined) errs.push(...validateTypedValue(o.arrival, 'arrival'));

  return errs;
}

export function isValidSimEvent(e: SimEventLike): boolean {
  return validateSimEvent(e).length === 0;
}

/** structural alias to avoid importing the concrete SimEvent type here */
export type SimEventLike = {
  id: string;
  seq: number;
  type: string;
  level: string;
  phaseId: string;
  message: string;
  timestamp: number;
  scenario: Record<string, unknown>;
  typedState: SingularValue;
  arrival?: SingularValue;
  payload?: Record<string, unknown>;
};
