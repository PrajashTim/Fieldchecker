import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { fetchFxaEvents } from './modules/fxa.js';
import { fetchChantillyEvents } from './modules/chantilly.js';
import { fetchHighSchoolEvents } from './modules/highschools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fieldsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fieldsConfig.json'), 'utf8')
);

function localDateStr(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateRange(start, days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(localDateStr(d));
  }
  return dates;
}

async function runScraper() {
  console.log('🚀 Pitch Scout — scraping next 7 days...');

  const today = new Date();
  const todayStr = localDateStr(today);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 7);
  const endStr = localDateStr(endDate);

  const dates = dateRange(today, 7);

  // Fetch all data sources in parallel
  const [fxaByField, chantillyByDate, hsByField] = await Promise.all([
    fetchFxaEvents(today, endDate),
    fetchChantillyEvents(todayStr, endStr),
    fetchHighSchoolEvents(todayStr, endStr),
  ]);

  // Build schedule output
  const schedule = {};

  for (const dateStr of dates) {
    schedule[dateStr] = fieldsConfig.map(field => {
      let events = [];

      if (field.scraperTarget === 'fxa') {
        // FXA adult leagues + school athletics both contribute to the same field
        const fxaEvents = fxaByField[field.id]?.[dateStr] ?? [];
        const hsEvents  = hsByField[field.id]?.[dateStr] ?? [];
        events = [...fxaEvents, ...hsEvents];
      } else if (field.scraperTarget === 'chantilly') {
        const chantillyEvents = chantillyByDate[dateStr] ?? [];
        const hsEvents        = hsByField[field.id]?.[dateStr] ?? [];
        events = [...chantillyEvents, ...hsEvents];
      }

      const status = events.length > 0 ? 'occupied' : 'open';
      const statusReason = events.length > 0 ? 'Scheduled Events Found' : 'Schedule Clear';

      return {
        id: field.id,
        name: field.name,
        subfield: field.subfield,
        type: field.type,
        location: field.location,
        status,
        statusReason,
        events,
      };
    });
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    schedule,
  };

  const outputPath = path.join(__dirname, '../src/data/mockState.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written to src/data/mockState.json (${dates.length} days, ${fieldsConfig.length} fields)`);
}

runScraper().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
