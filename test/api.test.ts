import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coinLink, getCoins, safeUrl, SITE, type Answer, type Coin, type Coins, type Failure, type Want } from '../src/api';
import { coinOf, fixture, freshBase, offline, only, queries, respond, stubFetch } from './helpers';

const PRICE_PAGE = /^\/price\/[^/]+$/;
const LOGO = /^\/coin-logos\//;
const messageOf = (name: string): string => (fixture(name).error as { message: string }).message;

async function answerFor(name: string, units: Want[] = ['bitcoin'], currency = 'USD', spark = false): Promise<Answer> {
  stubFetch(() => respond(name));
  return getCoins(freshBase(), currency, spark, units);
}

async function coinsFor(name: string, units: Want[] = ['bitcoin'], currency = 'USD', spark = false): Promise<Coins> {
  const answer = await answerFor(name, units, currency, spark);
  if (!answer.ok) throw new Error(`expected coins, got ${answer.code}`);
  return answer;
}

async function failureFor(name: string, units: Want[] = ['bitcoin']): Promise<Failure> {
  const answer = await answerFor(name, units);
  if (answer.ok) throw new Error('expected a failure');
  return answer;
}

async function firstCoin(name: string, units = ['bitcoin'], spark = false): Promise<Coin> {
  const coin = (await coinsFor(name, units, 'USD', spark)).coins[0];
  if (!coin) throw new Error('no coin');
  return coin;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the request', () => {
  it('is a simple GET with no credentials and no custom headers', async () => {
    const mock = stubFetch(() => respond('coins-inr'));
    const base = freshBase();
    await getCoins(base, 'INR', false, ['bitcoin']);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] ?? [];
    expect(url).toBe(`${base}/api/widget/v1/coins?ids=bitcoin&currency=INR`);
    expect(init?.credentials).toBe('omit');
    expect(init?.method).toBeUndefined();
    expect(init?.headers).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('asks for the 7-day line with spark=7d, and for every ranked list as the top 20', async () => {
    const mock = stubFetch(() => respond('coins-top'));
    const base = freshBase();
    await getCoins(base, 'USD', true, ['bitcoin']);
    await getCoins(base, 'EUR', false, [10]);
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD&spark=7d', 'top=20&currency=EUR']);
  });

  it('encodes what it sends, and survives a lone surrogate', async () => {
    const mock = stubFetch(() => respond('error-invalid-coin'));
    const base = freshBase();
    await getCoins(base, 'U S', false, ['a/b?c']);
    await getCoins(base, 'USD', false, [String.fromCharCode(0xd800)]);
    await getCoins(base, 'USD', false, ['top=5&currency=EUR']);
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      `${base}/api/widget/v1/coins?ids=a%2Fb%3Fc&currency=U%20S`,
      `${base}/api/widget/v1/coins?ids=%EF%BF%BD&currency=USD`,
      `${base}/api/widget/v1/coins?ids=top%3D5%26currency%3DEUR&currency=USD`,
    ]);
    expect(coinLink(String.fromCharCode(0xdfff))).toBe(`${SITE}/price/%EF%BF%BD`);
  });
});

