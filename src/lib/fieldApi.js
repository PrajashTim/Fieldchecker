import snapshot from '../data/mockState.json' with { type: 'json' };
import {
  DEFAULT_PICKUP_MINUTES,
  formatClock,
  overlapsPickupWindow,
  overlappingEvents,
  parseStartMinutes,
  pickBestField,
} from './pickup.js';

const PERMIT =
  'Could not verify county or school permits, private/member practice schedules, or walk-on use.';

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60');
}

export function parsePickupMinutes(query = {}) {
  if (query.pickupMinutes != null && query.pickupMinutes !== '') {
    const minutes = Number(query.pickupMinutes);
    if (Number.isFinite(minutes)) return minutes;
  }
  const raw = String(query.time || '').trim();
  if (!raw) return DEFAULT_PICKUP_MINUTES;
  if (/^\d{1,4}$/.test(raw)) {
    const n = Number(raw);
    if (n <= 24 * 60) return n;
    if (raw.length === 4) return Number(raw.slice(0, 2)) * 60 + Number(raw.slice(2));
  }
  const military = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (military) return Number(military[1]) * 60 + Number(military[2]);
  const clock = parseStartMinutes(raw.replace(/([ap]m)/i, ' $1'));
  return clock ?? DEFAULT_PICKUP_MINUTES;
}

function availableDates() {
  return Object.keys(snapshot.schedule || {}).sort();
}

function resolveDate(query = {}) {
  const dates = availableDates();
  const today = new Date().toLocaleDateString('en-CA');
  if (query.date) return query.date;
  return dates.includes(today) ? today : dates[0];
}

function slimEvent(event) {
  return {
    time: event.time,
    title: event.title,
    source: event.source || null,
    sourceUrl: event.sourceUrl || null,
    precision: event.precision || null,
    status: event.status || 'scheduled',
    eventId: event.eventId || null,
  };
}

function slimField(field, pickupMinutes) {
  const overlapsPickup = overlapsPickupWindow(field.events, pickupMinutes);
  return {
    id: field.id,
    name: field.name,
    subfield: field.subfield || null,
    type: field.type,
    location: field.location,
    overlapsPickup,
    status: overlapsPickup ? 'conflict' : 'no_conflict',
    events: (field.events || []).map(slimEvent),
    overlappingEvents: overlappingEvents(field.events, pickupMinutes).map(slimEvent),
  };
}

function withoutHttpStatus(payload) {
  const { httpStatus, ...body } = payload;
  return { status: httpStatus || 200, body };
}

export function apiIndex() {
  return {
    name: 'NoVA Field Check API',
    disclaimer: PERMIT,
    lastUpdated: snapshot.lastUpdated,
    coverageStart: snapshot.coverageStart,
    coverageEnd: snapshot.coverageEnd,
    occupancy:
      'Per-field status is no_conflict or conflict. no_conflict means no overlap was found in connected public schedules; it is not a reservation or proof the field is free.',
    endpoints: {
      status: '/api',
      sourceHealth: '/api/status',
      fields: '/api/fields',
      schedule: '/api/schedule?date=YYYY-MM-DD&time=6:30PM',
      fieldDay: '/api/schedule?date=YYYY-MM-DD&field=poplar-tree-2',
    },
    time: 'Accepts 6:30PM, 18:30, or pickupMinutes=1110. Default is 6:30 PM.',
    turfOnly: 'Pass turfOnly=1 to hide grass fields. Default is all catalog fields.',
  };
}

export function apiStatus() {
  return {
    lastUpdated: snapshot.lastUpdated,
    coverageStart: snapshot.coverageStart,
    coverageEnd: snapshot.coverageEnd,
    disclaimer: PERMIT,
    sourceHealth: snapshot.sourceHealth || {},
  };
}

export function apiFields() {
  const date = resolveDate({});
  const rows = snapshot.schedule[date] || [];
  return {
    lastUpdated: snapshot.lastUpdated,
    disclaimer: PERMIT,
    fields: rows.map(field => ({
      id: field.id,
      name: field.name,
      subfield: field.subfield || null,
      type: field.type,
      location: field.location,
    })),
  };
}

export function apiSchedule(query = {}) {
  const dates = availableDates();
  if (query.date && !snapshot.schedule[query.date]) {
    return {
      httpStatus: 400,
      error: 'invalid_date',
      message: `No snapshot for date ${query.date}`,
      dates,
    };
  }
  const date = resolveDate(query);
  const pickupMinutes = parsePickupMinutes(query);
  const turfOnly = query.turfOnly === '1' || query.turfOnly === 'true';
  const dayRows = snapshot.schedule[date] || [];
  if (query.field && !dayRows.some(field => field.id === query.field)) {
    return {
      httpStatus: 404,
      error: 'unknown_field',
      message: `Unknown field id ${query.field}`,
    };
  }
  let rows = dayRows;
  if (query.field) {
    rows = dayRows.filter(field => field.id === query.field);
  } else if (turfOnly) {
    rows = dayRows.filter(field => String(field.type).toLowerCase() === 'turf');
  }
  const mapped = rows.map(field => slimField(field, pickupMinutes));
  const clear = mapped.filter(field => !field.overlapsPickup);
  const recommendation = pickBestField(clear);
  return {
    lastUpdated: snapshot.lastUpdated,
    date,
    pickupMinutes,
    pickupLabel: formatClock(pickupMinutes),
    turfOnly,
    disclaimer: PERMIT,
    recommendation: recommendation
      ? { id: recommendation.id, name: recommendation.name, subfield: recommendation.subfield }
      : null,
    fields: mapped,
  };
}

export function handleApi(url, send) {
  const parsed = new URL(url, 'http://localhost');
  const path = parsed.pathname.replace(/\/$/, '') || '/';
  const query = Object.fromEntries(parsed.searchParams.entries());
  const reply = (payload) => {
    const { status, body } = withoutHttpStatus(payload);
    return send(status, body);
  };
  if (path === '/api' || path === '/api/') return send(200, apiIndex());
  if (path === '/api/status') return send(200, apiStatus());
  if (path === '/api/fields') return send(200, apiFields());
  if (path === '/api/schedule') return reply(apiSchedule(query));
  return send(404, { error: 'Not found', endpoints: ['/api', '/api/status', '/api/fields', '/api/schedule'] });
}

export function asVercelHandler(build) {
  return function handler(req, res) {
    cors(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const payload = build(req.query || {});
      const { status, body } = withoutHttpStatus(payload && payload.httpStatus ? payload : { httpStatus: 200, ...payload });
      res.status(status).json(body);
    } catch (error) {
      res.status(500).json({ error: error.message || 'API error' });
    }
  };
}
