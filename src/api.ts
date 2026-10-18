/**
 * Talks to the widget's endpoint: one request per coin and currency at a time, shared by
 * every widget on the page, and answers checked field by field so a bad or newer response
 * can never break the page it sits on.
 */

export const SITE = 'https://www.coinfinhub.com';

/** What the widget shows, taken from a 200 answer. Display text comes ready-made from the server. */
export interface Price {
  name: string;
  symbol: string;
  price: string;
  change: string | null;
  direction: string | null;
  context: string | null;
  contextLabel: string | null;
  contextTip: string | null;
  note: string | null;
  age: string | null;
  rate: string | null;
  url: string;
  updatedAt: number | null;
}

export interface Failure {
  ok: false;
  code: string;
  message: string | null;
  retryAfter: number | null;
}

export type Answer = { ok: true; price: Price } | Failure;

const MINUTE = 60_000;
const TIMEOUT = 15_000;
const LONGEST = 1_000;

interface Entry {
  until: number;
  answer: Promise<Answer>;
}

/** In-flight and recent answers by request URL: the floor that keeps each pair to one request a minute. */
const shared = new Map<string, Entry>();

/** encodeURIComponent, minus its one throw: a lone surrogate becomes U+FFFD (no slug has one). */
const encode = (value: string): string => encodeURIComponent(value.replace(/[\uD800-\uDFFF]/g, '\uFFFD'));

/** The coin's page, built from the slug: the link's fallback. */
export const coinLink = (coin: string): string => `${SITE}/price/${encode(coin)}`;

export function getPrice(base: string, coin: string, currency: string): Promise<Answer> {
  const url = `${base}/api/widget/v1/price/${encode(coin)}?currency=${encode(currency)}`;
  const now = performance.now();
  const hit = shared.get(url);
  if (hit && now < hit.until) return hit.answer;
  for (const [key, entry] of shared) if (now >= entry.until) shared.delete(key);
  const entry: Entry = { until: Infinity, answer: request(url, coin) };
  shared.set(url, entry);
  void entry.answer.then((answer) => {
    entry.until = now + hold(answer);
  });
  return entry.answer;
}

/** How long an answer is reused: a minute, or what the server asks, or 10 s after no answer at all. */
function hold(answer: Answer): number {
  if (answer.ok) return MINUTE;
  if (answer.retryAfter) return answer.retryAfter * 1000;
  return answer.code === 'network' ? 10_000 : MINUTE;
}

async function request(url: string, coin: string): Promise<Answer> {
  let response: Response;
  try {
    // A simple GET with no custom headers, so the browser never sends a CORS preflight.
    response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    return fail('network');
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // An HTML error page or a cut-off body: handled as a failure below.
  }
  if (response.ok) {
    const price = readPrice(body, coin);
    return price ? { ok: true, price } : fail('bad_response');
  }
  const error = record(record(body)?.error);
  const retryAfter = error?.retryAfter;
  return {
    ok: false,
    code: text(error?.code) ?? 'unavailable',
    message: text(error?.message),
    retryAfter:
      typeof retryAfter === 'number' && retryAfter > 0 ? Math.min(86_400, Math.max(10, Math.ceil(retryAfter))) : null,
  };
}

const fail = (code: string): Failure => ({ ok: false, code, message: null, retryAfter: null });

/** Reads a 200 body. Only the coin's name and the display price are required; anything else may be missing. */
function readPrice(body: unknown, coin: string): Price | null {
  const b = record(body);
  const c = record(b?.coin);
  const d = record(b?.display);
  const name = text(c?.name);
  const price = text(d?.price);
  if (!b || !d || !name || !price) return null;
  const updatedAt = typeof b.updatedAt === 'string' ? Date.parse(b.updatedAt) : NaN;
  return {
    name,
    symbol: text(c?.symbol) ?? '',
    price,
    // A stopped coin has no 24h change, whatever the body says.
    change: b.trading === 'stopped' ? null : text(d.change),
    direction: text(d.direction),
    context: text(b.context),
    contextLabel: text(d.contextLabel),
    contextTip: text(d.contextTip),
    note: text(d.note),
    age: text(d.age),
    rate: text(d.rate),
    url: safeLink(b.url, coin),
    updatedAt: Number.isNaN(updatedAt) ? null : updatedAt,
  };
}

/** The link only ever goes to a coin page on www.coinfinhub.com; anything else becomes the page built from the slug. */
export function safeLink(value: unknown, coin: string): string {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    if (
      url.origin === SITE &&
      /^\/price\/[^/]+$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    ) {
      return url.href;
    }
  } catch {
    // Not a URL at all.
  }
  return coinLink(coin);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A non-empty string, cut to a length no layout has to survive; anything else is null. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, LONGEST) : null;
}
