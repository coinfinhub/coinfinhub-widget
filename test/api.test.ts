import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coinLink, getPrice, safeLink, SITE, type Answer, type Failure, type Price } from '../src/api';
import { fixture, freshBase, respond, stubFetch } from './helpers';

const TIP =
  'Compared with the combined value of the coins CoinFinHub lists. This is analysis of past prices, not a prediction or financial advice.';

async function answerFor(name: string, coin = 'bitcoin'): Promise<Answer> {
  stubFetch(() => respond(name));
  return getPrice(freshBase(), coin, 'USD');
}

async function priceFor(name: string, coin = 'bitcoin'): Promise<Price> {
  const answer = await answerFor(name, coin);
  if (!answer.ok) throw new Error(`expected a price, got ${answer.code}`);
  return answer.price;
}

async function failureFor(name: string): Promise<Failure> {
  const answer = await answerFor(name);
  if (answer.ok) throw new Error('expected a failure');
  return answer;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the request', () => {
  it('is a simple GET with no credentials and no custom headers', async () => {
    const mock = stubFetch(() => respond('ok-inr'));
    const base = freshBase();
    await getPrice(base, 'bitcoin', 'INR');
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] ?? [];
    expect(url).toBe(`${base}/api/widget/v1/price/bitcoin?currency=INR`);
    expect(init?.credentials).toBe('omit');
    expect(init?.method).toBeUndefined();
    expect(init?.headers).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('encodes the coin and currency, and survives a lone surrogate', async () => {
    const mock = stubFetch(() => respond('error-invalid-coin'));
    const base = freshBase();
    await getPrice(base, 'a/b?c', 'U S');
    await getPrice(base, String.fromCharCode(0xd800), 'USD');
    expect(mock.mock.calls[0]?.[0]).toBe(`${base}/api/widget/v1/price/a%2Fb%3Fc?currency=U%20S`);
    expect(mock.mock.calls[1]?.[0]).toBe(`${base}/api/widget/v1/price/%EF%BF%BD?currency=USD`);
    expect(coinLink(String.fromCharCode(0xdfff))).toBe(`${SITE}/price/%EF%BF%BD`);
  });
});

