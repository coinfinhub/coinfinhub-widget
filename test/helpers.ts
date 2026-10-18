import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

// A string path: under happy-dom, URL is the DOM's class, which node:fs doesn't accept.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** A fixture body from test/fixtures (the contract's examples). */
export function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8')) as Record<string, unknown>;
}

/** The answer the endpoint gives for a fixture: 200 for a price, the body's own status for an error. */
export function respond(name: string): Response {
  const body = fixture(name);
  const status = (body.error as { status?: number } | undefined)?.status ?? 200;
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Route = (url: URL) => Response | Promise<Response>;

/** Stubs fetch with a router, and returns the mock so tests can count and inspect calls. */
export function stubFetch(route: Route) {
  const mock = vi.fn((input: string, _init?: RequestInit) => Promise.resolve(route(new URL(input))));
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** Requests made so far, as "coin currency" pairs. */
export const pairs = (mock: ReturnType<typeof stubFetch>): string[] =>
  mock.mock.calls.map(([input]) => {
    const url = new URL(input);
    return `${url.pathname.split('/').at(-1) ?? ''} ${url.searchParams.get('currency') ?? ''}`;
  });

let counter = 0;
/** A fresh API base per test, so the module's shared answers never carry over between tests. */
export const freshBase = (): string => `https://api${String(++counter)}.test`;
