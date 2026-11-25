/**
 * PlayOn / VNN schedule parser (shared by Chantilly, Centreville, Westfield).
 *
 * PlayOn removed the data-testid="event-<n>-*" attributes the old parser
 * relied on (verified 2026-11-25: zero matches in the rendered schedule
 * pages, which is what froze the Fieldchecker snapshot on 2026-11-19).
 * The schedule data is still embedded in the page as JSON inside the
 * Next.js RSC payload: each event is a "baseEvent" object with an ISO
 * start time, teamEvents (displayName / sport / level / gender / schools)
 * and a location. This module extracts those objects from the raw or
 * rendered HTML without depending on DOM testids.
 */

const ESCAPED = /\\"/g;

function unescapePayload(html) {
  // RSC payload strings escape quotes as \" — normalize so regexes and
  // field extraction can work on plain JSON-shaped text.
  return html.includes('\\"') ? html.replace(ESCAPED, '"') : html;
}

function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[1] : '';
}

export function extractPlayOnEvents(html) {
  const text = unescapePayload(html || '');
  const events = [];
  const seen = new Set();
  const marker = '"baseEvent":{';
  let idx = text.indexOf(marker);
  while (idx !== -1) {
    const start = idx + marker.length;
    const next = text.indexOf(marker, start);
    const segment = text.slice(start, next === -1 ? start + 30000 : next);

    const id = firstMatch(segment, /^"id":"(\d+)"/) || firstMatch(segment, /"id":"(\d+)","globalEventId"/);
    const startISO = firstMatch(segment, /"start":"(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)"/);
    const dedupeKey = `${startISO}|${firstMatch(segment, /"location":\{"name":"([^"]+)"/)}|${firstMatch(segment, /"displayName":"([^"]+)"/)}`;
    if (startISO && !seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      const venueName = firstMatch(segment, /"location":\{"name":"([^"]+)"/);
      const locationSchool = firstMatch(segment, /"location":\{[^}]*?"school":\{"id":"\d+","logoUrl":"[^"]*","name":"([^"]+)"/)
        || firstMatch(segment, /"location":\{[\s\S]{0,600}?"school":\{[^}]*?"name":"([^"]+)"/);
      // All teams in this event: displayName + the schools they belong to.
      const teams = [];
      for (const m of segment.matchAll(/"displayName":"([^"]+)"/g)) {
        teams.push({ displayName: m[1], at: m.index });
      }
      const sports = [...segment.matchAll(/"sport":\{"id":"\d+","name":"([^"]+)"/g)]
        .map(m => ({ name: m[1], at: m.index }));
      const schoolNames = [...segment.matchAll(/"schools":\[\{"id":"\d+","name":"([^"]+)"/g)]
        .map(m => ({ name: m[1], at: m.index }));
      const eventName = firstMatch(segment, /"meet":\{"eventName":"([^"]+)"/)
        || firstMatch(segment, /"game":\{"eventName":"([^"]+)"/);
      events.push({
        id,
        startISO,
        isCancelled: /"isCancelled":true/.test(segment.slice(0, 400)),
        venueName,
        locationSchool,
        teams,
        sports,
        schoolNames,
        eventName,
        segment,
      });
    }
    idx = next;
  }
  return events;
}

// PlayOn stores start as a wall-clock local time (optionally with a
// spurious trailing Z): "2026-11-30T16:30:00.000Z" means 4:30 PM at the
// school, not 16:30 UTC. Verified against the rendered schedule page
// (a 09:00 start displays as 9:00 AM). So read the components directly.
export function easternDateAndTime(iso) {
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { date: null, time: 'TBA' };
  let hour = Number(m[2]);
  const minute = m[3];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 === 0 ? 12 : hour % 12;
  return { date: m[1], time: `${hour}:${minute} ${ampm}` };
}
