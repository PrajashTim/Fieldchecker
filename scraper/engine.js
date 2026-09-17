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
  endDate.setDate(today.getDate() + 30);
  const endStr = localDateStr(endDate);

  const dates = dateRange(today, 30);

  // Fetch all data sources in parallel
  const [fxaResult, chantillyResult, hsResult] = await Promise.all([
    fetchFxaEvents(today, endDate),
    fetchChantillyEvents(todayStr, endStr),
    fetchHighSchoolEvents(todayStr, endStr),
  ]);

  const fxaByField = fxaResult.events;
  const chantillyByDate = chantillyResult.events;
  const hsByField = hsResult.events;
  const sourceHealth = {
    fxa: fxaResult.health,
    chantilly: chantillyResult.health,
    ...hsResult.health,
  };

  // Build schedule output
  const schedule = {};

  for (const dateStr of dates) {
    schedule[dateStr] = fieldsConfig.map(field => {
      // Gather events from all provider sources
      const fxaEvents = fxaByField[field.id]?.[dateStr] ?? [];
      const hsEvents  = hsByField[field.id]?.[dateStr] ?? [];
      let events = [...fxaEvents, ...hsEvents];

      if (field.scraperTarget === 'chantilly') {
        const chantillyEvents = chantillyByDate[dateStr] ?? [];
        events = [...events, ...chantillyEvents];
      }

      const relevantHealth = [sourceHealth.fxa];
      if (field.id === 'chantilly-hs-turf') relevantHealth.push(sourceHealth.chantilly);
      if (field.id === 'centreville-hs-turf') relevantHealth.push(sourceHealth['centreville-hs-turf']);
      if (field.id === 'westfield-hs-turf') relevantHealth.push(sourceHealth['westfield-hs-turf']);

      const unavailableSources = relevantHealth.filter(item => !item?.ok);
      const status = events.length > 0
        ? 'occupied'
        : unavailableSources.length === 0 ? 'open' : 'unknown';
      const statusReason = events.length > 0
        ? 'Scheduled events found'
        : unavailableSources.length === 0
          ? 'No conflicts found in connected sources'
          : `Not verified — ${unavailableSources.map(item => item?.provider || 'source').join(', ')} unavailable`;

      return {
        id: field.id,
        name: field.name,
        subfield: field.subfield,
        type: field.type,
        location: field.location,
        status,
        statusReason,
        events,
        unavailableSources: unavailableSources.map(item => item?.provider || 'unknown'),
      };
    });
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    sourceHealth,
    schedule,
  };

  const outputPath = path.join(__dirname, '../src/data/mockState.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written to src/data/mockState.json (${dates.length} days, ${fieldsConfig.length} fields)`);
  console.log(`   Coverage: ${todayStr} → ${endStr}`);
  for (const [source, health] of Object.entries(sourceHealth)) {
    console.log(`   ${health?.ok ? 'OK' : 'DEGRADED'} ${source}: ${health?.message || 'No health report'}`);
  }
}

runScraper().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
