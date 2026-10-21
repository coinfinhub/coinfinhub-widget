// A mock of the widgets' endpoint, GET /v1/coins (https://widgets.coinfinhub.com/v1/coins), for the demo page
// and the browser tests. It answers from test/fixtures/*.json: illustrative examples of the contract, not real
// prices, read 30 seconds before each answer, so the samples look live.
//
// The first path segment, if any, picks a scenario, so a page can show every state at once (widgets with
// a different api base never share a call):
//   /hang/…     never answers (the loading state)
//   /down/…     503 prices_unavailable (the error state)
//   /flaky/…    answers once, then fails (a failed refresh keeps the last prices)
//   /limited/…  429 rate_limited once (retryAfter 60), then answers
//   /old/…      answers with prices read 4 minutes ago, as a busy address's cached answer (the age note)
//   anything else, such as /t-1234/, answers normally: tests use it to count their own calls.
// Coins: those in the fixtures (coins-top, coins-usd), among them quietcoin (little trading) and haltcoin
// (no trades), a few more real coins of the demo's own (SAMPLES), and hostile; any other well-formed slug
// is missing. Real coins carry their logo on cdn.coinfinhub.com, as the endpoint sends it. Currencies:
// USD and INR from the fixtures, the others worked out with sample rates; CHF has no rate, to show
// rate_unavailable.

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CHF'];
const RATES = { EUR: 0.8573, GBP: 0.7461, JPY: 150.31, CNY: 7.1234, AUD: 1.5172 };
const SLUG = /^(?=.{1,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE = /^\/(?:([^/]+)\/)?v1\/coins$/;
const BANK = ['coins-top', 'coins-usd', 'coins-hostile'];
/** Real coins, which have a logo on CoinFinHub. */
const REAL = new Set(['bitcoin', 'ethereum', 'bnb', 'xrp', 'usdc', 'tether', 'solana', 'tron', 'dogecoin', 'cardano', 'chainlink']);
const logo = (slug) => (REAL.has(slug) ? `https://cdn.coinfinhub.com/coin-logos/small/${slug}.png?v=1` : null);
/** The demo's own sample coins, ranked after the fixtures' five (illustrative prices). */
const SAMPLES = [
  ['solana', 'Solana', 'SOL', 6, 162.08, 2.31],
  ['tron', 'TRON', 'TRX', 7, 0.2731, 0.62],
  ['dogecoin', 'Dogecoin', 'DOGE', 8, 0.1834, -2.41],
  ['cardano', 'Cardano', 'ADA', 9, 0.6512, -1.08],
  ['chainlink', 'Chainlink', 'LINK', 10, 17.42, 1.57],
];

/** A made-up 7-day line for coins the fixtures have none for: as many points as the fixture's, ending at the price. */
function week(slug, price, change, length) {
  const seed = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const start = price * (1 - ((change ?? 0) * 1.7 + ((seed % 7) - 3)) / 100);
  return Array.from({ length }, (_, i) => {
    const wave = Math.sin(i * 0.8 + seed) * 0.012 + Math.sin(i * 0.21 + seed / 3) * 0.008;
    return Number((i === length - 1 ? price : (start + (price - start) * (i / (length - 1))) * (1 + wave)).toPrecision(6));
  });
}

const error = (body) => ({ status: body.error.status, body });

/**
 * The mock's answer to a request: { status, body }, or null for one that never answers.
 * `n` counts the calls with this path and query so far, starting at 1; `load(name)` gives a fixture's body.
 */
export async function answer(url, n, load) {
  const route = ROUTE.exec(url.pathname);
  if (!route) return { status: 404, body: { error: { status: 404, code: 'not_found', message: 'Not found.' } } };
  const scenario = (route[1] ?? '').split('-')[0];
  if (scenario === 'hang') return null;
  if (scenario === 'down' || (scenario === 'flaky' && n > 1)) return error(await load('error-prices-unavailable'));
  if (scenario === 'limited' && n === 1) return error(await load('error-rate-limited'));

  const query = url.searchParams;
  const repeated = [...new Set(query.keys())].some((key) => query.getAll(key).length > 1);
  const ids = query.get('ids');
  const top = query.get('top');
  const spark = query.get('spark');
  const currency = (query.get('currency') ?? 'USD').toUpperCase();
  const slugs = ids === null ? [] : [...new Set(ids.split(','))];
  const badTop = top !== null && !(/^\d+$/.test(top) && Number(top) >= 1 && Number(top) <= 20);
  if (repeated || (ids === null) === (top === null) || (spark !== null && spark.toLowerCase() !== '7d') || slugs.length > 20 || badTop) {
    return error(await load('error-invalid-query'));
  }
  if (!slugs.every((slug) => SLUG.test(slug))) return error(await load('error-invalid-coin'));
  if (!CURRENCIES.includes(currency)) return error(await load('error-invalid-currency'));
  const inr = await load('coins-inr');
  const perUsd = currency === 'USD' ? 1 : currency === 'INR' ? inr.rate.perUsd : RATES[currency];
  if (!perUsd) return error(await load('error-rate-unavailable'));

  const bank = new Map();
  for (const name of BANK) for (const coin of (await load(name)).coins) if (!bank.has(coin.slug)) bank.set(coin.slug, coin);
  for (const [slug, name, symbol, rank, price, change] of SAMPLES) {
    bank.set(slug, { slug, name, symbol, logo: null, rank, price, change24h: change, trading: 'listed', stoppedAt: null });
  }
  const chosen =
    top !== null
      ? [...bank.values()].filter((coin) => coin.rank >= 1 && coin.rank <= Number(top)).sort((a, b) => a.rank - b.rank)
      : slugs.map((slug) => bank.get(slug)).filter(Boolean);
  const missing = slugs.filter((slug) => !bank.has(slug));
  if (!chosen.length) return error(await load('error-unknown-coin'));

  // The server's time, to the second as the endpoint sends it, and when CoinFinHub read the prices: 30 seconds
  // before, or 4 minutes before for a cached answer.
  const at = Math.floor(Date.now() / 1000) * 1000;
  const iso = (time) => new Date(time).toISOString().replace('.000Z', 'Z');
  const updatedAt = iso(at - (scenario === 'old' ? 240_000 : 30_000));
  const lines = new Map((await load('coins-spark')).coins.map((coin) => [coin.slug, coin.sparkline7d]));
  const coins = chosen.map((usd) => {
    const fixed = currency === 'INR' ? inr.coins.find((coin) => coin.slug === usd.slug) : null;
    const coin = {
      slug: usd.slug,
      name: usd.name,
      symbol: usd.symbol,
      logo: logo(usd.slug) ?? usd.logo,
      rank: usd.rank,
      price: fixed?.price ?? (perUsd === 1 ? usd.price : Number((usd.price * perUsd).toPrecision(8))),
      change24h: usd.change24h,
      trading: usd.trading,
      stoppedAt: usd.stoppedAt,
      updatedAt,
      url: usd.url ?? `https://www.coinfinhub.com/price/${usd.slug}`,
    };
    if (spark) {
      const line = lines.get(usd.slug) ?? week(usd.slug, usd.price, usd.change24h, [...lines.values()][0]?.length ?? 2);
      coin.sparkline7d = line.map((value) => (typeof value === 'number' ? Number((value * perUsd).toPrecision(6)) : value));
    }
    return coin;
  });
  const rate = currency === 'USD' ? null : currency === 'INR' ? inr.rate : { ...inr.rate, perUsd };
  return { status: 200, body: { currency, coins, missing, rate, now: iso(at) } };
}