describe('merging', () => {
  it('asks once for the coins widgets want in the same tick, with the same currency and line', async () => {
    const mock = stubFetch((url) => only(['coins-usd'], url));
    const base = freshBase();
    const [one, two, three] = await Promise.all([
      getCoins(base, 'USD', false, ['bitcoin']),
      getCoins(base, 'USD', false, ['ethereum', 'bitcoin']),
      getCoins(base, 'USD', false, ['tether']),
    ]);
    expect(queries(mock)).toEqual(['ids=bitcoin,ethereum,tether&currency=USD']);
    expect(one.ok && one.coins.map((coin) => coin.slug)).toEqual(['bitcoin']);
    expect(two.ok && two.coins.map((coin) => coin.slug)).toEqual(['ethereum', 'bitcoin']);
    expect(three.ok && three.coins.map((coin) => coin.slug)).toEqual(['tether']);
  });

  it('keeps calls apart by API, currency and line', async () => {
    const mock = stubFetch((url) => only(['coins-top'], url));
    const base = freshBase();
    await Promise.all([
      getCoins(base, 'USD', false, ['bitcoin']),
      getCoins(base, 'INR', false, ['bitcoin']),
      getCoins(base, 'USD', true, ['bitcoin']),
      getCoins(freshBase(), 'USD', false, ['bitcoin']),
    ]);
    expect(queries(mock)).toEqual([
      'ids=bitcoin&currency=USD',
      'ids=bitcoin&currency=INR',
      'ids=bitcoin&currency=USD&spark=7d',
      'ids=bitcoin&currency=USD',
    ]);
  });

  it('splits more than 20 coins into calls of 20', async () => {
    const mock = stubFetch((url) => only(['coins-top'], url));
    const base = freshBase();
    const slugs = Array.from({ length: 25 }, (_, i) => `coin-${String(i)}`);
    await Promise.all([getCoins(base, 'USD', false, slugs.slice(0, 15)), getCoins(base, 'USD', false, slugs.slice(10))]);
    expect(queries(mock)).toEqual([`ids=${slugs.slice(0, 20).join(',')}&currency=USD`, `ids=${slugs.slice(20).join(',')}&currency=USD`]);
  });

  it("asks for the ranked list once, on its own, and cuts it to each widget's N", async () => {
    const mock = stubFetch((url) => (url.searchParams.has('top') ? respond('coins-top') : only(['coins-usd'], url)));
    const base = freshBase();
    const [ten, three] = await Promise.all([getCoins(base, 'USD', false, [10]), getCoins(base, 'USD', false, [3, 'tether'])]);
    const one = await getCoins(base, 'USD', false, [1]);
    expect(queries(mock)).toEqual(['ids=tether&currency=USD', 'top=20&currency=USD']);
    expect(ten.ok && ten.coins.map((coin) => coin.slug)).toEqual(
      (fixture('coins-top').coins as { slug: string }[]).map((coin) => coin.slug),
    );
    expect(three.ok && three.coins.map((coin) => coin.slug)).toEqual(['bitcoin', 'ethereum', 'bnb', 'tether']);
    expect(one.ok && one.coins.map((coin) => coin.slug)).toEqual(['bitcoin']);
  });

  it("answers for each coin of the ranked list within the same floor, so it isn't asked for again", async () => {
    const mock = stubFetch((url) => (url.searchParams.has('top') ? respond('coins-top') : only(['coins-usd'], url)));
    const base = freshBase();
    await getCoins(base, 'USD', false, [5]);
    const answer = await getCoins(base, 'USD', false, ['bnb', 'bitcoin', 'tether']);
    expect(queries(mock)).toEqual(['top=20&currency=USD', 'ids=tether&currency=USD']);
    expect(answer.ok && answer.coins.map((coin) => coin.slug)).toEqual(['bnb', 'bitcoin', 'tether']);
  });

  it('leaves an unreadable coin out of a list, while a widget that asked for it alone fails', async () => {
    stubFetch(() => {
      const body = fixture('coins-usd') as { coins: { slug: string; display: Record<string, unknown> }[] };
      const ethereum = body.coins.find((coin) => coin.slug === 'ethereum');
      if (ethereum) delete ethereum.display.price;
      return new Response(JSON.stringify(body));
    });
    const base = freshBase();
    const [list, alone] = await Promise.all([
      getCoins(base, 'USD', false, ['bitcoin', 'ethereum', 'tether']),
      getCoins(base, 'USD', false, ['ethereum']),
    ]);
    expect(list.ok && list.coins.map((coin) => coin.slug)).toEqual(['bitcoin', 'tether']);
    expect(!alone.ok && alone.code).toBe('bad_response');
  });

  it('leaves an unreadable coin out of the ranked list', async () => {
    stubFetch(() => {
      const body = fixture('coins-top') as { coins: { display: Record<string, unknown> }[] };
      delete body.coins[0]?.display.price;
      return new Response(JSON.stringify(body));
    });
    const answer = await getCoins(freshBase(), 'USD', false, [3]);
    expect(answer.ok && answer.coins.map((coin) => coin.slug)).toEqual(['ethereum', 'bnb', 'xrp']);
  });

  it('fails every widget in a call that fails', async () => {
    stubFetch(() => respond('error-prices-unavailable'));
    const base = freshBase();
    const answers = await Promise.all([getCoins(base, 'USD', false, ['bitcoin']), getCoins(base, 'USD', false, ['ethereum'])]);
    expect(answers.map((answer) => !answer.ok && answer.code)).toEqual(['prices_unavailable', 'prices_unavailable']);
  });
});

