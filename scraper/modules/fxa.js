/**
 * FXA Sports / LeagueApps scraper
 *
 * Strategy:
 * 1. Hit api.fxasports.com to get all active leagues for the nova site
 * 2. For each league, fetch the LeagueApps schedule HTML for the next 7 days
 * 3. Parse game date, time, location from the HTML
 * 4. Map location strings to our field IDs
 *
 * Returns: Map of fieldId → Map of dateStr (YYYY-MM-DD) → event[]
 */

import https from 'https';

const FXA_API_KEY = 'asd2wsdasdasdasdasdasdgasdgxvasd';
const NOVA_SITE_ID = 15768;

// Maps FXA location name → our field ID(s)
// Ordered roughly by distance from Chantilly HS
const LOCATION_TO_FIELD = {
  // Chantilly HS — FXA adult leagues also book the stadium
  'Chantilly High School (Stadium Field)':  'chantilly-hs-turf',
  // Stringfellow Park (0.5 mi)
  'Stringfellow Park':                 'stringfellow-1',
  'Stringfellow Park (Field 1)':       'stringfellow-1',
  'Stringfellow Park (Turf Front)':    'stringfellow-1',
  // Poplar Tree Park (1.1 mi)
  'Poplar Tree Park (Field 2)':        'poplar-tree-2',
  'Poplar Tree Park (Field 3)':        'poplar-tree-3',
  // Westfield HS (1.3 mi)
  'Westfield High School (Aux Field 1)':   'westfield-hs-turf',
  'Westfield High School (Stadium Field)': 'westfield-hs-turf',
  // EC Lawrence Park (1.4 mi)
  'EC Lawrence Park (Field 2)':        'eclawrence-2',
  'EC Lawrence Park (Field 3A)':       'eclawrence-3a',
  'EC Lawrence Park (Field 3B)':       'eclawrence-3b',
  // Arrowhead Park (2.3 mi) — FXA uses "Arrowhead Park Turf (Field X)" format
  'Arrowhead Park Turf':               'arrowhead-1',
  'Arrowhead Park Turf (Field 1)':     'arrowhead-1',
  'Arrowhead Park Turf (Field 1A)':    'arrowhead-1a',
  'Arrowhead Park Turf (Field 1B)':    'arrowhead-1b',
  'Arrowhead Park Turf (Field 3)':     'arrowhead-3',
  'Arrowhead Park Turf (Field 3A)':    'arrowhead-3a',
  'Arrowhead Park Turf (Field 3B)':    'arrowhead-3b',
  'Arrowhead Park Turf (Field 3C)':    'arrowhead-3c',
  // Centreville HS (2.5 mi)
  'Centreville High School (Aux Field)':   'centreville-hs-turf',
  // Sully Highlands Park (3.5 mi)
  'Sully Highlands Park (Field 1)':    'sully-highlands-1',
  'Sully Highlands Park (Field 1A)':   'sully-highlands-1',
  'Sully Highlands Park (Field 1B)':   'sully-highlands-1',
  'Sully Highlands Park (Field 2)':    'sully-highlands-2',
  'Sully Highlands Park (Field 2A)':   'sully-highlands-2',
  'Sully Highlands Park (Field 2B)':   'sully-highlands-2',
  // Greenbriar Park (3.6 mi)
  'Greenbriar Park (Field 5)':         'greenbriar-5',
  'Greenbriar Park (Field 5A)':        'greenbriar-5a',
  'Greenbriar Park (Field 5B)':        'greenbriar-5b',
  // Cunningham Park (4.0 mi)
  'Cunningham Park (Field 1)':         'cunningham-1',
  // Nottoway Park (5.2 mi)
  'Nottoway Park (Field 4A)':          'nottoway-4a',
  'Nottoway Park (Field 4B)':          'nottoway-4b',
  // Arrowbrook Park (5.3 mi)
  'Arrowbrook Park Turf':              'arrowbrook-1',
  // OakMont Park / Oak Marr (5.9 mi)
  'OakMont Park (Oak Marr) (Field 1)':  'oakmont-1',
  'OakMont Park (Oak Marr) (Field 1A)': 'oakmont-1a',
  'OakMont Park (Oak Marr) (Field 1B)': 'oakmont-1b',
  'OakMont Park (Oak Marr) (Field 1C)': 'oakmont-1c',
  'OakMont Park (Oak Marr) (Field 2)':  'oakmont-2',
  'OakMont Park (Oak Marr) (Field 2A)': 'oakmont-2a',
  'OakMont Park (Oak Marr) (Field 2B)': 'oakmont-2b',
  // Lake Fairfax Park (7.7 mi)
  'Lake Fairfax Park (Field 1)':       'lake-fairfax-1',
  'Lake Fairfax Park (Field 3)':       'lake-fairfax-3',
  'Lake Fairfax Park (Field 4)':       'lake-fairfax-4',
  'Lake Fairfax Park (Field 5)':       'lake-fairfax-5',
  // Bready Park (8.4 mi)
  'Bready Park (Field 1A)':            'bready-1a',
  'Bready Park (Field 1B)':            'bready-1b',
  // Braddock Park (9.2 mi)
  'Braddock Park Turf (Field 7)':      'braddock-7',
  'Braddock Park Turf (Field 7A)':     'braddock-7a',
  'Braddock Park Turf (Field 7B)':     'braddock-7b',
  // South County HS (15.8 mi)
  'South County High School (Aux Field)': 'south-county-hs-turf',
};

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
          'Accept': 'text/html,application/json,*/*',
          ...extraHeaders,
        },
      },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchActiveLeagues() {
  // API uses 0-based page numbers; currentPage in response tells us what page was returned
  const all = [];
  let page = 0;
  while (true) {
    const url =
      `https://api.fxasports.com/dynamic/getLeagues` +
      `?sign_up=1&perPage=100&siteId=${NOVA_SITE_ID}` +
      `&state[0]=UPCOMING&state[1]=LIVE&paginated=true&page=${page}`;

    const { body } = await httpsGet(url, { apiKey: FXA_API_KEY });
    const json = JSON.parse(body);
    const batch = json.data || [];
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
    if (page > 10) break; // safety cap
  }
  return all;
}

