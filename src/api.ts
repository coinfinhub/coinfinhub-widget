/**
 * Talks to the widget's endpoint, GET /api/widget/v1/coins. Every widget on the page goes through here:
 * coins asked for in the same tick with the same currency and line are merged into one call (at most 20
 * per call), each coin is asked for at most once a minute, and answers are checked field by field so a
 * bad or newer response can never break the page it sits on.
 */

export const SITE = 'https://www.coinfinhub.com';

/** One coin as a widget shows it. Display text comes ready-made from the server. */
export interface Coin {
  slug: string;
  name: string;
  symbol: string;
  /** A logo on www.coinfinhub.com, or null for the lettered circle. */
  logo: string | null;
  /** The display price, "$88,888.00". */
  price: string;
  /** The price as a number, for the converter's maths; null when the body has none. */
  value: number | null;
  change: string | null;
  direction: string | null;
  badge: string | null;
  url: string;
  updatedAt: number | null;
  /** The 7-day line, oldest first, when asked for and sent. */
  spark: number[] | null;
}

export interface Coins {
  coins: Coin[];
  rate: string | null;
  /** The currency the prices are in. */
  currency: string;
}

export interface Failure {
  ok: false;
  code: string;
  message: string | null;
  retryAfter: number | null;
}

export type Answer = ({ ok: true } & Coins) | Failure;

/** What a widget asks for: a coin by its slug, or a number N for CoinFinHub's top N coins. */
export type Want = string | number;

/** What one coin, or the ranked list, came back as. */
type Unit = { ok: true; coins: Coin[]; rate: string | null } | Failure;

