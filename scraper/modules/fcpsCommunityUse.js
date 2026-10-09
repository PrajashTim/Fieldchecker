/**
 * FCPS Community Use guest calendar for the four high schools in the catalog.
 * Read-only. Park fields are not on this calendar.
 */
import https from 'https';

const HOME = 'https://www.communityuse.com/default.asp?acctnum=738652987';
const LIST = 'https://www.communityuse.com/SOA.NET/Controllers/PageController.aspx?productid=MC&pageid=CalendarEventList';
const SOURCE = 'FCPS Community Use';

const SCHOOLS = [
  { name: 'Chantilly High School', locId: '12916' },
  { name: 'Centreville High School', locId: '12915' },
  { name: 'Oakton High School', locId: '12913' },
  { name: 'Westfield High School', locId: '11863' },
];

const ROOM_RULES = [
  { school: 'Chantilly High School', test: /stadium field\/track \(turf\)/, id: 'chantilly-hs-turf' },
  { school: 'Centreville High School', test: /stadium field\/track \(turf\)/, id: 'centreville-hs-stadium' },
  { school: 'Centreville High School', test: /rectangular field #1 \(turf\)/, id: 'centreville-hs-turf' },
  { school: 'Oakton High School', test: /stadium field\/track \(turf\)/, id: 'oakton-hs-turf' },
  { school: 'Oakton High School', test: /rectangular field #1 \(adjacent to stadium\)/, id: 'oakton-hs-1' },
  { school: 'Oakton High School', test: /rectangular field #3 \(turf\)/, id: 'oakton-hs-3' },
  { school: 'Westfield High School', test: /^stadium field \(turf\)/, id: 'westfield-hs-stadium' },
  { school: 'Westfield High School', test: /rectangular field #1\/track \(turf\)/, id: 'westfield-hs-turf' },
];

export const FCPS_FIELD_IDS = new Set(ROOM_RULES.map(rule => rule.id));

function createClient() {
  const jar = new Map();
  function store(res) {
    for (const line of res.headers['set-cookie'] || []) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  function request(url, { method = 'GET', body = null } = {}, redirects = 0) {
    return new Promise((resolve, reject) => {
      const target = new URL(url);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; PitchScout/1.0; field schedule checker)',
        Accept: 'text/html',
        Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
      };
      if (body) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(body);
        headers.Referer = LIST;
      }
      const req = https.request({
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      }, res => {
        store(res);
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 6) {
          res.resume();
          request(new URL(res.headers.location, url).toString(), {}, redirects + 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          url,
        }));
      });
      req.on('error', reject);
      req.setTimeout(45000, () => {
        req.destroy();
        reject(new Error(`timeout fetching ${url}`));
      });
      if (body) req.write(body);
      req.end();
    });
  }
  return { request };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decode(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function formBody(html, extra) {
  const params = new URLSearchParams();
  for (const match of html.matchAll(/<input[^>]*>/gi)) {
    const tag = match[0];
    const name = tag.match(/name="([^"]+)"/)?.[1];
    if (!name || /type="(image|submit|button)"/i.test(tag)) continue;
    const quoted = tag.match(/value\s*=\s*"([^"]*)"/) || tag.match(/value\s*=\s*'([^']*)'/);
    params.set(name, decode(quoted?.[1] || ''));
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
}

function formAction(html, fallback) {
  const action = html.match(/<form[^>]*action="([^"]+)"/i)?.[1];
  if (!action) return fallback;
  return new URL(action.replace(/&amp;/g, '&'), fallback).toString();
}

