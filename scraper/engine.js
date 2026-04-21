import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
const fieldsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'fieldsConfig.json'), 'utf8'));

// Mock parsers for MVP demonstration.
const scrapePlayOn = async (page, targetId, dateStr) => {
  const hasEvent = Math.random() > 0.6; // randomly 40% chance of an event on any given day
  if (hasEvent) {
    // Show that we pick up non-soccer activities
    const types = [
      [{ time: "3:30 PM - 5:30 PM", title: "Girls Varsity Lacrosse Game" }],
      [{ time: "8:00 AM - 11:00 AM", title: "Weekend Football Camp" }, { time: "6:00 PM - 8:00 PM", title: "Boys Varsity Soccer" }],
      [{ time: "6:00 PM - 8:30 PM", title: "Varsity Field Hockey" }],
      [{ time: "8:00 AM - 10:00 AM", title: "Track & Field Meet Config" }]
    ];
    return types[Math.floor(Math.random() * types.length)];
  }
  return [];
};

const scrapeAFAR = async (page, targetId, dateStr) => {
  const hasLeagueEvent = Math.random() > 0.7; // 30% chance for parks
  if (hasLeagueEvent) {
    const types = [
      [{ time: "6:00 PM - 7:30 PM", title: "Youth Soccer Practice Permit" }],
      [{ time: "8:00 AM - 12:00 PM", title: "FXA Flag Football League matches" }],
      [{ time: "1:00 PM - 5:00 PM", title: "NCSL Soccer Tournament" }],
      [{ time: "8:00 PM - 10:00 PM", title: "Adult Rec League Matches Permit" }],
      [{ time: "8:00 AM - 11:00 AM", title: "Private Event Permit" }]
    ];
    return types[Math.floor(Math.random() * types.length)];
  }
  return [];
};

async function runScraper() {
  console.log("🚀 Starting Pitch Scout Data Aggregator (30-Day Lookahead)...");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  const outputData = {
    lastUpdated: new Date().toISOString(),
    schedule: {}
  };

  // Generate an array of 30 days (strings like "2026-04-21")
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Iterate over every date
  for (const dateStr of dates) {
    console.log(`\n📅 Scraping Schedule for ${dateStr}...`);
    outputData.schedule[dateStr] = [];

    // Iterate over every field target
    for (const field of fieldsConfig) {
      let events = [];
      let status = 'open';
      let statusReason = 'Schedule Clear';

      try {
        if (field.scraperTarget === 'playon') {
          events = await scrapePlayOn(page, field.targetId, dateStr);
        } else if (field.scraperTarget === 'afar') {
          events = await scrapeAFAR(page, field.targetId, dateStr);
        }
        
        if (events.length > 0) {
          status = 'occupied';
          statusReason = 'Scheduled Events Found';
        }
        
      } catch (e) {
        status = 'unknown';
        statusReason = 'Scraper Error';
      }

      outputData.schedule[dateStr].push({
        id: field.id,
        name: field.name,
        subfield: field.subfield,
        type: field.type,
        location: field.location,
        status: status,
        statusReason: statusReason,
        events: events
      });
    }
  }

  await browser.close();

  // Save the result
  const outputPath = path.join(__dirname, '../src/data/mockState.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log("\n✅ 30-Day Data Generation Complete! Written to src/data/mockState.json");
}

runScraper();
