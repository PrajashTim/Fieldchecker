/**
 * Public NCSL/Demosphere connector.
 * Uses field-complex calendars (exact subfield) — not member logins.
 * Directory listings are aliases only; they never become occupancy.
 */
import { load } from 'cheerio';
import { httpGet, absoluteUrl } from './http.js';
import { combineComplexAndField, resolveExactField } from './venueMap.js';

const BASE = 'https://elements.demosphere.com';
const DIRECTORY_URL = `${BASE}/80738/fields/directory/list.html`;
const CURRENT_SEASON_LABEL = /fall\s+2026/i;

export function parseFieldDirectory(html) {
  const $ = load(html);
  const complexes = [];
  $('td.fg-name a').each((_, el) => {
    const complexName = $(el).text().replace(/\s+/g, ' ').trim();
    const displayId = $(el).attr('href')?.match(/Display\/\+(\d+)/)?.[1];
    const row = $(el).closest('tr');
    const fieldLabels = row.find('td.fg-facs span').map((__, span) => $(span).text().replace(/\s+/g, ' ').trim()).get()
      .filter(label => label && label !== '·');
    if (complexName && displayId) complexes.push({ complexName, displayId, fieldLabels });
  });
  return complexes;
}

export function selectTargetComplexes(complexes) {
  return complexes.filter(complex => {
    const labels = complex.fieldLabels.length ? complex.fieldLabels : [''];
    return labels.some(label => resolveExactField(combineComplexAndField(complex.complexName, label)).fieldId);
  });
}

export function parseComplexCalendars(html, pageUrl) {
  const $ = load(html);
  const seasonIndexes = [];
  $('thead td.se-name').each((index, el) => {
    const title = `${$(el).attr('title') || ''} ${$(el).text()}`.replace(/\s+/g, ' ').trim();
    if (CURRENT_SEASON_LABEL.test(title)) {
      seasonIndexes.push({ index, organization: /rec/i.test(title) ? 'NCSL REC' : 'NCSL', title });
    }
  });
  const calendars = [];
  $('tbody tr').each((_, row) => {
    const facName = $(row).find('td.fac-name').first().text().replace(/\s+/g, ' ').trim();
    if (!facName) return;
    const resolved = resolveExactField(facName);
    if (!resolved.fieldId) return;
    const seasonCells = $(row).find('td.fac-gms');
    for (const season of seasonIndexes) {
      const href = seasonCells.eq(season.index).find('a[href]').attr('href');
      if (!href) continue;
      calendars.push({
        fieldId: resolved.fieldId,
        location: facName,
        organization: season.organization,
        sourceUrl: absoluteUrl(href, pageUrl),
      });
    }
  });
  return calendars;
}

export function parseFieldCalendar(html, calendar, windowStart, windowEnd) {
  const $ = load(html);
  const asOfMatch = $.text().match(/current as of\s+([^)]+?)\s*(?:\)|$)/i);
  const currentAsOf = asOfMatch?.[1]?.trim() || null;
  let dateStr = null;
  const games = [];

  $('#tblListGames2 tr').each((_, row) => {
    const $row = $(row);
    if ($row.hasClass('gm-hdr-5d1h')) {
      dateStr = parseLongDate($row.text());
      return;
    }
    if (!$row.hasClass('sch-main-gm') || !dateStr) return;
    if (dateStr < windowStart || dateStr > windowEnd) return;
    const eventId = $row.attr('data-gamekey');
    const time = displayTime($row.find('td.tim').first().text());
    const home = teamName($row.find('td.schedtm1').first());
    const away = teamName($row.find('td.schedtm2').first());
    const rescheduled = /reason(YELLOW|RED)/i.test($row.find('img').attr('src') || '')
      || $row.find('img[src*="reasonYELLOW"], img[src*="reasonRED"]').length > 0;
    games.push({
      fieldId: calendar.fieldId,
      dateStr,
      eventId,
      time,
      title: `Soccer — ${[home, away].filter(Boolean).join(' vs ') || calendar.organization}`,
      location: calendar.location,
      source: calendar.organization,
      sourceUrl: calendar.sourceUrl,
      precision: 'exact_subfield',
      confidence: 'verified_live',
      status: rescheduled ? 'rescheduled' : 'scheduled',
      currentAsOf,
    });
  });
  return { games, currentAsOf, rowCount: games.length };
}

function teamName($cell) {
  const named = $cell.find('.tm-name').text().replace(/\s+/g, ' ').trim();
  return named || $cell.text().replace(/\s+/g, ' ').trim();
}

