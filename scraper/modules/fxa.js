/**
 * FXA Sports scraper for LeagueLab, the platform FXA moved to in 2026.
 * Empty/unparseable feeds fail closed; they never mean every field is open.
 */
import https from 'https';
import { load } from 'cheerio';

const BASE_URL = 'https://fxasports.leaguelab.com';
// Only outdoor sports that can occupy one of the configured athletic fields.
// Court, golf, bowling, cornhole and indoor leagues cannot conflict with them.
const FIELD_SPORTS = new Set([
  'Soccer', 'Flag Football', 'Ultimate', 'Softball', 'Kickball',
]);
const LOCATION_TO_FIELD = {
  'chantilly high school stadium field': 'chantilly-hs-turf',
  'chantilly high school field 1': 'chantilly-hs-turf',
  'stringfellow park field 1': 'stringfellow-1',
  'stringfellow park turf front': 'stringfellow-1',
  'poplar tree park field 2': 'poplar-tree-2',
  'poplar tree park field 3': 'poplar-tree-3',
  'westfield high school aux field 1': 'westfield-hs-turf',
  'westfield high school aux field': 'westfield-hs-turf',
  'westfield high school stadium field': 'westfield-hs-turf',
  'westfield high school stadium': 'westfield-hs-turf',
  'ec lawrence park field 2': 'eclawrence-2',
  'ec lawrence park 2 ec 2': 'eclawrence-2',
  'ec lawrence 2 turf field 2': 'eclawrence-2',
  'ec lawrence park field 3a': 'eclawrence-3a',
  'ec lawrence park field 3b': 'eclawrence-3b',
  'arrowhead park turf field 1': 'arrowhead-1',
  'arrowhead park turf field 1a': 'arrowhead-1a',
  'arrowhead park turf field 1b': 'arrowhead-1b',
  'arrowhead park turf field 3': 'arrowhead-3',
  'arrowhead park turf field 3a': 'arrowhead-3a',
  'arrowhead park turf field 3b': 'arrowhead-3b',
  'arrowhead park turf field 3c': 'arrowhead-3c',
  'centreville high school aux field': 'centreville-hs-turf',
  'centreville high school aux filed': 'centreville-hs-turf',
  'centreville high school field 1': 'centreville-hs-turf',
  'sully highlands park field 1': 'sully-highlands-1',
  'sully highlands park field 1a': 'sully-highlands-1',
  'sully highlands park field 1b': 'sully-highlands-1',
  'sully highlands park field 2': 'sully-highlands-2',
  'sully highlands park field 2a': 'sully-highlands-2',
  'sully highlands park field 2b': 'sully-highlands-2',
  'greenbriar park field 5': 'greenbriar-5',
  'greenbriar park field 5a': 'greenbriar-5a',
  'greenbriar park field 5b': 'greenbriar-5b',
  'cunningham park field 1': 'cunningham-1',
  'nottoway park field 4a': 'nottoway-4a',
  'nottoway park field 4b': 'nottoway-4b',
  'arrowbrook park turf': 'arrowbrook-1',
  'arrowbrook park field 1': 'arrowbrook-1',
  'arrowbrook centre park field 1': 'arrowbrook-1',
  'oakmont park oak marr field 1': 'oakmont-1',
  'oakmont park oak marr field 1a': 'oakmont-1a',
  'oakmont park oak marr field 1b': 'oakmont-1b',
  'oakmont park oak marr field 1c': 'oakmont-1c',
  'oakmont park oak marr field 2': 'oakmont-2',
  'oakmont park oak marr field 2a': 'oakmont-2a',
  'oakmont park oak marr field 2b': 'oakmont-2b',
  'lake fairfax park field 1': 'lake-fairfax-1',
  'lake fairfax park field 3': 'lake-fairfax-3',
  'lake fairfax park field 4': 'lake-fairfax-4',
  'lake fairfax park field 5': 'lake-fairfax-5',
  'oakton high school stadium field': 'oakton-hs-turf',
  'oakton high school stadium': 'oakton-hs-turf',
  'oakton high school field 1': 'oakton-hs-1',
  'oakton high school field 3': 'oakton-hs-3',
  'braddock park turf field 7': 'braddock-7',
  'braddock park field 7': 'braddock-7',
  'braddock park turf field 7a': 'braddock-7a',
  'braddock park field 7a': 'braddock-7a',
  'braddock park turf field 7b': 'braddock-7b',
  'braddock park field 7b': 'braddock-7b',
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PitchScout/1.0; schedule availability checker)',
      Accept: 'text/html,application/xhtml+xml',
    } }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function normalizeLocation(value) {
  return value.toLowerCase().replace(/&amp;/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function displayTime(raw) {
  const [hourText, minute = '00'] = raw.split('-');
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return 'TBA';
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function parseLeagueCatalog(html) {
  const $ = load(html);
  const leagues = new Map();
  $('li.league').each((_, el) => {
    const sport = $(el).find('img[alt]').first().attr('alt') || '';
    if (!FIELD_SPORTS.has(sport)) return;
    const link = $(el).find('a[href*="/league/"][href*="/schedule"]').first();
    const id = link.attr('href')?.match(/\/league\/(\d+)\/schedule/)?.[1];
    if (id) leagues.set(id, { id, sport, name: link.text().replace(/\s+/g, ' ').trim() || `FXA ${sport}` });
  });
  $('.league-listing[data-leagueid][data-sport]').each((_, el) => {
    const sport = $(el).attr('data-sport') || '';
    if (!FIELD_SPORTS.has(sport)) return;
    const id = $(el).attr('data-leagueid');
    if (id) leagues.set(id, { id, sport,
      name: $(el).attr('data-leaguename') || $(el).find('.league-name').text().trim() || `FXA ${sport}` });
  });
  return [...leagues.values()];
}

export function parseLeagueSchedule(html, league, startDateStr, endDateStr) {
  const $ = load(html);
  const games = [];
  const unmappedLocations = new Set();
  const seenGameIds = new Set();
  let scheduleTables = 0;

  $('.gameDate[data-date]').each((_, dateBlock) => {
    const dateStr = $(dateBlock).attr('data-date');
    if (!dateStr || dateStr < startDateStr || dateStr > endDateStr) return;
    $(dateBlock).find('table.scheduleTable').each((__, table) => {
      scheduleTables++;
      const headers = $(table).find('th.gameField').map((___, header) => {
        const location = $(header).find('a[href^="/location/"]').first().text().trim();
        const field = $(header).find('.gameFieldName').text().replace(/\s+/g, ' ').trim();
        return `${location} ${field}`.trim();
      }).get();
      const gameFieldKeys = [];
      $(table).find('td[data-gamefield]').each((___, cell) => {
        const key = $(cell).attr('data-gamefield');
        if (key && !gameFieldKeys.includes(key)) gameFieldKeys.push(key);
      });
      const locationsByKey = Object.fromEntries(gameFieldKeys.map((key, index) => [key, headers[index]]));
      $(table).find('td[data-gid][data-gamedate]').each((___, cell) => {
        const gameId = $(cell).attr('data-gid');
        if (!gameId || seenGameIds.has(gameId)) return;
        seenGameIds.add(gameId);
        const gameDate = $(cell).attr('data-gamedate');
        if (gameDate < startDateStr || gameDate > endDateStr) return;
        const location = locationsByKey[$(cell).attr('data-gamefield')] || '';
        const fieldId = LOCATION_TO_FIELD[normalizeLocation(location)];
        if (!fieldId) {
          if (location) unmappedLocations.add(location);
          return;
        }
        const teams = $(cell).find('.scheduledTeams').text().replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
        games.push({
          fieldId,
          dateStr: gameDate,
          time: displayTime($(cell).attr('data-gametime') || ''),
          title: `${league.sport || 'Field sport'} — ${teams || league.name}`,
          location,
          source: 'FXA Sports',
          sourceUrl: `${BASE_URL}/league/${league.id}/schedule`,
          precision: 'exact_subfield',
          confidence: 'verified_live',
          status: 'scheduled',
        });
      });
    });
  });
  return { games, unmappedLocations, scheduleTables };
}

export async function fetchFxaEvents(startDate, endDate) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const byField = {};
  try {
    const catalogResponse = await httpsGet(`${BASE_URL}/schedule-finder`);
    if (catalogResponse.status !== 200) throw new Error(`league catalog returned HTTP ${catalogResponse.status}`);
    const leagues = parseLeagueCatalog(catalogResponse.body);
    if (!leagues.length) throw new Error('schedule finder contained no current outdoor field-sport leagues');
    console.log(`[FXA] Found ${leagues.length} current LeagueLab outdoor field-sport leagues`);
    let parsedSchedules = 0;
    let failedSchedules = 0;
    const unmappedLocations = new Set();

    for (let i = 0; i < leagues.length; i += 6) {
      await Promise.all(leagues.slice(i, i + 6).map(async league => {
        try {
          const response = await httpsGet(`${BASE_URL}/league/${league.id}/schedule`);
          if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
          if (!response.body.includes('leagueSchedule')) throw new Error('schedule page structure not recognized');
          const parsed = parseLeagueSchedule(response.body, league, startDateStr, endDateStr);
          parsedSchedules++;
          parsed.unmappedLocations.forEach(location => unmappedLocations.add(location));
          for (const game of parsed.games) {
            byField[game.fieldId] ??= {};
            byField[game.fieldId][game.dateStr] ??= [];
            byField[game.fieldId][game.dateStr].push({ time: game.time, title: game.title,
              location: game.location, source: game.source, sourceUrl: game.sourceUrl,
              precision: game.precision, confidence: game.confidence, status: game.status });
          }
        } catch (error) {
          failedSchedules++;
          console.warn(`[FXA] League ${league.id} (${league.name}) failed: ${error.message}`);
        }
      }));
    }

    const eventCount = Object.values(byField).reduce(
      (total, dates) => total + Object.values(dates).reduce((sum, events) => sum + events.length, 0), 0);
    if (unmappedLocations.size) console.warn(`[FXA] Unmapped scheduled venues: ${[...unmappedLocations].sort().join('; ')}`);
    const ok = parsedSchedules > 0 && failedSchedules === 0;
    return { events: byField, health: { ok, provider: 'fxa',
      message: `${parsedSchedules}/${leagues.length} LeagueLab field-sport schedules checked; ${eventCount} mapped games${unmappedLocations.size ? `; ${unmappedLocations.size} unmapped venues` : ''}`,
      eventCount, leagueCount: leagues.length, unmappedLocations: [...unmappedLocations].sort(), sourceUrl: `${BASE_URL}/schedule-finder` } };
  } catch (error) {
    console.error('[FXA] Failed:', error.message);
    return { events: byField, health: { ok: false, provider: 'fxa', message: error.message,
      eventCount: 0, sourceUrl: `${BASE_URL}/schedule-finder` } };
  }
}
