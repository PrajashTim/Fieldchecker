/**
 * Add the current FCPS community-use window onto the existing snapshot
 * without re-fetching league pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchFcpsCommunityUseEvents, FCPS_FIELD_IDS } from './modules/fcpsCommunityUse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fieldsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'fieldsConfig.json'), 'utf8'));
const snapshotPath = path.join(__dirname, '../src/data/mockState.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

const start = snapshot.coverageStart;
const end = snapshot.coverageEnd;
const fcps = await fetchFcpsCommunityUseEvents(start, end);
if (!fcps.health.ok) {
  console.error(fcps.health.message);
  process.exit(1);
}

function eventStartMinutes(timeText = '') {
  const match = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return 9999;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

const schedule = {};
for (const [dateStr, rows] of Object.entries(snapshot.schedule)) {
  const byId = new Map(rows.map(item => [item.id, item]));
  schedule[dateStr] = fieldsConfig.map(field => {
    const previous = byId.get(field.id);
    const events = (previous?.events || []).filter(event => event.source !== 'FCPS Community Use');
    for (const extra of fcps.events[field.id]?.[dateStr] || []) {
      const key = `${extra.time}|${extra.title}|${extra.eventId}`;
      if (!events.some(item => `${item.time}|${item.title}|${item.eventId}` === key)) events.push(extra);
    }
    events.sort((a, b) => eventStartMinutes(a.time) - eventStartMinutes(b.time));
    const relevant = FCPS_FIELD_IDS.has(field.id)
      ? [snapshot.sourceHealth?.fxa, fcps.health]
      : field.id.startsWith('freedom-') || field.id.startsWith('champe-') || field.id.startsWith('hanson-') || field.id.startsWith('bolen-')
        ? [snapshot.sourceHealth?.loudounPrcs]
        : [snapshot.sourceHealth?.fxa, snapshot.sourceHealth?.countyPermits];
    const unavailableSources = relevant.filter(item => !item?.ok);
    const status = events.length > 0 ? 'occupied' : unavailableSources.length === 0 ? 'open' : 'unknown';
    return {
      id: field.id,
      name: field.name,
      subfield: field.subfield,
      type: field.type,
      location: field.location,
      status,
      statusReason: events.length
        ? 'Known conflict from a connected public schedule'
        : unavailableSources.length === 0
          ? 'No conflict found in connected sources. This is not a reservation or guarantee of access.'
          : `Not verified — ${unavailableSources.map(item => item?.provider || 'source').join(', ')} unavailable. A missing event is not evidence the field is free.`,
      events,
      unavailableSources: unavailableSources.map(item => item?.provider || 'unknown'),
    };
  });
}

const output = {
  ...snapshot,
  lastUpdated: new Date().toISOString(),
  sourceHealth: {
    ...snapshot.sourceHealth,
    fcpsCommunityUse: fcps.health,
    countyPermits: {
      ...(snapshot.sourceHealth?.countyPermits || {}),
      ok: false,
      provider: 'fairfax-county-permits',
      message: 'Fairfax park permits are still not a public occupancy feed. FCPS high-school community use is checked separately.',
    },
  },
  schedule,
};
fs.writeFileSync(snapshotPath, JSON.stringify(output, null, 2));
console.log(fcps.health.message);
if (fcps.health.unmappedRooms?.length) console.log('unmapped', fcps.health.unmappedRooms.join(' | '));
