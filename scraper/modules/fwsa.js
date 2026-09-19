/**
 * Public FWSA LeagueApps Fall schedule page.
 */
import { load } from 'cheerio';
import { httpGet } from './http.js';
import { resolveExactField } from './venueMap.js';

const SOURCE_URL = 'https://fwsa.leagueapps.com/pages/schedule';

export function parseFwsaSchedule(html, sourceUrl, windowStart, windowEnd) {
  const $ = load(html);
  const games = [];
  const unmappedLocations = new Set();
  $('table tr').each((_, row) => {
    const cells = $(row).find('td').map((__, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 6) return;
    const [dateText, timeText, field, division, home, away] = cells;
    const dateStr = parseFwsaDate(dateText);
    if (!dateStr || dateStr < windowStart || dateStr > windowEnd) return;
    const resolved = resolveExactField(field);
    if (!resolved.fieldId) {
      if (field && field !== 'Field') unmappedLocations.add(field);
      return;
    }
    games.push({
      fieldId: resolved.fieldId,
      dateStr,
      time: displayTime(timeText),
      title: `Soccer — ${[home, away].filter(Boolean).join(' vs ') || division || 'FWSA'}`,
      location: field,
      source: 'FWSA',
      sourceUrl,
      precision: 'exact_subfield',
      confidence: 'verified_live',
      status: 'scheduled',
    });
  });
  return { games, unmappedLocations };
}

function parseFwsaDate(text) {
  const match = String(text).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function displayTime(raw) {
  const match = String(raw).match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return 'TBA';
  return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`;
}

export async function fetchFwsaEvents(windowStart, windowEnd) {
  const healthBase = { provider: 'fwsa', sourceUrl: SOURCE_URL };
  try {
    const page = await httpGet(SOURCE_URL);
    if (page.status !== 200) throw new Error(`FWSA schedule returned HTTP ${page.status}`);
    if (!/Fall 2026 Schedule/i.test(page.body)) throw new Error('FWSA Fall 2026 schedule table was not found');
    const parsed = parseFwsaSchedule(page.body, SOURCE_URL, windowStart, windowEnd);
    const events = {};
    for (const game of parsed.games) {
      events[game.fieldId] ??= {};
      events[game.fieldId][game.dateStr] ??= [];
      events[game.fieldId][game.dateStr].push({
        time: game.time,
        title: game.title,
        location: game.location,
        source: game.source,
        sourceUrl: game.sourceUrl,
        precision: game.precision,
        confidence: game.confidence,
        status: game.status,
      });
    }
    console.log(`[FWSA] ${parsed.games.length} mapped games; ${parsed.unmappedLocations.size} venues outside catalog`);
    return {
      events,
      health: {
        ...healthBase,
        ok: true,
        message: `Fall 2026 LeagueApps schedule checked; ${parsed.games.length} games mapped to catalog fields${parsed.unmappedLocations.size ? `; venues used: ${[...parsed.unmappedLocations].sort().join(', ')}` : ''}`,
        eventCount: parsed.games.length,
        unmappedLocations: [...parsed.unmappedLocations].sort(),
      },
    };
  } catch (error) {
    console.error('[FWSA] Failed:', error.message);
    return { events: {}, health: { ...healthBase, ok: false, message: error.message, eventCount: 0 } };
  }
}
