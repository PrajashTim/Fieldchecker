import snapshot from '../data/mockState.json';
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
  const requested = query.date;
  if (requested && snapshot.schedule[requested]) return requested;
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
    status: overlapsPickup ? 'conflict' : 'open',
    events: (field.events || []).map(slimEvent),
    overlappingEvents: overlappingEvents(field.events, pickupMinutes).map(slimEvent),
  };
}

export function apiIndex() {
  return {
    name: 'NoVA Field Check API',
    disclaimer: PERMIT,
    lastUpdated: snapshot.lastUpdated,
    coverageStart: snapshot.coverageStart,
    coverageEnd: snapshot.coverageEnd,
    endpoints: {
      status: '/api',
      fields: '/api/fields',
      schedule: '/api/schedule?date=YYYY-MM-DD&time=6:30PM',
      fieldDay: '/api/schedule?date=YYYY-MM-DD&field=poplar-tree-2',
    },
    time: 'Accepts 6:30PM, 18:30, or pickupMinutes=1110. Default is 6:30 PM.',
  };
}

export function apiFields() {
  const date = resolveDate({});
  const rows = snapshot.schedule[date] || [];
  return {
    lastUpdated: snapshot.lastUpdated,
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
  const date = resolveDate(query);
  const pickupMinutes = parsePickupMinutes(query);
  const turfOnly = query.turfOnly !== '0' && query.turfOnly !== 'false';
  let rows = snapshot.schedule[date] || [];
  if (turfOnly) rows = rows.filter(field => String(field.type).toLowerCase() === 'turf');
  if (query.field) rows = rows.filter(field => field.id === query.field);
  const mapped = rows.map(field => slimField(field, pickupMinutes));
  const open = mapped.filter(field => !field.overlapsPickup);
  const recommendation = pickBestField(open);
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
  if (path === '/api' || path === '/api/') return send(200, apiIndex());
  if (path === '/api/fields') return send(200, apiFields());
  if (path === '/api/schedule') return send(200, apiSchedule(query));
  return send(404, { error: 'Not found', endpoints: ['/api', '/api/fields', '/api/schedule'] });
}