describe('a 200 answer', () => {
  it('gives the coins of the contract example', async () => {
    const bitcoin = coinOf('coins-usd', 'bitcoin');
    const ethereum = coinOf('coins-usd', 'ethereum');
    expect(await coinsFor('coins-usd', ['bitcoin', 'ethereum'])).toEqual({
      ok: true,
      currency: 'USD',
      rate: null,
      coins: [
        {
          slug: 'bitcoin',
          name: 'Bitcoin',
          symbol: 'BTC',
          logo: 'https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=1',
          price: bitcoin.display.price,
          value: bitcoin.price,
          change: bitcoin.display.change,
          direction: 'down',
          badge: null,
          url: 'https://www.coinfinhub.com/price/bitcoin',
          updatedAt: Date.parse('2026-10-06T10:55:01.352Z'),
          spark: null,
        },
        expect.objectContaining({ slug: 'ethereum', logo: null, direction: 'down', change: ethereum.display.change }),
      ],
    });
  });

  it('carries the rate label in another currency', async () => {
    const answer = await coinsFor('coins-inr', ['bitcoin'], 'INR');
    expect(answer.currency).toBe('INR');
    expect(answer.rate).toBe('USD rate derived from ECB data');
    expect(answer.coins[0]?.price).toBe(coinOf('coins-inr', 'bitcoin').display.price);
  });

  it('keeps the order asked and leaves missing coins out', async () => {
    const answer = await coinsFor('coins-missing', ['no-such-coin', 'bitcoin']);
    expect(answer.coins.map((coin) => coin.slug)).toEqual(['bitcoin']);
  });

  it('is unknown_coin when none of the coins asked for came back', async () => {
    expect(await failureFor('coins-missing', ['no-such-coin'])).toEqual({
      ok: false,
      code: 'unknown_coin',
      message: null,
      retryAfter: null,
    });
  });

  it('reads the 7-day line', async () => {
    const coin = await firstCoin('coins-spark', ['bitcoin'], true);
    expect(coin.spark).toEqual((coinOf('coins-spark', 'bitcoin') as unknown as { sparkline7d: number[] }).sparkline7d);
  });

  it('keeps only numbers from the line, at most 200 of them, and drops a line of one point', async () => {
    stubFetch(() => {
      const body = fixture('coins-spark') as { coins: { slug: string; sparkline7d: unknown[] }[] };
      const [bitcoin] = body.coins;
      if (!bitcoin) throw new Error('no bitcoin');
      body.coins.push({ ...bitcoin, slug: 'ethereum', sparkline7d: [1, 'x', null] });
      bitcoin.sparkline7d = Array.from({ length: 500 }, (_, i) => (i % 2 ? i : String(i)));
      return new Response(JSON.stringify(body));
    });
    const answer = await getCoins(freshBase(), 'USD', true, ['bitcoin', 'ethereum']);
    if (!answer.ok) throw new Error('expected coins');
    expect(answer.coins[0]?.spark).toHaveLength(200);
    expect(answer.coins[0]?.spark?.every((n) => typeof n === 'number')).toBe(true);
    expect(answer.coins[1]?.spark).toBeNull();
  });

  it('reads a badge, and has no change for a coin that stopped trading', async () => {
    const answer = await coinsFor('coins-usd', ['tether', 'quietcoin', 'haltcoin']);
    expect(answer.coins.map(({ slug, badge, change, direction }) => [slug, badge, change, direction])).toEqual([
      ['tether', null, '+0.01%', 'up'],
      ['quietcoin', 'Little trading', '−0.07%', 'down'],
      ['haltcoin', 'No trades since 1 Oct 2026', null, null],
    ]);
  });

  it('drops a change the server sends for a stopped coin anyway', async () => {
    stubFetch(() => {
      const body = fixture('coins-usd') as { coins: { slug: string; display: Record<string, unknown> }[] };
      const halted = body.coins.find((coin) => coin.slug === 'haltcoin');
      if (halted) Object.assign(halted.display, { change: '+1.00%', direction: 'up' });
      return new Response(JSON.stringify(body));
    });
    const answer = await getCoins(freshBase(), 'USD', false, ['haltcoin']);
    expect(answer.ok && [answer.coins[0]?.change, answer.coins[0]?.direction]).toEqual([null, null]);
  });

  it('passes unknown values through and ignores unknown fields', async () => {
    const coin = await firstCoin('coins-unknown-values');
    expect(coin).toMatchObject({ direction: 'sideways', badge: 'Paused', logo: null, updatedAt: null });
    expect(Object.keys(coin).sort()).toEqual(
      ['badge', 'change', 'direction', 'logo', 'name', 'price', 'slug', 'spark', 'symbol', 'updatedAt', 'url', 'value'].sort(),
    );
  });

  it('needs only the slug, the name and the display price', async () => {
    expect(await coinsFor('coins-missing-fields', ['solana'])).toEqual({
      ok: true,
      currency: 'USD',
      rate: null,
      coins: [
        {
          slug: 'solana',
          name: 'Solana',
          symbol: '',
          logo: null,
          price: '$162.08',
          value: null,
          change: null,
          direction: null,
          badge: null,
          url: 'https://www.coinfinhub.com/price/solana',
          updatedAt: null,
          spark: null,
        },
      ],
    });
  });

  it('is a failure for a coin without a display price, or a body without coins', async () => {
    expect((await failureFor('bad-no-price')).code).toBe('bad_response');
    stubFetch(() => new Response(JSON.stringify({ coin: { name: 'Bitcoin' } })));
    const answer = await getCoins(freshBase(), 'USD', false, ['bitcoin']);
    expect(!answer.ok && answer.code).toBe('bad_response');
    stubFetch(() => new Response(JSON.stringify({ coins: [] })));
    const top = await getCoins(freshBase(), 'USD', false, [5]);
    expect(!top.ok && top.code).toBe('bad_response');
  });

  it('never trusts the links and logos it is given', async () => {
    const coin = await firstCoin('coins-hostile', ['hostile'], true);
    expect(coin.url).toBe('https://www.coinfinhub.com/price/hostile');
    expect(coin.logo).toBeNull();
    expect(coin.spark).toEqual([1, 2]);
  });

  it('cuts absurdly long text', async () => {
    stubFetch(() => new Response(JSON.stringify({ coins: [{ slug: 'long', name: 'x'.repeat(5000), display: { price: '$1' } }] })));
    const answer = await getCoins(freshBase(), 'USD', false, ['long']);
    expect(answer.ok && answer.coins[0]?.name.length).toBe(1000);
  });
});