/** The site's slug pattern. Widgets check it before asking, so one bad slug can't fail other widgets' calls. */
export const SLUG = /^(?=.{1,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Codes that mean the coin itself is wrong: the link goes home. */
export const BAD_COIN = new Set(['invalid_coin', 'unknown_coin']);
/** Codes about one coin rather than the call: a list leaves that coin out. */
const ONE_COIN = new Set([...BAD_COIN, 'bad_response']);

const MINUTE = 60_000;
const TIMEOUT = 15_000;
const LONGEST = 1_000;
/** The most coins in one call, and the length of the ranked list every widget slices its top N from. */
const PER_CALL = 20;
const POINTS = 200;

/** In-flight and recent answers by "base currency spark slug" ("" for the ranked list): the once-a-minute floor. */
const cache = new Map<string, { until: number; unit: Promise<Unit> }>();
/** Units waiting for this tick's calls, by "base query-suffix". */
const queue = new Map<string, [slug: string, settle: (unit: Unit) => void][]>();

/** encodeURIComponent, minus its one throw: a lone surrogate becomes U+FFFD (no slug has one). */
const encode = (value: string): string => encodeURIComponent(value.replace(/[\uD800-\uDFFF]/g, '�'));

/** The coin's page, built from the slug: the link's fallback. */
export const coinLink = (slug: string): string => `${SITE}/price/${encode(slug)}`;

/**
 * Coins for one widget. Each slug, and the ranked list, comes from the cache while it is held, otherwise
 * from a call made at the end of this tick (a microtask) together with every other widget's. Every ranked
 * list is the top 20, asked once and cut to each widget's N.
 */
export function getCoins(base: string, currency: string, spark: boolean, wants: Want[]): Promise<Answer> {
  const now = performance.now();
  for (const [key, entry] of cache) if (now >= entry.until) cache.delete(key);
  const group = `${base} &currency=${encode(currency)}${spark ? '&spark=7d' : ''}`;
  return Promise.all(
    wants.map((want) => {
      const slug = typeof want === 'number' ? '' : want;
      const key = `${group} ${slug}`;
      let entry = cache.get(key);
      if (!entry) {
        let settle: (unit: Unit) => void = () => undefined;
        const held = { until: Infinity, unit: new Promise<Unit>((resolve) => (settle = resolve)) };
        void held.unit.then((answer) => {
          held.until = now + hold(answer);
        });
        cache.set(key, (entry = held));
        if (!queue.size) queueMicrotask(flush);
        const waiting = queue.get(group) ?? [];
        queue.set(group, waiting);
        waiting.push([slug, settle]);
      }
      return typeof want === 'number' ? entry.unit.then((unit) => (unit.ok ? { ...unit, coins: unit.coins.slice(0, want) } : unit)) : entry.unit;
    }),
  ).then((results) => compose(results, currency));
}

/** Makes this tick's calls: slugs together, 20 at a time, and the ranked list on its own. */
function flush(): void {
  for (const [group, waiting] of queue) {
    const slugs = waiting.filter(([slug]) => slug);
    for (let at = 0; at < slugs.length; at += PER_CALL) void call(group, slugs.slice(at, at + PER_CALL));
    const ranked = waiting.find(([slug]) => !slug);
    if (ranked) void call(group, [ranked]);
  }
  queue.clear();
}

async function call(group: string, units: [string, (unit: Unit) => void][]): Promise<void> {
  const [base = '', suffix = ''] = group.split(' ');
  const ranked = !units[0]?.[0];
  const query = ranked ? `top=${String(PER_CALL)}` : `ids=${units.map(([slug]) => encode(slug)).join(',')}`;
  const answer = await request(`${base}/api/widget/v1/coins?${query}${suffix}`);
  if (!answer.ok) {
    for (const [, settle] of units) settle(answer);
    return;
  }
  // Unreadable coins are left out of a ranked list; asked for by slug, the coin's own widget says so.
  const coins = [...answer.coins.values()].filter((coin) => coin !== null);
  if (ranked) {
    // Each coin of the ranked list also answers for itself, within the same floor.
    const now = performance.now();
    for (const coin of coins) {
      const key = `${group} ${coin.slug}`;
      if (!((cache.get(key)?.until ?? 0) > now)) {
        cache.set(key, { until: now + MINUTE, unit: Promise.resolve({ ok: true, coins: [coin], rate: answer.rate }) });
      }
    }
  }
  for (const [slug, settle] of units) {
    const coin = answer.coins.get(slug);
    settle(
      ranked
        ? coins.length
          ? { ok: true, coins, rate: answer.rate }
          : fail('bad_response')
        : coin === null
          ? fail('bad_response')
          : { ok: true, coins: coin ? [coin] : [], rate: answer.rate },
    );
  }
}

/** One widget's answer: a failure of a whole call wins; coins missing or unreadable are left out. */
function compose(results: Unit[], currency: string): Answer {
  const coins: Coin[] = [];
  let rate: string | null = null;
  let wrong: Failure | null = null;
  for (const result of results) {
    if (result.ok) {
      coins.push(...result.coins);
      rate ??= result.rate;
    } else if (ONE_COIN.has(result.code)) {
      wrong ??= result;
    } else {
      return result;
    }
  }
  return coins.length ? { ok: true, coins, rate, currency } : (wrong ?? fail('unknown_coin'));
}

/** How long an answer is reused: a minute for coins; a failure only as long as its retryAfter, if it has one. */
const hold = (unit: Unit): number => (unit.ok ? MINUTE : (unit.retryAfter ?? 0) * 1000);

type Body = { ok: true; coins: Map<string, Coin | null>; rate: string | null } | Failure;

async function request(url: string): Promise<Body> {
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
  const b = record(body);
  if (response.ok) {
    if (!Array.isArray(b?.coins)) return fail('bad_response');
    const coins = new Map<string, Coin | null>();
    for (const item of b.coins as unknown[]) {
      const slug = text(record(item)?.slug);
      if (slug && !coins.has(slug)) coins.set(slug, readCoin(item, slug));
    }
    return { ok: true, coins, rate: text(record(b.display)?.rate) };
  }
  const error = record(b?.error);
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

/** Reads one coin. The name and the display price are required; anything else may be missing. */
function readCoin(item: unknown, slug: string): Coin | null {
  const c = record(item) ?? {};
  const d = record(c.display);
  const name = text(c.name);
  const price = text(d?.price);
  if (!d || !name || !price) return null;
  const updatedAt = typeof c.updatedAt === 'string' ? Date.parse(c.updatedAt) : NaN;
  const line = Array.isArray(c.sparkline7d) ? (c.sparkline7d as unknown[]).filter(isNumber).slice(-POINTS) : [];
  // A stopped coin has no 24h change, whatever the body says.
  const stopped = c.trading === 'stopped';
  return {
    slug,
    name,
    symbol: text(c.symbol) ?? '',
    logo: safeUrl(c.logo, /^\/coin-logos\//, true),
    price,
    value: isNumber(c.price) && c.price > 0 ? c.price : null,
    change: stopped ? null : text(d.change),
    direction: stopped ? null : text(d.direction),
    badge: text(d.badge),
    url: safeUrl(c.url, /^\/price\/[^/]+$/) ?? coinLink(slug),
    updatedAt: Number.isNaN(updatedAt) ? null : updatedAt,
    spark: line.length > 1 ? line : null,
  };
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * A URL on https://www.coinfinhub.com whose path matches, with no login part (and no query or fragment
 * unless allowed: a logo's "?v=1"); anything else is null.
 */
export function safeUrl(value: unknown, path: RegExp, query = false): string | null {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    if (url.origin === SITE && path.test(url.pathname) && !url.username && !url.password && (query || !url.search) && !url.hash) {
      return url.href;
    }
  } catch {
    // Not a URL at all.
  }
  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A non-empty string, cut to a length no layout has to survive; anything else is null. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, LONGEST) : null;
}