function displayTime(raw) {
  const match = String(raw).match(/(\d{1,2}:\d{2})\s*([ap]m)/i);
  if (!match) return 'TBA';
  return `${match[1]} ${match[2].toUpperCase()}`;
}

function parseLongDate(text) {
  const match = String(text).match(/([A-Za-z]+ \d{1,2}, \d{4})/);
  if (!match) return null;
  const date = new Date(`${match[1]} 12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function groupByField(games) {
  const byField = {};
  const seen = new Set();
  for (const game of games) {
    const key = game.eventId || `${game.fieldId}|${game.dateStr}|${game.time}|${game.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byField[game.fieldId] ??= {};
    byField[game.fieldId][game.dateStr] ??= [];
    byField[game.fieldId][game.dateStr].push({
      time: game.time,
      title: game.title,
      location: game.location,
      source: game.source,
      sourceUrl: game.sourceUrl,
      precision: game.precision,
      confidence: game.confidence,
      status: game.status,
      eventId: game.eventId,
    });
  }
  return byField;
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...await Promise.all(items.slice(i, i + limit).map(mapper)));
  }
  return results;
}

export async function fetchNcslEvents(windowStart, windowEnd) {
  const healthBase = { provider: 'ncsl', sourceUrl: DIRECTORY_URL };
  try {
    const directory = await httpGet(DIRECTORY_URL);
    if (directory.status !== 200) throw new Error(`field directory returned HTTP ${directory.status}`);
    const targets = selectTargetComplexes(parseFieldDirectory(directory.body));
    if (!targets.length) throw new Error('NCSL directory contained no exact configured subfields');

    const calendars = [];
    const unmappedOnTargetPages = new Set();
    await mapLimit(targets, 4, async complex => {
      const pageUrl = `${BASE}/scripts/runisa.dll?M2:gp::80738+Elements/Display+E+18235+Display/+${complex.displayId}`;
      try {
        const page = await httpGet(pageUrl);
        if (page.status !== 200) throw new Error(`HTTP ${page.status}`);
        parseComplexCalendars(page.body, pageUrl).forEach(item => calendars.push(item));
        const $ = load(page.body);
        $('td.fac-name').each((_, el) => {
          const name = $(el).text().replace(/\s+/g, ' ').trim();
          if (name && !resolveExactField(name).fieldId) unmappedOnTargetPages.add(name);
        });
      } catch (error) {
        console.warn(`[NCSL] Complex ${complex.complexName} failed: ${error.message}`);
      }
    });

    const uniqueCalendars = [...new Map(calendars.map(item => [item.sourceUrl, item])).values()];
    if (!uniqueCalendars.length) {
      throw new Error('Fall 2026 exact-field calendars were not found for configured subfields');
    }

    const games = [];
    let failedCalendars = 0;
    let currentAsOf = null;
    await mapLimit(uniqueCalendars, 4, async calendar => {
      try {
        const page = await httpGet(calendar.sourceUrl);
        if (page.status !== 200) throw new Error(`HTTP ${page.status}`);
        if (!page.body.includes('tblListGames2')) throw new Error('calendar table missing');
        const parsed = parseFieldCalendar(page.body, calendar, windowStart, windowEnd);
        if (parsed.currentAsOf && (!currentAsOf || Date.parse(parsed.currentAsOf) > Date.parse(currentAsOf))) {
          currentAsOf = parsed.currentAsOf;
        }
        games.push(...parsed.games);
      } catch (error) {
        failedCalendars++;
        console.warn(`[NCSL] ${calendar.location} (${calendar.organization}) failed: ${error.message}`);
      }
    });

    const events = groupByField(games);
    const eventCount = games.length;
    if (unmappedOnTargetPages.size) {
      console.warn(`[NCSL] Unmapped subfields on target complexes: ${[...unmappedOnTargetPages].sort().join('; ')}`);
    }
    console.log(`[NCSL] ${uniqueCalendars.length} Fall 2026 calendars; ${eventCount} exact-field games in window`);
    return {
      events,
      health: {
        ...healthBase,
        ok: failedCalendars === 0 && eventCount >= 0,
        message: `${uniqueCalendars.length} exact-field calendars checked; ${eventCount} mapped games${currentAsOf ? `; current as of ${currentAsOf}` : ''}${failedCalendars ? `; ${failedCalendars} calendars failed` : ''}`,
        eventCount,
        calendarCount: uniqueCalendars.length,
        currentAsOf,
        unmappedLocations: [...unmappedOnTargetPages].sort(),
      },
    };
  } catch (error) {
    console.error('[NCSL] Failed:', error.message);
    return { events: {}, health: { ...healthBase, ok: false, message: error.message, eventCount: 0 } };
  }
}