describe('an error answer', () => {
  it.each([
    ['error-invalid-coin', 'invalid_coin', null],
    ['error-invalid-currency', 'invalid_currency', null],
    ['error-invalid-query', 'invalid_query', null],
    ['error-unknown-coin', 'unknown_coin', null],
    ['error-rate-limited', 'rate_limited', 60],
    ['error-prices-unavailable', 'prices_unavailable', 60],
    ['error-rate-unavailable', 'rate_unavailable', 600],
    ['error-widget-off', 'widget_off', 300],
    ['error-unknown-code', 'maintenance_window', null],
  ])('%s gives its code, message and retryAfter', async (name, code, retryAfter) => {
    const failure = await failureFor(name);
    expect(failure.code).toBe(code);
    expect(failure.retryAfter).toBe(retryAfter);
    expect(failure.message).toBe(messageOf(name));
  });

  it.each([
    [0, null],
    [-5, null],
    ['60', null],
    [3, 10],
    [30.2, 31],
    [1e9, 86_400],
  ])('reads retryAfter %s as %s', async (value, expected) => {
    stubFetch(() => new Response(JSON.stringify({ error: { code: 'rate_limited', retryAfter: value } }), { status: 429 }));
    const answer = await getCoins(freshBase(), 'USD', false, ['bitcoin']);
    expect(!answer.ok && answer.retryAfter).toBe(expected);
  });

  it('is "unavailable" for an HTML error page', async () => {
    stubFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(await getCoins(freshBase(), 'USD', false, ['bitcoin'])).toEqual({
      ok: false,
      code: 'unavailable',
      message: null,
      retryAfter: null,
    });
  });

  it('is "network" when there is no answer at all', async () => {
    offline();
    expect(await getCoins(freshBase(), 'USD', false, ['bitcoin'])).toEqual({
      ok: false,
      code: 'network',
      message: null,
      retryAfter: null,
    });
  });
});

