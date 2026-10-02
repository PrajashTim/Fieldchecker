/**
 * High School Athletics scraper (PlayOn Sports platform)
 *
 * Covers: Centreville HS, Westfield HS
 * Same Next.js/PlayOn structure as chantilly.js — shared parser.
 *
 * Returns: { fieldId: { 'YYYY-MM-DD': [{ time, title, location }] } }
 */

import puppeteer from 'puppeteer';

const TURF_SPORTS = new Set([
  'SOCCER', 'FOOTBALL', 'LACROSSE', 'FIELD HOCKEY', 'TRACK', 'RUGBY',
]);

const SCHOOLS = [
  {
    name: 'Centreville',
    baseUrl: 'https://www.wearecville.net/schedule',
    venueSubstring: 'centreville high school',
    fieldId: 'centreville-hs-turf',
    location: 'Centreville High School',
  },
  {
    name: 'Westfield',
    baseUrl: 'https://www.westfieldathletics.org/schedule',
    venueSubstring: 'westfield high school',
    fieldId: 'westfield-hs-turf',
    location: 'Westfield High School',
  },
];

function schoolYearFor(date = new Date()) {
  const startYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function toISODate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function resolveSchoolFieldId(school, venue) {
  if (school.name !== 'Westfield') return school.fieldId;
  const text = String(venue || '').toLowerCase();
  if (/\baux\b|practice turf|rec field/.test(text)) return 'westfield-hs-turf';
  return 'westfield-hs-stadium';
}

function parseEventsFromHtml(html, school, startDateStr, endDateStr) {
  const byField = {};

  const indices = new Set(
    [...html.matchAll(/data-testid="event-(\d+)-/g)].map(m => m[1])
  );

  for (const idx of indices) {
    const get = attr => {
      const re = new RegExp(`data-testid="event-${idx}-${attr}"[^>]*>([^<]*)<`, 'i');
      const m = html.match(re);
      return m ? m[1].trim() : '';
    };

    const monthDay  = get('month-and-day');
    const timeStr   = get('time');
    const sport     = get('activity-name').toUpperCase();
    const eventName = get('event-name');
    const venue     = get('venue');
    const level     = get('gender-level');

    if (!venue.toLowerCase().includes(school.venueSubstring)) continue;
    if (!TURF_SPORTS.has(sport)) continue;

    const dateStr = toISODate(monthDay);
    if (!dateStr) continue;
    if (dateStr < startDateStr || dateStr > endDateStr) continue;

    const fieldId = resolveSchoolFieldId(school, venue);
    if (!byField[fieldId]) byField[fieldId] = {};
    if (!byField[fieldId][dateStr]) byField[fieldId][dateStr] = [];
    const sportTitle = sport.charAt(0) + sport.slice(1).toLowerCase();
    byField[fieldId][dateStr].push({
      time: timeStr || 'TBA',
      title: `${level} ${sportTitle} — ${eventName}`.trim(),
      location: school.location,
      source: `${school.name} athletics`,
      sourceUrl: `${school.baseUrl}?year=${schoolYearFor()}`,
    });
  }

  return byField;
}

export async function fetchHighSchoolEvents(startDateStr, endDateStr) {
  const byField = {};
  const health = {};
  let browser;

  try {
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOptions);

    for (const school of SCHOOLS) {
      try {
        console.log(`[HS] Scraping ${school.name}...`);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36');
        const academicYear = schoolYearFor(new Date(`${startDateStr}T12:00:00`));
        await page.goto(`${school.baseUrl}?year=${academicYear}`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        const html = await page.content();
        await page.close();

        const sourceEventCount = new Set(
          [...html.matchAll(/data-testid="event-(\d+)-/g)].map(match => match[1])
        ).size;
        const eventsByField = parseEventsFromHtml(html, school, startDateStr, endDateStr);
        const total = Object.values(eventsByField).reduce(
          (sum, dates) => sum + Object.values(dates).reduce((inner, rows) => inner + rows.length, 0),
          0,
        );
        console.log(`[HS] ${school.name}: ${total} home turf events`);

        for (const [fieldId, dates] of Object.entries(eventsByField)) {
          byField[fieldId] = dates;
        }
        const healthRow = {
          ok: sourceEventCount > 0,
          provider: school.name.toLowerCase(),
          message: sourceEventCount > 0
            ? `${sourceEventCount} schedule rows observed for ${academicYear}`
            : `${school.name} schedule loaded but no event rows were detected`,
          eventCount: total,
        };
        health[school.fieldId] = healthRow;
        if (school.name === 'Westfield') health['westfield-hs-stadium'] = healthRow;
      } catch (err) {
        console.error(`[HS] ${school.name} error:`, err.message);
        health[school.fieldId] = {
          ok: false,
          provider: school.name.toLowerCase(),
          message: err.message,
          eventCount: 0,
        };
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  return { events: byField, health };
}
