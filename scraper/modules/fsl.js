/**
 * Public Fairfax Soccer League (over-50 / over-60) GoSports schedule.
 * Evenings only; mapped only at exact catalog subfields.
 */
import { load } from 'cheerio';
import { httpGet } from './http.js';
import { combineComplexAndField, resolveExactField } from './venueMap.js';

const SOURCE_URL = 'https://gosportsleague.com/l/fo5sl/schedule';

export function parseFslSchedule(html, sourceUrl, windowStart, windowEnd) {
  const $ = load(html);
  const games = [];
  const unmappedLocations = new Set();
  $('.pub-fix--sched').each((_, el) => {
    const $el = $(el);
    const dateStr = parseFslDate($el.find('.pub-fix-date').first().text());
    if (!dateStr || dateStr < windowStart || dateStr > windowEnd) return;
    const time = displayTime($el.find('.pub-fix-time').first().text());
    const teams = $el.find('.pub-fix-team').map((__, team) => $(team).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
    const field = $el.find('.pub-fix-field a').first().text().replace(/\s+/g, ' ').trim();
    const note = ($el.find('.pub-fix-fieldnote').first().attr('title') || $el.find('.pub-fix-fieldnote').first().text()).replace(/^[·•\s]+/, '').trim();
    const venue = fslVenue(field, note);
    const resolved = resolveExactField(venue);
    if (!resolved.fieldId) {
      if (field) unmappedLocations.add(note ? `${field} (${note})` : field);
      return;
    }
    const division = $el.find('.pub-fix-div').first().text().replace(/\s+/g, ' ').trim();
    games.push({
      fieldId: resolved.fieldId,
      dateStr,
      time,
      title: `Soccer — ${teams.join(' vs ') || division || 'FSL'}`,
      location: venue,
      source: 'FSL',
      sourceUrl,
      precision: 'exact_subfield',
      confidence: 'verified_live',
      status: 'scheduled',
    });
  });
  return { games, unmappedLocations };
}

function fslVenue(field, note) {
  const sub = String(note).match(/([0-9]+[A-C]?)/i)?.[1];
  if (sub && /arrowhead/i.test(field)) return `Arrowhead #${sub}`;
  if (sub && /lawrence/i.test(field)) return `EC Lawrence Park #${sub}`;
  if (sub && /poplar/i.test(field)) return `Poplar Tree Park #${sub}`;
  if (sub && /westfield/i.test(field)) return field;
  return combineComplexAndField(field, note);
}

function parseFslDate(text) {
  const match = String(text).match(/([A-Za-z]{3})\s+(\d{1,2})/);
  if (!match) return null;
  const year = 2026;
  const date = new Date(`${match[1]} ${match[2]}, ${year} 12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function displayTime(raw) {
  const match = String(raw).match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return 'TBA';
  return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`;
}

export async function fetchFslEvents(windowStart, windowEnd) {
  const healthBase = { provider: 'fsl', sourceUrl: SOURCE_URL };
  try {
    const page = await httpGet(SOURCE_URL);
    if (page.status !== 200) throw new Error(`FSL schedule returned HTTP ${page.status}`);
    if (!page.body.includes('pub-fix--sched')) throw new Error('FSL schedule rows were not present in public HTML');
    const parsed = parseFslSchedule(page.body, SOURCE_URL, windowStart, windowEnd);
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
    console.log(`[FSL] ${parsed.games.length} mapped games; ${parsed.unmappedLocations.size} venues outside catalog`);
    return {
      events,
      health: {
        ...healthBase,
        ok: true,
        message: `Over-50/over-60 GoSports schedule checked; ${parsed.games.length} games mapped to catalog fields (evening/Sunday 9 PM, not Sunday morning)${parsed.unmappedLocations.size ? `; venues outside catalog: ${[...parsed.unmappedLocations].sort().join(', ')}` : ''}`,
        eventCount: parsed.games.length,
        unmappedLocations: [...parsed.unmappedLocations].sort(),
      },
    };
  } catch (error) {
    console.error('[FSL] Failed:', error.message);
    return { events: {}, health: { ...healthBase, ok: false, message: error.message, eventCount: 0 } };
  }
}
