/**
 * Public NVSL division pages. Park-level names are recorded, never inferred onto a subfield.
 */
import { load } from 'cheerio';
import { httpGet, absoluteUrl } from './http.js';
import { resolveExactField } from './venueMap.js';

const INDEX_URL = 'https://nvslsoccer.com/divisions.php';
const SEASON = 'Fall 2026';

export function parseDivisionIndex(html, pageUrl = INDEX_URL) {
  const $ = load(html);
  const hrefs = new Set();
  $('select[name="season_select"] option').each((_, el) => {
    const value = ($(el).attr('value') || '').trim();
    if (!value || value === 'Select Division') return;
    const url = absoluteUrl(value, pageUrl);
    if (/season=Fall\+2026/i.test(url) || /season=Fall%202026/i.test(url)) hrefs.add(url);
  });
  return [...hrefs];
}

export function parseDivisionSchedule(html, sourceUrl, windowStart, windowEnd) {
  const $ = load(html);
  const games = [];
  const unmappedLocations = new Set();
  $('.mobile_hide').each((_, block) => {
    const $block = $(block);
    const paragraphs = $block.find('.ten > .column').first().find('p').map((__, p) => $(p).text().replace(/\s+/g, ' ').trim()).get()
      .filter(Boolean);
    const dateStr = parseNvslDate(paragraphs[0]);
    const time = displayTime(paragraphs[1]);
    if (!dateStr || dateStr < windowStart || dateStr > windowEnd) return;
    const location = $block.find('a[href*="maps.app"], a[href*="google.com/maps"]').first().text().replace(/\s+/g, ' ').trim();
    if (!location) return;
    const teams = $block.find('.ten > .column.two.seventy').map((_, el) => {
      return $(el).text().replace(/sports_soccer/g, '').replace(/\s+/g, ' ').trim();
    }).get().filter(Boolean);
    const home = teams[0] || 'NVSL';
    const away = teams[1] || '';
    const resolved = resolveExactField(location);
    if (!resolved.fieldId) {
      unmappedLocations.add(location);
      return;
    }
    games.push({
      fieldId: resolved.fieldId,
      dateStr,
      time,
      title: `Soccer — ${[home, away].filter(Boolean).join(' vs ')}`,
      location,
      source: 'NVSL',
      sourceUrl,
      precision: 'exact_subfield',
      confidence: 'verified_live',
      status: 'scheduled',
    });
  });
  return { games, unmappedLocations };
}

function parseNvslDate(text) {
  const match = String(text).match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return null;
  const date = new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00`);
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

export async function fetchNvslEvents(windowStart, windowEnd) {
  const healthBase = { provider: 'nvsl', sourceUrl: INDEX_URL };
  try {
    const index = await httpGet(INDEX_URL);
    if (index.status !== 200) throw new Error(`NVSL index returned HTTP ${index.status}`);
    const pages = parseDivisionIndex(index.body, INDEX_URL);
    if (!pages.length) throw new Error('NVSL division index had no Fall 2026 pages');
    const games = [];
    const unmappedLocations = new Set();
    let parsedPages = 0;
    for (const pageUrl of pages) {
      const page = await httpGet(pageUrl);
      if (page.status !== 200) {
        console.warn(`[NVSL] ${pageUrl} HTTP ${page.status}`);
        continue;
      }
      const parsed = parseDivisionSchedule(page.body, pageUrl, windowStart, windowEnd);
      parsedPages++;
      games.push(...parsed.games);
      parsed.unmappedLocations.forEach(name => unmappedLocations.add(name));
    }
    const events = {};
    const seen = new Set();
    for (const game of games) {
      const key = `${game.fieldId}|${game.dateStr}|${game.time}|${game.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
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
    const eventCount = games.length;
    if (!parsedPages) throw new Error('No NVSL Fall 2026 division pages could be parsed');
    console.log(`[NVSL] ${parsedPages} division pages → ${eventCount} mapped games`);
    if (unmappedLocations.size) console.warn(`[NVSL] Unmapped venues: ${[...unmappedLocations].sort().join('; ')}`);
    return {
      events,
      health: {
        ...healthBase,
        ok: true,
        message: `${SEASON} public division pages checked; ${eventCount} games mapped to catalog fields${unmappedLocations.size ? `; ${unmappedLocations.size} venues outside catalog or park-level` : ''}`,
        eventCount,
        unmappedLocations: [...unmappedLocations].sort(),
      },
    };
  } catch (error) {
    console.error('[NVSL] Failed:', error.message);
    return { events: {}, health: { ...healthBase, ok: false, message: error.message, eventCount: 0 } };
  }
}
