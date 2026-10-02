import fs from 'node:fs';
import path from 'node:path';

const csvPath = process.argv[2] || 'E:/Chrome Downloads/loudoun-prcs-field-schedule-2026.csv';
const outPath = path.resolve('scraper/data/loudounReservations.json');

const PITCHES = [
  { id: 'freedom-hs-turf', code: 'XFRHS', field: 'TURF1', name: 'Freedom High School', pitch: 'Stadium Turf', surface: 'Turf', location: 'South Riding, VA' },
  { id: 'champe-hs-turf', code: 'XJCHS', field: 'TURF1', name: 'John Champe High School', pitch: 'Stadium Turf', surface: 'Turf', location: 'Aldie, VA' },
  { id: 'champe-hs-turf-2', code: 'XJCHS', field: 'TURF2', name: 'John Champe High School', pitch: 'Turf 2', surface: 'Turf', location: 'Aldie, VA' },
  { id: 'hanson-1', code: 'HANSON', field: 'FLD18', name: 'Hal and Berni Hanson Regional Park', pitch: 'RF1 Turf', surface: 'Turf', location: 'Brambleton, VA' },
  { id: 'hanson-2', code: 'HANSON', field: 'FLD19', name: 'Hal and Berni Hanson Regional Park', pitch: 'RF2 Turf', surface: 'Turf', location: 'Brambleton, VA' },
  { id: 'bolen-18', code: 'BOLEN', field: 'Crick18', name: 'Philip A. Bolen Park', pitch: 'Turf 18', surface: 'Turf', location: 'Leesburg, VA' },
  { id: 'bolen-19', code: 'BOLEN', field: 'Crick19', name: 'Philip A. Bolen Park', pitch: 'Turf 19', surface: 'Turf', location: 'Leesburg, VA' },
];

function parseLine(line) {
  const cols = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { cols.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

function toYmd(mdy) {
  const [m, d, y] = mdy.split('/').map(Number);
  if (!y || !m || !d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toMinutes(clock) {
  const match = (clock || '').trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3] === 'pm') hours += 12;
  return hours * 60 + Number(match[2]);
}

function cleanTitle(raw) {
  let title = (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d{3}[).]?\d{2,3}[).]?\d{4}\b/g, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/^,+|,+$/g, '')
    .trim();
  if (!title) return 'Reserved practice';
  if (/loudoun soccer/i.test(title)) return 'Loudoun Soccer practice';
  if (/adult sports practices/i.test(title)) return 'Adult sports practice';
  if (/odfc/i.test(title)) return 'ODFC soccer';
  return title.replace(/,$/, '').trim();
}

function clockLabel(total) {
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

const byKey = new Map(PITCHES.map((item) => [`${item.code}|${item.field.toLowerCase()}`, item]));
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const days = {};
let kept = 0;

for (const line of lines.slice(1)) {
  const cols = parseLine(line);
  const date = toYmd(cols[0]);
  const start = toMinutes(cols[1]);
  const end = toMinutes(cols[2]);
  const ftype = (cols[3] || '').trim();
  const code = (cols[4] || '').trim();
  const field = (cols[6] || '').trim();
  const purpose = cols[7] || '';
  if (!date || start == null || end == null) continue;
  if (/middle/i.test(cols[5] || '')) continue;
  const pitch = byKey.get(`${code}|${field.toLowerCase()}`);
  if (!pitch) continue;
  if (code === 'XFRHS' || code === 'XJCHS') {
    if (!/^TURF/i.test(ftype)) continue;
  }
  const event = {
    id: pitch.id,
    start,
    end,
    time: `${clockLabel(start)} – ${clockLabel(end)}`,
    title: cleanTitle(purpose),
  };
  if (!days[date]) days[date] = [];
  days[date].push(event);
  kept += 1;
}

for (const date of Object.keys(days)) {
  const seen = new Set();
  days[date] = days[date].filter((item) => {
    const key = `${item.id}|${item.start}|${item.end}|${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const payload = {
  source: 'Loudoun County PRCS field reservations 2026',
  lastUpdated: new Date().toISOString().slice(0, 10),
  pitches: PITCHES.map(({ id, name, pitch, surface, location }) => ({ id, name, pitch, surface, location })),
  days,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));
console.log('events', kept, 'dates', Object.keys(days).length, 'bytes', fs.statSync(outPath).size);
