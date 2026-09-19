import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { fetchFxaEvents } from './modules/fxa.js';
import { fetchChantillyEvents } from './modules/chantilly.js';
import { fetchHighSchoolEvents } from './modules/highschools.js';
import { fetchFcDullesEvents } from './modules/fcdulles.js';
import { fetchNcslEvents } from './modules/ncsl.js';

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

function withSchoolSource(events, source, sourceUrl) {
  return (events || []).map(event => (
    event.source ? event : { ...event, source, sourceUrl }
  ));
}

function schoolEventsByDate(snapshot, fieldId) {
  const events = {};
  if (!snapshot?.schedule) return events;
  for (const [dateStr, fields] of Object.entries(snapshot.schedule)) {
    const field = fields.find(item => item.id === fieldId);
    const rows = withSchoolSource(
      (field?.events || []).filter(event => event.source !== 'FXA Sports' && event.source !== 'NCSL'),
      fieldId === 'chantilly-hs-turf' ? 'Chantilly athletics' : 'School athletics',
      fieldId === 'chantilly-hs-turf' ? 'https://www.chantillyathletics.com/schedule' : undefined,
    );
    if (rows.length) events[dateStr] = rows;
  }
  return events;
}

function schoolEventsByField(snapshot, fieldId) {
  const byDate = {};
  if (!snapshot?.schedule) return byDate;
  const source = fieldId.startsWith('westfield') ? 'Westfield athletics' : 'Centreville athletics';
  const sourceUrl = fieldId.startsWith('westfield')
    ? 'https://www.westfieldathletics.org/schedule'
    : 'https://www.wearecville.net/schedule';
  for (const [dateStr, fields] of Object.entries(snapshot.schedule)) {
    const field = fields.find(item => item.id === fieldId);
    const rows = withSchoolSource(
      (field?.events || []).filter(event => event.source !== 'FXA Sports' && event.source !== 'NCSL'),
      source,
      sourceUrl,
    );
    if (rows.length) {
      byDate[dateStr] = rows;
    }
  }
  return byDate;
}

async function runScraper() {
  console.log('🚀 Pitch Scout — rebuilding the rolling 30-day window...');

  const today = new Date();
  const todayStr = localDateStr(today);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 30);
  const endStr = localDateStr(endDate);

  const dates = dateRange(today, 30);

  // Fetch all data sources in parallel
  const skipBrowser = process.env.SKIP_BROWSER === '1';
  const previousPath = path.join(__dirname, '../src/data/mockState.json');
  const previous = skipBrowser && fs.existsSync(previousPath)
    ? JSON.parse(fs.readFileSync(previousPath, 'utf8'))
    : null;

  const emptyHealth = (provider, message) => ({ events: {}, health: { ok: false, provider, message, eventCount: 0 } });

  const [fxaResult, chantillyResult, hsResult, fcDullesResult, ncslResult] = await Promise.all([
    fetchFxaEvents(today, endDate),
    skipBrowser
      ? Promise.resolve({
          events: schoolEventsByDate(previous, 'chantilly-hs-turf'),
          health: previous?.sourceHealth?.chantilly || { ok: true, provider: 'chantilly', message: 'Reused previous athletics snapshot', eventCount: 0 },
        })
      : fetchChantillyEvents(todayStr, endStr).catch(error => emptyHealth('chantilly', error.message)),
    skipBrowser
      ? Promise.resolve({
          events: {
            'centreville-hs-turf': schoolEventsByField(previous, 'centreville-hs-turf'),
            'westfield-hs-turf': schoolEventsByField(previous, 'westfield-hs-turf'),
          },
          health: {
            'centreville-hs-turf': previous?.sourceHealth?.['centreville-hs-turf'],
            'westfield-hs-turf': previous?.sourceHealth?.['westfield-hs-turf'],
          },
        })
      : fetchHighSchoolEvents(todayStr, endStr).catch(error => ({
          events: {},
          health: {
            'centreville-hs-turf': { ok: false, provider: 'centreville', message: error.message, eventCount: 0 },
            'westfield-hs-turf': { ok: false, provider: 'westfield', message: error.message, eventCount: 0 },
          },
        })),
    fetchFcDullesEvents(todayStr, endStr),
    fetchNcslEvents(todayStr, endStr),
  ]);

  const fxaByField = fxaResult.events;
  const chantillyByDate = chantillyResult.events;
  const hsByField = hsResult.events;
  const sourceHealth = {
    fxa: fxaResult.health,
    chantilly: chantillyResult.health,
    ...hsResult.health,
    fcDulles: fcDullesResult.health,
    ncsl: ncslResult.health,
    countyPermits: {
      ok: false,
      provider: 'fairfax-county-permits',
      message: 'Fairfax County/FCPS permit calendars are not published as a public schedule feed',
      eventCount: 0,
      sourceUrl: 'https://www.fairfaxcounty.gov/neighborhood-community-services/athletics/permit-application',
    },
  };

  // Never publish a fresh-looking snapshot when a critical public feed broke.
  // GitHub Actions will retry the entire scrape and visibly fail if all retries
  // are exhausted, preserving the last known-good snapshot in production.
  const criticalSources = ['fxa', 'chantilly', 'centreville-hs-turf', 'westfield-hs-turf'];
  const failedCriticalSources = criticalSources.filter(source => !sourceHealth[source]?.ok);
  if (failedCriticalSources.length) {
    throw new Error(`Critical source validation failed: ${failedCriticalSources.join(', ')}`);
  }

  // Build schedule output
  const schedule = {};

  for (const dateStr of dates) {
    schedule[dateStr] = fieldsConfig.map(field => {
      // Gather events from all provider sources
      const fxaEvents = fxaByField[field.id]?.[dateStr] ?? [];
      const hsEvents  = hsByField[field.id]?.[dateStr] ?? [];
      const ncslEvents = ncslResult.events[field.id]?.[dateStr] ?? [];
      let events = [...fxaEvents, ...hsEvents, ...ncslEvents];

      if (field.id === 'poplar-tree-2') {
        events = [...events, ...(fcDullesResult.events[dateStr] ?? [])];
      }

      if (field.scraperTarget === 'chantilly') {
        const chantillyEvents = chantillyByDate[dateStr] ?? [];
        events = [...events, ...chantillyEvents];
      }

      // FXA is only one renter. County/FCPS permits are the controlling source
      // for community use, so a quiet FXA schedule cannot prove availability.
      const relevantHealth = [sourceHealth.fxa, sourceHealth.countyPermits];
      if (field.id === 'chantilly-hs-turf') relevantHealth.push(sourceHealth.chantilly);
      if (field.id === 'centreville-hs-turf') relevantHealth.push(sourceHealth['centreville-hs-turf']);
      if (field.id === 'westfield-hs-turf') relevantHealth.push(sourceHealth['westfield-hs-turf']);
      if (field.id === 'poplar-tree-2') relevantHealth.push(sourceHealth.fcDulles, sourceHealth.ncsl);

      const unavailableSources = relevantHealth.filter(item => !item?.ok);
      const status = events.length > 0
        ? 'occupied'
        : unavailableSources.length === 0 ? 'open' : 'unknown';
      const statusReason = events.length > 0
        ? 'Known conflict from a connected public schedule'
        : unavailableSources.length === 0
          ? 'No conflict found in connected sources. This is not a reservation or guarantee of access.'
          : `Not verified — ${unavailableSources.map(item => item?.provider || 'source').join(', ')} unavailable. A missing event is not evidence the field is free.`;

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
    coverageStart: todayStr,
    coverageEnd: endStr,
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
