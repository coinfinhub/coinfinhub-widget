// Two local servers for the demo and the browser tests, on purpose on two origins:
//   http://localhost:4173  the pages: docs/ at /, dist/ at /dist/, the fixtures at /fixtures/
//                          (the layout the Pages workflow publishes), plus /blank.html and /csp.html
//   http://127.0.0.1:4174  a mock of the widgets' endpoint, /v1/coins, answering from test/fixtures (docs/mock.js),
//                          with /__calls?ns=… listing the queries the widgets sent under /{ns}/v1/…
// Run with `npm run serve`; Playwright starts it by itself. CFH_PAGES_PORT and CFH_API_PORT change the ports.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer } from '../../docs/mock.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGES = Number(process.env.CFH_PAGES_PORT ?? 4173);
const API = Number(process.env.CFH_API_PORT ?? 4174);
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
  '<script type="module" src="/dist/coinfinhub-widget.js"></script></head><body><main></main></body></html>';
// A strict policy: no inline styles or scripts, logos only from CoinFinHub's cdn host (and data: for the page's
// own empty icon), and calls only to the mock API.
const STRICT = `default-src 'none'; script-src 'self'; style-src 'self'; img-src data: https://cdn.coinfinhub.com; connect-src http://127.0.0.1:${API}`;

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

/** The queries sent so far, by the path segment before /v1/ ("" for none). */
const calls = new Map();
const load = async (name) => JSON.parse(await readFile(join(ROOT, 'test', 'fixtures', `${name}.json`), 'utf8'));

createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${API}`);
    const cors = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
    const json = { ...cors, 'content-type': 'application/json' };
    if (url.pathname === '/__calls') {
      response.writeHead(200, json).end(JSON.stringify(calls.get(url.searchParams.get('ns') ?? '') ?? []));
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405, cors).end();
      return;
    }
    const ns = /^\/([^/]+)\/v1\//.exec(url.pathname)?.[1] ?? '';
    const sent = calls.get(ns) ?? [];
    calls.set(ns, sent);
    sent.push(url.search);
    const n = sent.filter((search) => search === url.search).length;
    const result = await answer(url, n, load);
    if (!result) return; // Never answers: the widget stays in its loading state.
    response.writeHead(result.status, json).end(JSON.stringify(result.body));
  })();
}).listen(API, '127.0.0.1');

console.log(`pages on http://localhost:${PAGES}/, mock API on http://127.0.0.1:${API}/`);
