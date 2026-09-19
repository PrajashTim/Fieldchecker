/**
 * Public SYA rec soccer via Otto Sport widgets. No login.
 * Season ID is re-read from the SYA hub each run.
 */
import { load } from 'cheerio';
import { httpGet, absoluteUrl } from './http.js';
import { combineComplexAndField, resolveExactField } from './venueMap.js';

const HUB_URL = 'https://syasports.org/sports/soccer/recreational-soccer/';
const OTTO = 'https://app.ottosport.ai';
const FALLBACK_SEASON = '6aa1707c1998a8cd44808221';

export function parseSeasonId(hubHtml) {
  const match = String(hubHtml).match(/ottosport\.ai\/_widgets\/v1\/seasonal_schedule\/([a-f0-9]+)/i);
  return match?.[1] || FALLBACK_SEASON;
}

export function parseLocationSurfaces(html) {
  const $ = load(html);
  const surfaces = [];
  $('.card').each((_, card) => {
    const complexName = $(card).find('.card-title').first().text().replace(/\s+/g, ' ').trim();
    $(card).find('select option').each((__, option) => {
      const href = ($(option).attr('value') || '').trim();
      const label = $(option).text().replace(/\s+/g, ' ').trim();
      if (!/\/surfaces\//.test(href) || /^ALL SURFACES$/i.test(label)) return;
      surfaces.push({
        href: absoluteUrl(href, OTTO),
        complexName,
        surfaceLabel: label,
        scheduleUrl: `${OTTO}/_widgets/v1/${href.split('/seasonal_schedule/')[1]?.split('/')[0] || ''}/surfaces/${href.split('/surfaces/')[1]}/schedules?page=`,
      });
    });
  });
  return surfaces;
}

export function parseOttoSchedule(html, surface, windowStart, windowEnd) {
  const $ = load(html);
  const games = [];
  const unmappedLocations = new Set();
  let year = new Date().getFullYear();
  $('.sched-month, .sched-game').each((_, el) => {
    const $el = $(el);
    if ($el.hasClass('sched-month')) {
      const yearMatch = $el.text().match(/(\d{4})/);
      if (yearMatch) year = Number(yearMatch[1]);
      return;
    }
    const month = $el.find('.date .month').first().text().trim();
    const day = $el.find('.date .day').first().text().trim();
    const dateStr = parseOttoDate(month, day, year);
    if (!dateStr || dateStr < windowStart || dateStr > windowEnd) return;
    const time = displayTime($el.find('.time').first().text());
    const home = $el.find('.home .name').first().text().replace(/\s+/g, ' ').trim();
    const away = $el.find('.away .name').first().text().replace(/\s+/g, ' ').trim();
    const locationName = $el.find('.location').first().text().replace(/\s+/g, ' ').trim() || surface.complexName;
    const surfaceName = $el.find('.surface').first().text().replace(/\s+/g, ' ').trim() || surface.surfaceLabel;
    const venue = combineComplexAndField(locationName, surfaceName);
    const resolved = resolveExactField(venue);
    if (!resolved.fieldId) {
      unmappedLocations.add(venue);
      return;
    }
    const number = $el.find('.number').first().text().replace(/\s+/g, ' ').trim();
    games.push({
      fieldId: resolved.fieldId,
      dateStr,
      eventId: number || `${dateStr}|${venue}|${time}|${home}|${away}`,
      time,
      title: `Soccer — ${[home, away].filter(Boolean).join(' vs ') || 'SYA rec'}`,
      location: venue,
      source: 'SYA',
      sourceUrl: surface.scheduleUrl,
      precision: 'exact_subfield',
      confidence: 'verified_live',
      status: /final/i.test($el.attr('class') || '') ? 'scheduled' : 'scheduled',
    });
  });
  return { games, unmappedLocations };
}

function parseOttoDate(month, day, year) {
  if (!month || !day) return null;
  const date = new Date(`${month} ${day}, ${year} 12:00:00`);
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

function scheduleUrlFor(href) {
  const surfaceId = href.match(/\/surfaces\/([a-f0-9]+)/i)?.[1];
  const seasonId = href.match(/seasonal_schedule\/([a-f0-9]+)/i)?.[1];
  if (!surfaceId || !seasonId) return null;
  return `${OTTO}/_widgets/v1/${seasonId}/surfaces/${surfaceId}/schedules?page=`;
}

export async function fetchSyaEvents(windowStart, windowEnd) {
  const healthBase = { provider: 'sya', sourceUrl: HUB_URL };
  try {
    const hub = await httpGet(HUB_URL);
    const seasonId = parseSeasonId(hub.body);
    const locationsUrl = `${OTTO}/_widgets/v1/seasonal_schedule/${seasonId}/locations`;
    const locations = await httpGet(locationsUrl);
    if (locations.status !== 200) throw new Error(`Otto locations returned HTTP ${locations.status}`);
    const surfaces = parseLocationSurfaces(locations.body).map(item => ({
      ...item,
      scheduleUrl: scheduleUrlFor(item.href) || item.scheduleUrl,
    })).filter(item => item.scheduleUrl);
    if (!surfaces.length) throw new Error('SYA Otto Sport widget listed no field surfaces');

    const games = [];
    const unmappedLocations = new Set();
    for (const surface of surfaces) {
      for (let n = 1; n <= 6; n++) {
        const pageUrl = n === 1
          ? surface.scheduleUrl
          : surface.scheduleUrl.replace(/page=$/, `page=${n}`);
        const html = await httpGet(pageUrl);
        if (html.status !== 200 || !html.body.includes('sched-game')) break;
        const parsed = parseOttoSchedule(html.body, surface, windowStart, windowEnd);
        games.push(...parsed.games);
        parsed.unmappedLocations.forEach(name => unmappedLocations.add(name));
        if (!html.body.includes(`page=${n + 1}`)) break;
      }
    }

    const events = {};
    const seenGames = new Set();
    for (const game of games) {
      const key = `${game.fieldId}|${game.dateStr}|${game.time}|${game.title}`;
      if (seenGames.has(key)) continue;
      seenGames.add(key);
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
        eventId: game.eventId,
      });
    }
    const eventCount = Object.values(events).reduce(
      (total, dates) => total + Object.values(dates).reduce((sum, rows) => sum + rows.length, 0), 0);
    console.log(`[SYA] Otto season ${seasonId}: ${surfaces.length} surfaces → ${eventCount} mapped games`);
    if (unmappedLocations.size) console.warn(`[SYA] Unmapped venues: ${[...unmappedLocations].sort().join('; ')}`);
    return {
      events,
      health: {
        ...healthBase,
        ok: true,
        message: `Public Otto Sport rec widget checked (${surfaces.length} surfaces); ${eventCount} games mapped to catalog fields${unmappedLocations.size ? `; ${unmappedLocations.size} venues outside catalog` : ''}`,
        eventCount,
        unmappedLocations: [...unmappedLocations].sort(),
        seasonId,
      },
    };
  } catch (error) {
    console.error('[SYA] Failed:', error.message);
    return { events: {}, health: { ...healthBase, ok: false, message: error.message, eventCount: 0 } };
  }
}
