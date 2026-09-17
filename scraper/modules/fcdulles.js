/** Public FC Dulles programs with an explicitly published field/date/time. */
import { load } from 'cheerio';

const SOURCE_URL = 'https://www.fcdulles.org/grassroots-rec-u5-u10/';

function localDateStr(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function parsePublishedDate(text) {
  const date = new Date(`${text} 12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFcDullesPrograms(html, windowStart, windowEnd) {
  const text = load(html).text().replace(/\s+/g, ' ');
  const startMatch = text.match(/Starts?\s+(Sept?\.?\s+\d{1,2},\s+\d{4})/i);
  const endMatch = text.match(/(Oct\.?\s+\d{1,2},\s+\d{4})\s*-\s*Last day of Free-play/i);
  const fieldMatch = text.match(/Fridays,\s*(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*(AM|PM):\s*Poplar Tree Park\s*#?2/i);
  if (!startMatch || !endMatch || !fieldMatch) throw new Error('published Fall program structure changed');

  const programStart = parsePublishedDate(startMatch[1]);
  const programEnd = parsePublishedDate(endMatch[1]);
  if (!programStart || !programEnd) throw new Error('published program dates could not be parsed');

  const holidayDates = new Set();
  const holidayMatch = text.match(/Oct\.?\s+(\d{1,2}),\s*(\d{1,2})\s*&\s*(\d{1,2}),\s*(\d{4})[^.]*no events/i);
  if (holidayMatch) {
    for (const day of holidayMatch.slice(1, 4)) holidayDates.add(`${holidayMatch[4]}-10-${String(day).padStart(2, '0')}`);
  }

  const events = {};
  for (const date = new Date(programStart); date <= programEnd; date.setDate(date.getDate() + 7)) {
    const dateStr = localDateStr(date);
    if (dateStr < windowStart || dateStr > windowEnd || holidayDates.has(dateStr)) continue;
    events[dateStr] = [{
      time: `${fieldMatch[1]} ${fieldMatch[3].toUpperCase()}`,
      title: 'Soccer — FC Dulles REC Academy Friday Free Play',
      location: 'Poplar Tree Park Field 2',
      source: 'FC Dulles',
      sourceUrl: SOURCE_URL,
      precision: 'exact_subfield',
      confidence: 'index',
      status: 'scheduled',
    }];
  }
  return events;
}

export async function fetchFcDullesEvents(windowStart, windowEnd) {
  try {
    const response = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'PitchScout/1.0 schedule availability checker' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const events = parseFcDullesPrograms(await response.text(), windowStart, windowEnd);
    const eventCount = Object.values(events).reduce((sum, rows) => sum + rows.length, 0);
    return { events, health: { ok: true, provider: 'fc-dulles',
      message: `Published Fall program checked; ${eventCount} Poplar Tree #2 sessions in range`, eventCount, sourceUrl: SOURCE_URL } };
  } catch (error) {
    return { events: {}, health: { ok: false, provider: 'fc-dulles', message: error.message, eventCount: 0, sourceUrl: SOURCE_URL } };
  }
}
