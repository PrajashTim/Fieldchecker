import fieldsConfig from '../../scraper/fieldsConfig.json' with { type: 'json' };

export const PICKUP_DURATION_MINUTES = 120;
export const EVENT_DURATION_MINUTES = 150;
export const EVENT_SETUP_BUFFER_MINUTES = 30;
export const DEFAULT_PICKUP_MINUTES = 18 * 60 + 30;
export const MORNING_PICKUP_MINUTES = 8 * 60;
export const PERMIT_DISCLAIMER =
  'Park permits, some private calendars, and walk-on use are still not verified.';

export const FCPS_SCHOOL_FIELD_IDS = new Set([
  'chantilly-hs-turf',
  'centreville-hs-turf',
  'centreville-hs-stadium',
  'oakton-hs-turf',
  'oakton-hs-1',
  'oakton-hs-3',
  'westfield-hs-turf',
  'westfield-hs-stadium',
]);

export function permitDisclaimer(fieldId) {
  if (FCPS_SCHOOL_FIELD_IDS.has(fieldId)) {
    return 'FCPS community-use permits were checked for this school field. Walk-on use can still occupy it.';
  }
  return PERMIT_DISCLAIMER;
}

const DISTANCE_BY_ID = Object.fromEntries(fieldsConfig.map(field => [field.id, field.distanceMi]));

export function parseStartMinutes(timeText = '') {
  const match = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

export function eventBounds(timeText = '') {
  const clocks = [...String(timeText).matchAll(/(\d{1,2}):(\d{2})\s*([AP]M)/gi)];
  if (!clocks.length) return null;
  const toMinutes = (match) => {
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    return hour * 60 + Number(match[2]);
  };
  const start = toMinutes(clocks[0]);
  let end = clocks[1] ? toMinutes(clocks[1]) : start + EVENT_DURATION_MINUTES;
  if (end <= start) end += 12 * 60;
  return {
    start: start - EVENT_SETUP_BUFFER_MINUTES,
    end,
  };
}

export function overlapsPickupWindow(events, pickupStart) {
  const pickupEnd = pickupStart + PICKUP_DURATION_MINUTES;
  return (events || []).some(event => {
    const bounds = eventBounds(event.time);
    if (!bounds) return true;
    return pickupStart < bounds.end && pickupEnd > bounds.start;
  });
}

export function overlappingEvents(events, pickupStart) {
  const pickupEnd = pickupStart + PICKUP_DURATION_MINUTES;
  return (events || []).filter(event => {
    const bounds = eventBounds(event.time);
    if (!bounds) return true;
    return pickupStart < bounds.end && pickupEnd > bounds.start;
  });
}

export function turfFilterLabel(turfOnly) {
  return turfOnly ? 'Turf' : 'Showing turf plus grass';
}

export function formatClock(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour24 % 12 || 12}:${String(min).padStart(2, '0')} ${suffix}`;
}

export function timeOptions() {
  const options = [];
  for (let minutes = 6 * 60; minutes <= 22 * 60 + 30; minutes += 30) {
    options.push({ value: String(minutes), label: formatClock(minutes) });
  }
  return options;
}

export const TIME_OPTIONS = timeOptions();

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatFriendlyDate(dateStr, todayStr) {
  const date = parseLocalDate(dateStr);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const short = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (dateStr === todayStr) return `Today, ${weekday} (${short})`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toLocaleDateString('en-CA')) return `Tomorrow, ${weekday} (${short})`;
  return `${weekday}, ${short}`;
}

export function hubRank(fieldId) {
  if (fieldId === 'chantilly-hs-turf') return [0, 0];
  if (fieldId === 'sully-highlands-1') return [1, 0];
  if (fieldId === 'sully-highlands-2') return [1, 1];
  if (fieldId.startsWith('sully-highlands')) return [1, 9];
  return [2, DISTANCE_BY_ID[fieldId] ?? 99];
}

export function pickBestField(fields) {
  return [...fields].sort((a, b) => {
    const [aHub, aTie] = hubRank(a.id);
    const [bHub, bTie] = hubRank(b.id);
    return aHub - bHub || aTie - bTie;
  })[0] || null;
}
