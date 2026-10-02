/**
 * Rebuild mockState.json from the current catalog + Loudoun overlay
 * without re-fetching live league pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLoudounEvents, LOUDOUN_FIELD_IDS } from './modules/loudounPrcs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fieldsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'fieldsConfig.json'), 'utf8'));
const snapshotPath = path.join(__dirname, '../src/data/mockState.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const loudoun = fetchLoudounEvents();

function eventStartMinutes(timeText = '') {
  const match = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return 9999;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

function sortEvents(events) {
  return [...events].sort((a, b) => eventStartMinutes(a.time) - eventStartMinutes(b.time));
}

function isAthleticsEvent(event) {
  return /athletics/i.test(event.source || '');
}

function isAuxLabeled(event) {
  return /\baux\b|practice turf|rec field/i.test(`${event.location || ''} ${event.title || ''}`);
}

function loudounRows(fieldId, dateStr) {
  return loudoun.events[fieldId]?.[dateStr] ?? [];
}

const sourceHealth = {
  ...snapshot.sourceHealth,
  loudounPrcs: loudoun.health,
  'westfield-hs-stadium': snapshot.sourceHealth?.['westfield-hs-stadium'] || snapshot.sourceHealth?.['westfield-hs-turf'],
};

const schedule = {};
for (const [dateStr, rows] of Object.entries(snapshot.schedule)) {
  const byId = new Map(rows.map(item => [item.id, item]));
  const auxEvents = byId.get('westfield-hs-turf')?.events || [];
  schedule[dateStr] = fieldsConfig.map(field => {
    const previous = byId.get(field.id);
    let events = [...(previous?.events || [])];
    if (field.id === 'westfield-hs-turf') {
      events = events.filter(event => !isAthleticsEvent(event) || isAuxLabeled(event));
    }
    if (field.id === 'westfield-hs-stadium') {
      const moved = auxEvents.filter(event => isAthleticsEvent(event) && !isAuxLabeled(event));
      events = [...events, ...moved];
    }
    for (const extra of loudounRows(field.id, dateStr)) {
      const key = `${extra.time}|${extra.title}|${extra.source}`;
      if (!events.some(item => `${item.time}|${item.title}|${item.source}` === key)) {
        events.push(extra);
      }
    }
    const relevantHealth = LOUDOUN_FIELD_IDS.has(field.id)
      ? [sourceHealth.loudounPrcs]
      : [sourceHealth.fxa, sourceHealth.countyPermits];
    if (field.id === 'chantilly-hs-turf') relevantHealth.push(sourceHealth.chantilly);
    if (field.id === 'centreville-hs-turf') relevantHealth.push(sourceHealth['centreville-hs-turf']);
    if (field.id === 'westfield-hs-turf' || field.id === 'westfield-hs-stadium') {
      relevantHealth.push(sourceHealth['westfield-hs-turf']);
    }
    const unavailableSources = relevantHealth.filter(item => !item?.ok);
    const status = events.length > 0
      ? 'occupied'
      : unavailableSources.length === 0 ? 'open' : 'unknown';
    const statusReason = events.length > 0
      ? 'Known conflict from a connected public schedule'
      : unavailableSources.length === 0
        ? 'No conflict found in connected sources. This is not a reservation or guarantee of access.'
        : `Not verified — ${unavailableSources.map(item => item?.provider || 'source').join(', ')} unavailable. A missing event is not evidence the field is free.`;
    return {
      id: field.id,
      name: field.name,
      subfield: field.subfield,
      type: field.type,
      location: field.location,
      status,
      statusReason,
      events: sortEvents(events),
      unavailableSources: unavailableSources.map(item => item?.provider || 'unknown'),
    };
  });
}

const output = {
  ...snapshot,
  lastUpdated: new Date().toISOString(),
  sourceHealth,
  schedule,
};

fs.writeFileSync(snapshotPath, JSON.stringify(output, null, 2));
const dates = Object.keys(schedule);
console.log(`Merged ${fieldsConfig.length} fields across ${dates.length} days`);
console.log(`Loudoun events in window: ${dates.reduce((n, date) => n + fieldsConfig.reduce((inner, field) => inner + loudounRows(field.id, date).length, 0), 0)}`);
