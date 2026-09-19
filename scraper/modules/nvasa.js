/**
 * Public NVASA team schedule tables. Polls the current season selector.
 * Maps only exact catalog subfields; park-only names stay unmapped.
 */
import { load } from 'cheerio';
import { httpGet, absoluteUrl } from './http.js';
import { resolveExactField } from './venueMap.js';

const INDEX_URL = 'https://nvasa.org/divisions.cfm?season=0';

export function parseNvasaTeamLinks(html, pageUrl = INDEX_URL) {
  const $ = load(html);
  return [...new Set($('a[href*="team.cfm"]').map((_, el) => absoluteUrl($(el).attr('href'), pageUrl)).get())];
}

export function parseNvasaTeamSchedule(html, sourceUrl, windowStart, windowEnd) {
  const $ = load(html);
  const games = [];
  const unmappedLocations = new Set();
  $('#matches table tbody tr, table.display tbody tr').each((_, row) => {
    const cells = $(row).find('td').map((__, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 8) return;
    const dateStr = parseNvasaDate(cells[3] || cells[2]);
    if (!dateStr || dateStr < windowStart || dateStr > windowEnd) return;
    const time = displayTime(cells[4] || cells[3]);
    const home = cells[5] || '';
    const away = cells[7] || cells[6] || '';
    const location = cells[cells.length - 1] || '';
    const resolved = resolveExactField(location);
    if (!resolved.fieldId) {
      if (location) unmappedLocations.add(location);
      return;
    }
    games.push({
      fieldId: resolved.fieldId,
      dateStr,
      time,
      title: `Soccer — ${[home, away].filter(Boolean).join(' vs ') || 'NVASA'}`,
      location,
      source: 'NVASA',
      sourceUrl,
      precision: 'exact_subfield',
      confidence: 'verified_live',
      status: 'scheduled',
    });
  });
  return { games, unmappedLocations };
}

function parseNvasaDate(text) {
  const match = String(text).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/) || String(text).match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) return null;
  let date;
  if (match[0].includes('/')) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    date = new Date(`${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}T12:00:00`);
  } else {
    date = new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00`);
  }
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

export async function fetchNvasaEvents(windowStart, windowEnd) {
  const healthBase = { provider: 'nvasa', sourceUrl: INDEX_URL };
  try {
    const index = await httpGet(INDEX_URL);
    if (index.status !== 200) throw new Error(`NVASA index returned HTTP ${index.status}`);
    const $ = load(index.body);
    const seasonLabel = $('option[selected], select option').filter((_, el) => $(el).attr('value') === '0' || /selected/i.test($(el).attr('selected') || '')).first().text().trim()
      || ($('body').text().includes('Fall 2026') ? 'Fall 2026' : 'current season');
    const links = parseNvasaTeamLinks(index.body, INDEX_URL).slice(0, 40);
    const games = [];
    const unmappedLocations = new Set();
    for (const url of links) {
      const page = await httpGet(url);
      if (page.status !== 200) continue;
      const parsed = parseNvasaTeamSchedule(page.body, url, windowStart, windowEnd);
      games.push(...parsed.games);
      parsed.unmappedLocations.forEach(name => unmappedLocations.add(name));
    }
    const events = {};
    for (const game of games) {
      events[game.fieldId] ??= {};
      events[game.fieldId][game.dateStr] ??= [];
      events[game.fieldId][game.dateStr].push({
        time: game.time, title: game.title, location: game.location, source: game.source,
        sourceUrl: game.sourceUrl, precision: game.precision, confidence: game.confidence, status: game.status,
      });
    }
    console.log(`[NVASA] ${seasonLabel}: ${links.length} team pages → ${games.length} mapped games`);
    return {
      events,
      health: {
        ...healthBase,
        ok: true,
        message: `${seasonLabel} public team pages checked; ${games.length} games mapped to catalog fields${unmappedLocations.size ? `; venues outside catalog: ${[...unmappedLocations].sort().slice(0, 12).join(', ')}` : games.length ? '' : '. No exact catalog-field matches this season'}`,
        eventCount: games.length,
        unmappedLocations: [...unmappedLocations].sort(),
      },
    };
  } catch (error) {
    console.error('[NVASA] Failed:', error.message);
    return { events: {}, health: { ...healthBase, ok: false, message: error.message, eventCount: 0 } };
  }
}