function parseDateStr(dayStr, year) {
  // dayStr like "Mon, Apr 27"
  const d = new Date(`${dayStr} ${year}`);
  if (isNaN(d)) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function parseScheduleHtml(html, year) {
  const games = [];
  const blocks = html.split(/class="schedule-game/i);

  for (const block of blocks.slice(1)) {
    const dateMatch = block.match(/<span class="date">\s*([^<]+)\s*<\/span>/i);
    const timeMatch = block.match(/<span class="time">([\s\S]{0,400}?)<\/span>/i);
    const locMatch  = block.match(/<a href="\/location\/\d+"[^>]*>([^<]+)<\/a>/i);

    if (!dateMatch || !locMatch) continue;

    const dateStr = parseDateStr(dateMatch[1].trim(), year);
    if (!dateStr) continue;

    let time = 'TBA';
    if (timeMatch) {
      const raw = timeMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const tm = raw.match(/\d{1,2}:\d{2}\s*[AP]M/i);
      if (tm) time = tm[0];
    }

    const location = locMatch[1].trim();
    const cancelled = /class="[^"]*cancel/i.test(block) || /<span[^>]*>Cancelled/i.test(block);

    games.push({ dateStr, time, location, cancelled });
  }
  return games;
}

async function fetchLeagueSchedule(programId, startDate, endDate, year) {
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  const qs = new URLSearchParams({
    origin: 'site',
    scope: 'program',
    publishedOnly: 'true',
    itemType: 'games_only',
    programId: String(programId),
    startsAfterDate: fmt(startDate),
    startsBeforeDate: fmt(endDate),
  });

  const { status, body } = await httpsGet(
    `https://fxasports.leagueapps.com/ajax/loadSchedule?${qs}`,
    { 'X-Requested-With': 'XMLHttpRequest' }
  );

  if (status !== 200) return [];
  return parseScheduleHtml(body, year);
}

/**
 * Main export.
 * Returns: { fieldId: { 'YYYY-MM-DD': [{ time, title, location, cancelled }] } }
 */
export async function fetchFxaEvents(startDate, endDate) {
  const year = startDate.getFullYear();
  const byField = {};
  const unmappedLocations = new Set();

  let leagues;
  try {
    leagues = await fetchActiveLeagues();
  } catch (err) {
    console.error('[FXA] Failed to fetch leagues:', err.message);
    return byField;
  }

  console.log(`[FXA] Found ${leagues.length} active leagues`);

  // Fetch schedules in parallel batches of 5
  const BATCH = 5;
  for (let i = 0; i < leagues.length; i += BATCH) {
    const batch = leagues.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async league => {
        const id = league.leagueProgramId;
        const name = league.leagueName || league.leagueNames || 'League';
        try {
          const games = await fetchLeagueSchedule(id, startDate, endDate, year);
          for (const game of games) {
            if (game.cancelled) continue;

            const fieldId = LOCATION_TO_FIELD[game.location];
            if (!fieldId) { unmappedLocations.add(game.location); continue; }

            if (!byField[fieldId]) byField[fieldId] = {};
            if (!byField[fieldId][game.dateStr]) byField[fieldId][game.dateStr] = [];

            byField[fieldId][game.dateStr].push({
              time: game.time,
              title: name.split('|')[0].trim(),
              location: game.location,
            });
          }
        } catch (err) {
          console.warn(`[FXA] League ${id} error: ${err.message}`);
        }
      })
    );
  }

  if (unmappedLocations.size > 0) {
    console.log('[FXA] Unmapped locations (games ignored):');
    [...unmappedLocations].sort().forEach(loc => console.log(`  - "${loc}"`));
  }

  return byField;
}
