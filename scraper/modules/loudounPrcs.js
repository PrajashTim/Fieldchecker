/**
 * Loudoun County PRCS private/community permits from the county export
 * (not a public occupancy feed). Middle schools, baseball/softball,
 * grass rectangles, and track/football pads are excluded.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const payload = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/loudounReservations.json'), 'utf8')
);

export const LOUDOUN_FIELD_IDS = new Set([
  'freedom-hs-turf',
  'freedom-hs-aux',
  'champe-hs-turf',
  'champe-hs-turf-2',
  'hanson-1',
  'hanson-2',
  'bolen-18',
  'bolen-19',
]);

export function fetchLoudounEvents() {
  const events = {};
  let eventCount = 0;
  for (const [dateStr, rows] of Object.entries(payload.days || {})) {
    for (const row of rows) {
      if (!events[row.id]) events[row.id] = {};
      if (!events[row.id][dateStr]) events[row.id][dateStr] = [];
      events[row.id][dateStr].push({
        time: row.time,
        title: row.title,
        source: 'Loudoun PRCS permits',
        precision: 'permit',
        status: 'scheduled',
      });
      eventCount += 1;
    }
  }
  return {
    events,
    health: {
      ok: true,
      provider: 'loudoun-prcs',
      message: `County reservation export applied (${eventCount} turf/soccer-used sessions, ${Object.keys(payload.days || {}).length} dates). Middle schools and diamond fields omitted.`,
      eventCount,
      lastUpdated: payload.lastUpdated,
    },
  };
}
