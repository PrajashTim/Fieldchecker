import https from 'https';
import http from 'http';

const USER_AGENT = 'Mozilla/5.0 (compatible; PitchScout/1.0; schedule availability checker)';

export function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? http : https;
    const req = client.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        httpGet(next, redirects + 1).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body, url }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`timeout fetching ${url}`)); });
  });
}

export function absoluteUrl(href, base = 'https://elements.demosphere.com') {
  if (!href) return '';
  return new URL(href, base).toString();
}