function parseRows(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr class="(?:alt)?row">([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cell => (
      decode(cell[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    ));
    const dateMatch = (cells[1] || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    rows.push({
      eventId: match[1].match(/EventID=(\d+)/)?.[1] || '',
      title: cells[0] || '',
      date: dateMatch
        ? `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`
        : '',
      time: cells[2] || '',
      location: (cells[3] || '').replace(/\s+/g, ' ').trim(),
      room: cells[4] || '',
    });
  }
  return rows;
}

function fieldIdsFor(location, room) {
  const school = location.replace(/\s+/g, ' ').trim();
  const chunks = room.split(',').map(part => part.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
  const ids = new Set();
  for (const chunk of chunks) {
    for (const rule of ROOM_RULES) {
      if (rule.school === school && rule.test.test(chunk)) ids.add(rule.id);
    }
  }
  return [...ids];
}

function clockLabel(raw) {
  const clocks = [...String(raw).matchAll(/(\d{1,2}):(\d{2})\s*([AP]M)/gi)];
  if (!clocks.length) return raw || 'TBA';
  const label = match => `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`;
  if (clocks.length === 1) return label(clocks[0]);
  return `${label(clocks[0])} – ${label(clocks[1])}`;
}

function spanText(html, id) {
  const match = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/`));
  return decode((match?.[1] || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

async function popupDetails(client, eventId) {
  const popup = await client.request(
    `https://www.communityuse.com/SOA.NET/Controllers/DialogController.aspx?productId=MC&pageId=EventPopUpDialog&EventID=${eventId}`
  );
  if (popup.status !== 200) return { organization: '', scheduleId: '' };
  return {
    organization: spanText(popup.body, 'OrganizationUXLabel'),
    scheduleId: spanText(popup.body, 'SchedulIDUXLabel'),
    title: spanText(popup.body, 'EventTitleUXLabel'),
  };
}

function displayTitle(row, info) {
  const rawTitle = (info.title && info.title.length > row.title.length ? info.title : row.title) || 'Reserved';
  const permit = rawTitle.trim().startsWith('*');
  const title = rawTitle.replace(/^\*/, '').replace(/\s+/g, ' ').trim() || 'Reserved';
  const org = (info.organization || '').replace(/\s+/g, ' ').trim();
  if (permit) return org ? `${org} permit` : `${title} permit`;
  if (org && org.toLowerCase() !== title.toLowerCase()) return `${title} — ${org}`;
  return title;
}

async function listSchool(school, startDate, endDate) {
  const client = createClient();
  await client.request(HOME);
  await sleep(250);
  let page = await client.request(LIST);
  await sleep(250);
  page = await client.request(formAction(page.body, LIST), {
    method: 'POST',
    body: formBody(page.body, {
      'ctl17$uxLocationDropDown$uXListBox': school.locId,
      'ctl17$uxLocationDropDown$hidden': `${school.locId}*${school.name}%%`,
      'ctl17$btnFilter': 'Filter',
    }),
  });
  await sleep(250);
  page = await client.request(formAction(page.body, page.url), {
    method: 'POST',
    body: formBody(page.body, { __EVENTTARGET: 'ctl19$lvEventList$TopPageSize100' }),
  });
  const total = Number(page.body.match(/of total <span class="count">(\d+)<\/span>/)?.[1] || 0);
  const seen = new Set();
  const kept = [];
  const unmappedTurf = new Set();
  let guard = 0;
  while (page.status === 200 && guard < 40) {
    guard += 1;
    for (const row of parseRows(page.body)) {
      if (!row.eventId || seen.has(row.eventId)) continue;
      seen.add(row.eventId);
      if (!row.date || row.date < startDate || row.date > endDate) continue;
      const ids = fieldIdsFor(row.location, row.room);
      if (!ids.length) {
        if (/turf|stadium|rectangular field/i.test(row.room)) unmappedTurf.add(row.room);
        continue;
      }
      kept.push({ ...row, fieldIds: ids });
    }
    if (seen.size >= total || total === 0) break;
    if (!/TopNextPagerButton/.test(page.body) || /TopNextPagerButton"[^>]*disabled/.test(page.body)) break;
    await sleep(200);
    page = await client.request(formAction(page.body, page.url), {
      method: 'POST',
      body: formBody(page.body, { __EVENTTARGET: 'ctl19$lvEventList$TopNextPagerButton' }),
    });
  }
  if (!seen.size && total > 0) throw new Error(`${school.name} location filter returned no rows`);
  return { client, kept, total, seen: seen.size, unmappedTurf: [...unmappedTurf] };
}

export async function fetchFcpsCommunityUseEvents(startDate, endDate) {
  const events = {};
  let listed = 0;
  const unmapped = [];
  try {
    const schools = await Promise.all(SCHOOLS.map(school => listSchool(school, startDate, endDate)));
    const pending = [];
    for (const school of schools) {
      listed += school.seen;
      unmapped.push(...school.unmappedTurf);
      for (const row of school.kept) pending.push({ client: school.client, row });
    }
    const details = new Map();
    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const index = cursor;
        cursor += 1;
        const item = pending[index];
        await sleep(120 + (index % 4) * 40);
        details.set(item.row.eventId, await popupDetails(item.client, item.row.eventId));
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    let eventCount = 0;
    for (const { row } of pending) {
      const info = details.get(row.eventId) || {};
      const event = {
        time: clockLabel(row.time),
        title: displayTitle(row, info),
        source: SOURCE,
        sourceUrl: HOME,
        precision: 'permit',
        status: 'scheduled',
        eventId: info.scheduleId || row.eventId,
      };
      for (const fieldId of row.fieldIds) {
        if (!events[fieldId]) events[fieldId] = {};
        if (!events[fieldId][row.date]) events[fieldId][row.date] = [];
        const key = `${event.time}|${event.title}|${event.eventId}`;
        if (events[fieldId][row.date].some(item => `${item.time}|${item.title}|${item.eventId}` === key)) continue;
        events[fieldId][row.date].push(event);
        eventCount += 1;
      }
    }
    return {
      events,
      health: {
        ok: true,
        provider: 'fcps-community-use',
        message: `Guest calendar checked for Chantilly, Centreville, Oakton, and Westfield (${listed} upcoming rows, ${eventCount} mapped turf sessions ${startDate} to ${endDate}). Park fields are not on this calendar.`,
        eventCount,
        sourceUrl: HOME,
        unmappedRooms: [...new Set(unmapped)].slice(0, 12),
      },
    };
  } catch (error) {
    return {
      events: {},
      health: {
        ok: false,
        provider: 'fcps-community-use',
        message: error.message,
        eventCount: 0,
        sourceUrl: HOME,
      },
    };
  }
}
