import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

// Import Scraper Modules
import { scrapeVNN } from './modules/vnn.js';
import { scrapeLeagueApps } from './modules/fxa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
const fieldsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'fieldsConfig.json'), 'utf8'));

// Parsers imported from modules

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
        if (field.scraperTarget === 'playon' || field.scraperTarget === 'vnn') {
          // Pass the high school website domains
          let domain = 'chantillyathletics.com'; 
          if(field.targetId.includes('centreville')) domain = 'centrevilleathletics.com';
          if(field.targetId.includes('westfield')) domain = 'westfieldathletics.com';
          
          events = await scrapeVNN(page, domain, dateStr);
          
        } else if (field.scraperTarget === 'afar' || field.scraperTarget === 'league') {
          // Pass the league domains for park fields
          events = await scrapeLeagueApps(page, "fxasports.com", dateStr);
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