describe('a 200 answer', () => {
  it('gives the display text of the contract example (INR)', async () => {
    expect(await priceFor('ok-inr')).toEqual({
      name: 'Bitcoin',
      symbol: 'BTC',
      price: '₹75,86,424.40',
      change: '−1.34%',
      direction: 'down',
      context: 'Bitcoin slips 1.3%, in line with the market.',
      contextLabel: 'Today',
      contextTip: TIP,
      note: null,
      age: null,
      rate: 'USD rate derived from ECB data',
      url: 'https://www.coinfinhub.com/price/bitcoin',
      updatedAt: Date.parse('2026-10-18T09:41:03.000Z'),
    });
  });

  it('carries the notes for little trading, a quiet price and old prices', async () => {
    expect((await priceFor('ok-low', 'tinycoin')).note).toBe("Little trading: the price may be far from what you'd pay");
    expect((await priceFor('ok-quiet', 'quietcoin')).note).toBe('Price last changed 7 hours ago');
    expect((await priceFor('ok-old', 'ethereum')).age).toBe('Updated 25 min ago');
  });

  it('has no change and no context for a stopped coin', async () => {
    const price = await priceFor('ok-stopped', 'oldcoin');
    expect(price.change).toBeNull();
    expect(price.context).toBeNull();
    expect(price.note).toBe('No trades since 12 Oct: this is the last price');
  });

  it('drops a change the server sends for a stopped coin anyway', async () => {
    stubFetch(() => {
      const body = fixture('ok-stopped') as { display: Record<string, unknown> };
      body.display.change = '+1.00%';
      return new Response(JSON.stringify(body));
    });
    const answer = await getPrice(freshBase(), 'oldcoin', 'USD');
    expect(answer.ok && answer.price.change).toBeNull();
  });

  it('keeps the stablecoin sentence', async () => {
    expect((await priceFor('ok-stablecoin', 'tether')).context).toBe('Tether holds its $1 peg.');
  });

  it('passes unknown values through and ignores unknown fields', async () => {
    const price = await priceFor('ok-unknown-values');
    expect(price.direction).toBe('sideways');
    expect(price.updatedAt).toBeNull();
    expect(Object.keys(price)).not.toContain('badge');
  });

  it('needs only the name and the display price', async () => {
    expect(await priceFor('ok-missing-fields', 'solana')).toEqual({
      name: 'Solana',
      symbol: '',
      price: '$162.08',
      change: null,
      direction: null,
      context: null,
      contextLabel: null,
      contextTip: null,
      note: null,
      age: null,
      rate: null,
      url: 'https://www.coinfinhub.com/price/solana',
      updatedAt: null,
    });
  });

  it('is a failure without a display price', async () => {
    expect((await failureFor('bad-no-price')).code).toBe('bad_response');
  });

  it('never trusts the link it is given', async () => {
    expect((await priceFor('ok-hostile')).url).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it('cuts absurdly long text', async () => {
    stubFetch(() => new Response(JSON.stringify({ coin: { name: 'x'.repeat(5000) }, display: { price: '$1' } })));
    const answer = await getPrice(freshBase(), 'long', 'USD');
    expect(answer.ok && answer.price.name.length).toBe(1000);
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
    expect(typeof failure.message).toBe('string');
  });

  it('names its message from the body', async () => {
    expect((await failureFor('error-prices-unavailable')).message).toBe('Prices are unavailable right now.');
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
    const answer = await getPrice(freshBase(), 'bitcoin', 'USD');
    expect(!answer.ok && answer.retryAfter).toBe(expected);
  });

  it('is "unavailable" for an HTML error page', async () => {
    stubFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const answer = await getPrice(freshBase(), 'bitcoin', 'USD');
    expect(answer).toEqual({ ok: false, code: 'unavailable', message: null, retryAfter: null });
  });

  it('is "network" when there is no answer at all', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const answer = await getPrice(freshBase(), 'bitcoin', 'USD');
    expect(answer).toEqual({ ok: false, code: 'network', message: null, retryAfter: null });
  });
});

describe('shared requests and the floor', () => {
  it('shares one request between callers asking for the same pair', async () => {
    const mock = stubFetch(() => respond('ok-usd'));
    const base = freshBase();
    const first = getPrice(base, 'bitcoin', 'USD');
    const second = getPrice(base, 'bitcoin', 'USD');
    expect(second).toBe(first);
    await getPrice(base, 'bitcoin', 'INR');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('asks for a pair at most once a minute after an answer', async () => {
    const mock = stubFetch(() => respond('ok-usd'));
    const base = freshBase();
    await getPrice(base, 'bitcoin', 'USD');
    await vi.advanceTimersByTimeAsync(59_999);
    await getPrice(base, 'bitcoin', 'USD');
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await getPrice(base, 'bitcoin', 'USD');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('holds an answer as long as its retryAfter says', async () => {
    const mock = stubFetch(() => respond('error-widget-off'));
    const base = freshBase();
    await getPrice(base, 'bitcoin', 'USD');
    await vi.advanceTimersByTimeAsync(299_000);
    await getPrice(base, 'bitcoin', 'USD');
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await getPrice(base, 'bitcoin', 'USD');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('allows a new try 10 s after no answer at all', async () => {
    const mock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', mock);
    const base = freshBase();
    await getPrice(base, 'bitcoin', 'USD');
    await vi.advanceTimersByTimeAsync(9_999);
    await getPrice(base, 'bitcoin', 'USD');
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await getPrice(base, 'bitcoin', 'USD');
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('the link guard', () => {
  it.each([
    'https://www.coinfinhub.com/price/bitcoin',
    'https://WWW.COINFINHUB.COM/price/bitcoin',
    'https://www.coinfinhub.com:443/price/bitcoin',
  ])('keeps %s', (url) => {
    expect(safeLink(url, 'x')).toBe('https://www.coinfinhub.com/price/bitcoin');
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
  ])('replaces %s with the page built from the slug', (url) => {
    expect(safeLink(url, 'bitcoin')).toBe('https://www.coinfinhub.com/price/bitcoin');
  });
});
