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
    url: 'https://www.wearecville.net/schedule?year=2025-2026',
    venueSubstring: 'centreville high school',
    fieldId: 'centreville-hs-turf',
    location: 'Centreville High School',
  },
  {
    name: 'Westfield',
    url: 'https://www.westfieldathletics.org/schedule?year=2025-2026',
    venueSubstring: 'westfield high school',
    fieldId: 'westfield-hs-turf',
    location: 'Westfield High School',
  },
];

function toISODate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function parseEventsFromHtml(html, school, startDateStr, endDateStr) {
  const events = {};

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

    if (!events[dateStr]) events[dateStr] = [];
    const sportTitle = sport.charAt(0) + sport.slice(1).toLowerCase();
    events[dateStr].push({
      time: timeStr || 'TBA',
      title: `${level} ${sportTitle} — ${eventName}`.trim(),
      location: school.location,
    });
  }

  return events;
}

export async function fetchHighSchoolEvents(startDateStr, endDateStr) {
  const byField = {};
  let browser;

  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

    for (const school of SCHOOLS) {
      try {
        console.log(`[HS] Scraping ${school.name}...`);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36');
        await page.goto(school.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        const html = await page.content();
        await page.close();

        const events = parseEventsFromHtml(html, school, startDateStr, endDateStr);
        const total = Object.values(events).reduce((s, a) => s + a.length, 0);
        console.log(`[HS] ${school.name}: ${total} home turf events`);

        if (total > 0) {
          byField[school.fieldId] = events;
        }
      } catch (err) {
        console.error(`[HS] ${school.name} error:`, err.message);
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  return byField;
}