describe('the floor', () => {
  it('asks for each coin at most once a minute', async () => {
    const mock = stubFetch((url) => only(['coins-top'], url));
    const base = freshBase();
    await getCoins(base, 'USD', false, ['bitcoin']);
    await vi.advanceTimersByTimeAsync(30_000);
    // Bitcoin is still held: only ethereum is asked for.
    await getCoins(base, 'USD', false, ['bitcoin', 'ethereum']);
    await vi.advanceTimersByTimeAsync(29_999);
    await getCoins(base, 'USD', false, ['bitcoin']);
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=ethereum&currency=USD']);
    await vi.advanceTimersByTimeAsync(1);
    await getCoins(base, 'USD', false, ['bitcoin', 'ethereum']);
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=ethereum&currency=USD', 'ids=bitcoin&currency=USD']);
  });

  it('holds the ranked list for a minute too, whatever N each widget wants', async () => {
    const mock = stubFetch(() => respond('coins-top'));
    const base = freshBase();
    await getCoins(base, 'USD', false, [10]);
    await vi.advanceTimersByTimeAsync(59_999);
    await getCoins(base, 'USD', false, [5]);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await getCoins(base, 'USD', false, [10]);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('holds an answer as long as its retryAfter says', async () => {
    const mock = stubFetch(() => respond('error-widget-off'));
    const base = freshBase();
    await getCoins(base, 'USD', false, ['bitcoin']);
    await vi.advanceTimersByTimeAsync(299_000);
    await getCoins(base, 'USD', false, ['bitcoin']);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await getCoins(base, 'USD', false, ['bitcoin']);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('holds no failure without a retryAfter, so the next try reaches the server', async () => {
    const mock = offline();
    const base = freshBase();
    await getCoins(base, 'USD', false, ['bitcoin']);
    await getCoins(base, 'USD', false, ['bitcoin']);
    expect(mock).toHaveBeenCalledTimes(2);
    const coded = stubFetch(() => respond('error-unknown-code'));
    await getCoins(base, 'USD', false, ['bitcoin']);
    await getCoins(base, 'USD', false, ['bitcoin']);
    expect(coded).toHaveBeenCalledTimes(2);
  });

  it('shares a failure while it is in flight', async () => {
    const mock = offline();
    const base = freshBase();
    await Promise.all([getCoins(base, 'USD', false, ['bitcoin']), getCoins(base, 'USD', false, ['bitcoin'])]);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe('the link and logo guard', () => {
  it.each([
    'https://www.coinfinhub.com/price/bitcoin',
    'https://WWW.COINFINHUB.COM/price/bitcoin',
    'https://www.coinfinhub.com:443/price/bitcoin',
  ])('keeps the link %s', (url) => {
    expect(safeUrl(url, PRICE_PAGE)).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it.each([
    'javascript:alert(1)',
    'http://www.coinfinhub.com/price/bitcoin',
    'https://coinfinhub.com/price/bitcoin',
    'https://www.coinfinhub.com.example.com/price/bitcoin',
    'https://www.coinfinhub.com:8443/price/bitcoin',
    'https://user:pass@www.coinfinhub.com/price/bitcoin',
    'https://www.coinfinhub.com/price/bitcoin?ref=widget',
    'https://www.coinfinhub.com/price/bitcoin#top',
    'https://www.coinfinhub.com/price/',
    'https://www.coinfinhub.com/price/a/b',
    'https://www.coinfinhub.com/price/../admin',
    'https://www.coinfinhub.com/price/%2e%2e/admin',
    'https://www.coinfinhub.com/exchanges',
    '/price/bitcoin',
    '',
    42,
    null,
  ])('refuses the link %s', (url) => {
    expect(safeUrl(url, PRICE_PAGE)).toBeNull();
  });

  it('keeps a logo on CoinFinHub, with its version query, and refuses any other', () => {
    expect(safeUrl('https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=1', LOGO, true)).toBe(
      'https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=1',
    );
    for (const url of [
      'https://cdn.example.com/coin-logos/small/bitcoin.png',
      'https://www.coinfinhub.com/coin-logos/../admin.png',
      'https://www.coinfinhub.com/uploads/x.png',
      'data:image/svg+xml,<svg onload=alert(1)>',
      'https://www.coinfinhub.com/coin-logos/a.png#x',
    ]) {
      expect(safeUrl(url, LOGO, true), url).toBeNull();
    }
  });
});
