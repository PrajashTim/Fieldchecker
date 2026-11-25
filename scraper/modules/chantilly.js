/**
 * Chantilly Athletics (PlayOn) scraper
 *
 * chantillyathletics.com is a Next.js SSR + RSC app on PlayOn Sports.
 * The full event list requires JavaScript execution (RSC streaming loads
 * events after the initial HTML). We use Puppeteer to fully render the page.
 *
 * Parsing uses the JSON event objects embedded in the RSC payload
 * (see playon.js). The old data-testid="event-<n>-*" attributes were
 * removed by PlayOn in November 2026, which froze the snapshot; the
 * testid parser is kept only as a fallback.
 *
 * Returns: { 'YYYY-MM-DD': [{ time, title, location }] }
 * Only returns HOME games where the venue is Chantilly HS and sport uses the turf.
 */

import puppeteer from 'puppeteer';
import { extractPlayOnEvents, easternDateAndTime } from './playon.js';

function schoolYearFor(date = new Date()) {
  const startYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function scheduleUrl(date = new Date()) {
  return `https://www.chantillyathletics.com/schedule?year=${schoolYearFor(date)}`;
}

const TURF_SPORTS = new Set([
  'SOCCER', 'FOOTBALL', 'LACROSSE', 'FIELD HOCKEY', 'TRACK', 'RUGBY',
]);

function toISODate(dateStr, year) {
  // "Apr 21 2026" or "Apr 21"
  const s = /\d{4}/.test(dateStr) ? dateStr : `${dateStr} ${year}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function parseEventsFromTestids(html, startDateStr, endDateStr) {
  const year = parseInt(startDateStr.slice(0, 4), 10);
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

    if (!venue.toLowerCase().includes('chantilly high school')) continue;
    if (!TURF_SPORTS.has(sport)) continue;

    const dateStr = toISODate(monthDay, year);
    if (!dateStr) continue;

    if (dateStr < startDateStr || dateStr > endDateStr) continue;

    if (!events[dateStr]) events[dateStr] = [];
    const sportTitle = sport.charAt(0) + sport.slice(1).toLowerCase();
    events[dateStr].push({
      time: timeStr || 'TBA',
      title: `${level} ${sportTitle} — ${eventName}`.trim(),
      location: 'Chantilly High School',
      source: 'Chantilly athletics',
      sourceUrl: scheduleUrl(),
    });
  }

  return { events, rowsObserved: indices.size };
}

function parseEventsFromPayload(html, startDateStr, endDateStr) {
  const playonEvents = extractPlayOnEvents(html);
  const events = {};

  for (const e of playonEvents) {
    if (e.isCancelled) continue;
    const venue = e.venueName || e.locationSchool || '';
    if (!venue.toLowerCase().includes('chantilly high school')) continue;
    const sport = (e.sports[0]?.name || '').toUpperCase();
    if (!TURF_SPORTS.has(sport)) continue;

    const { date, time } = easternDateAndTime(e.startISO);
    if (!date || date < startDateStr || date > endDateStr) continue;

    const displayName = e.teams[0]?.displayName || sport.charAt(0) + sport.slice(1).toLowerCase();
    const opponent = e.schoolNames.map(s => s.name).find(n => n !== 'Chantilly High School');
    const suffix = e.eventName || (opponent ? `vs ${opponent}` : '');
    if (!events[date]) events[date] = [];
    events[date].push({
      time,
      title: suffix ? `${displayName} — ${suffix}` : displayName,
      location: 'Chantilly High School',
      source: 'Chantilly athletics',
      sourceUrl: scheduleUrl(),
    });
  }

  return { events, rowsObserved: playonEvents.length };
}

export function parseEventsFromHtml(html, startDateStr, endDateStr) {
  const fromPayload = parseEventsFromPayload(html, startDateStr, endDateStr);
  if (fromPayload.rowsObserved > 0) return fromPayload;
  return parseEventsFromTestids(html, startDateStr, endDateStr);
}

export async function fetchChantillyEvents(startDateStr, endDateStr) {
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
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36');

    const url = scheduleUrl(new Date(`${startDateStr}T12:00:00`));
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Extra wait for React streaming to complete
    await new Promise(r => setTimeout(r, 4000));

    const html = await page.content();
    const { events, rowsObserved } = parseEventsFromHtml(html, startDateStr, endDateStr);

    const total = Object.values(events).reduce((s, arr) => s + arr.length, 0);
    console.log(`[Chantilly] Found ${total} home turf events`);
    return {
      events,
      health: {
        ok: rowsObserved > 0,
        provider: 'chantilly',
        message: rowsObserved > 0
          ? `${rowsObserved} schedule rows observed for ${schoolYearFor(new Date(`${startDateStr}T12:00:00`))}`
          : 'Chantilly schedule loaded but no event rows were detected',
        eventCount: total,
      },
    };
  } catch (err) {
    console.error('[Chantilly] Error:', err.message);
    return {
      events: {},
      health: { ok: false, provider: 'chantilly', message: err.message, eventCount: 0 },
    };
  } finally {
    if (browser) await browser.close();
  }
}
