// Two local servers for the demo and the browser tests, on purpose on two origins:
//   http://localhost:4173  the pages: docs/ at /, dist/ at /dist/, the fixtures at /fixtures/
//                          (the layout the Pages workflow publishes), plus /blank.html and /csp.html
//   http://127.0.0.1:4174  a mock of the widget's endpoint, answering from test/fixtures (docs/mock.js),
//                          with /__requests?coin=… to count what the widget asked for
// Run with `npm run serve`; Playwright starts it by itself.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pick, statusOf } from '../../docs/mock.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGES = 4173;
const API = 4174;
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const MOUNTS = [
  ['/dist/', 'dist'],
  ['/fixtures/', join('test', 'fixtures')],
  ['/', 'docs'],
];
const BLANK =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Widget test page</title><link rel="icon" href="data:,">' +
  '<script type="module" src="/dist/coinfinhub-price.js"></script></head><body><main></main></body></html>';
// A strict policy: no inline styles or scripts, and the widget may only call the mock API.
const STRICT = `default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src http://127.0.0.1:${API}`;

createServer((request, response) => {
  void (async () => {
    const { pathname } = new URL(request.url ?? '/', `http://localhost:${PAGES}`);
    if (pathname === '/blank.html' || pathname === '/csp.html') {
      const headers = { 'content-type': TYPES['.html'] };
      if (pathname === '/csp.html') headers['content-security-policy'] = STRICT;
      response.writeHead(200, headers).end(BLANK);
      return;
    }
    const [prefix, folder] = MOUNTS.find(([p]) => pathname.startsWith(p));
    const base = join(ROOT, folder);
    const relative = pathname.slice(prefix.length) || 'index.html';
    const file = normalize(join(base, decodeURIComponent(relative)));
    if (!file.startsWith(base + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  })();
}).listen(PAGES, 'localhost');

const requests = new Map();

createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${API}`);
    const cors = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
    if (url.pathname === '/__requests') {
      const coin = url.searchParams.get('coin') ?? '';
      const counts = Object.fromEntries(
        [...requests].filter(([key]) => key.startsWith(`${coin} `)).map(([key, n]) => [key.split(' ')[1], n]),
      );
      response.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(counts));
      return;
    }
    const match = /^\/api\/widget\/v1\/price\/([^/]+)$/.exec(url.pathname);
    if (request.method !== 'GET' || !match) {
      response.writeHead(request.method === 'GET' ? 404 : 405, cors).end();
      return;
    }
    const coin = decodeURIComponent(match[1]);
    const currency = (url.searchParams.get('currency') ?? 'USD').toUpperCase();
    const key = `${coin} ${currency}`;
    const n = (requests.get(key) ?? 0) + 1;
    requests.set(key, n);
    const name = pick(coin, currency, n);
    if (!name) return; // Never answers: the widget stays in its loading state.
    const body = await readFile(join(ROOT, 'test', 'fixtures', `${name}.json`), 'utf8');
    response.writeHead(statusOf(JSON.parse(body)), { ...cors, 'content-type': 'application/json' }).end(body);
  })();
}).listen(API, '127.0.0.1');

console.log(`pages on http://localhost:${PAGES}/, mock API on http://127.0.0.1:${API}/`);
