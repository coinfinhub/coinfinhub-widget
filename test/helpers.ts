import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, vi } from 'vitest';

// A string path: under happy-dom, URL is the DOM's class, which node:fs doesn't accept.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** A fixture body from test/fixtures (the contract's examples). */
export function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8')) as Record<string, unknown>;
}

interface FixtureCoin {
  slug: string;
  price: number;
  display: { price: string; change: string | null };
}

/** One coin of a fixture, by slug: what the tests expect to see. */
export function coinOf(name: string, slug: string): FixtureCoin {
  const coin = (fixture(name).coins as FixtureCoin[]).find((c) => c.slug === slug);
  if (!coin) throw new Error(`${name} has no ${slug}`);
  return coin;
}

/** The answer the endpoint gives for a fixture: 200 for coins, the body's own status for an error. */
export function respond(name: string): Response {
  const body = fixture(name);
  const status = (body.error as { status?: number } | undefined)?.status ?? 200;
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A 200 with only the coins asked for (by ids) from the fixtures, in the order asked; the rest listed as missing. */
export function only(names: string[], url: URL): Response {
  const ids = (url.searchParams.get('ids') ?? '').split(',');
  const bodies = names.map(fixture);
  const all = bodies.flatMap((body) => body.coins as FixtureCoin[]);
  const coins = ids.map((id) => all.find((coin) => coin.slug === id)).filter(Boolean);
  const missing = ids.filter((id) => !all.some((coin) => coin.slug === id));
  return new Response(JSON.stringify({ ...bodies[0], coins, missing }));
}

type Route = (url: URL) => Response | Promise<Response>;

/** Stubs fetch with a router, and returns the mock so tests can count and inspect calls. */
export function stubFetch(route: Route) {
  const mock = vi.fn((input: string, _init?: RequestInit) => Promise.resolve(route(new URL(input))));
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** The queries sent so far, decoded: "ids=bitcoin,ethereum&currency=USD". */
export const queries = (mock: { mock: { calls: [string, ...unknown[]][] } }): string[] =>
  mock.mock.calls.map(([input]) => decodeURIComponent(new URL(input).search.slice(1)));

/** No answer at all, for every request. */
export function offline() {
  const mock = vi.fn((_input: string, _init?: RequestInit) => Promise.reject(new TypeError('Failed to fetch')));
  vi.stubGlobal('fetch', mock);
  return mock;
}

let counter = 0;
/** A fresh API base per test, so the module's shared answers never carry over between tests. */
export const freshBase = (): string => `https://api${String(++counter)}.test`;

// IntersectionObserver, controlled by the tests: every widget starts on screen unless a test says otherwise.
export const screen = { on: true };
const observed = new Map<Element, (visible: boolean) => void>();
class FakeObserver {
  readonly #callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }
  observe(target: Element): void {
    const fire = (isIntersecting: boolean): void => {
      this.#callback([{ isIntersecting, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    };
    observed.set(target, fire);
    queueMicrotask(() => {
      fire(screen.on);
    });
  }
  unobserve(target: Element): void {
    observed.delete(target);
  }
}
/** Scrolls a widget on or off screen. */
export const scroll = (element: Element, visible: boolean): void => observed.get(element)?.(visible);

let hidden = false;
/** Hides or shows the tab. */
export function setHidden(value: boolean): void {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Flushes the promise chain between a request and the render. */
export const settle = () => vi.advanceTimersByTimeAsync(0);
export const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

/** Fake timers, a fixed clock, no jitter, on screen and a visible tab, for every test in the file. */
export function useWidgetSetup(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    // 30 s after the fixtures' updatedAt.
    vi.setSystemTime(new Date('2026-10-06T10:55:31.352Z'));
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    screen.on = true;
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });
}

export async function mount(tag: string, attributes: Record<string, string>, parent: Element = document.body): Promise<HTMLElement> {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  parent.append(element);
  await settle();
  return element;
}

/** A part of a widget's shadow tree. */
export function part(element: Element, selector: string): HTMLElement {
  const found = element.shadowRoot?.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`no ${selector}`);
  return found;
}

export const parts = (element: Element, selector: string): HTMLElement[] => [
  ...(element.shadowRoot?.querySelectorAll<HTMLElement>(selector) ?? []),
];

export const state = (element: Element) => part(element, '.cfh-card').dataset.state;
export const statusText = (element: Element) => part(element, '.cfh-status').textContent;
export const noteText = (element: Element) => part(element, '.cfh-note').textContent;
export const link = (element: Element) => part(element, '.cfh-link') as HTMLAnchorElement;
export const rateText = (element: Element) => part(element, '.cfh-foot').lastElementChild?.textContent;
export const shown = (node: Element): boolean => !(node as HTMLElement).hidden;
