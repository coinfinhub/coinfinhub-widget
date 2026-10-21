import { describe, expect, it, vi } from 'vitest';
import '../src/coinfinhub-widget';
import {
  coinOf,
  fixture,
  footText,
  freshBase,
  link,
  mount,
  noteText,
  offline,
  only,
  part,
  parts,
  queries,
  respond,
  screen,
  scroll,
  setHidden,
  settle,
  shown,
  state,
  statusText,
  stubFetch,
  useWidgetSetup,
  wait,
} from './helpers';

const SECOND = 1_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** coins-usd's bitcoin as the widgets write it. */
const BITCOIN = { price: '$86,091.97', change: '−0.01%' };

useWidgetSetup();

const price = (attributes: Record<string, string>) => mount('coinfinhub-price', attributes);
const always = (name: string) => stubFetch(() => respond(name));
/** Answers in order, repeating the last one. */
function inTurn(...names: string[]) {
  let call = 0;
  return stubFetch(() => respond(names[Math.min(call++, names.length - 1)] ?? ''));
}
const change = (element: HTMLElement) => part(element, '.cfh-chg');

/** coins-spark, plus a copy of its coin named ethereum whose week went the other way. */
function sparkWithFall(url: URL): Response {
  const body = fixture('coins-spark') as { coins: { slug: string; sparkline7d: number[] }[] };
  const [bitcoin] = body.coins;
  if (bitcoin) body.coins.push({ ...bitcoin, slug: 'ethereum', sparkline7d: [...bitcoin.sparkline7d].reverse() });
  const ids = url.searchParams.get('ids')?.split(',') ?? [];
  return new Response(JSON.stringify({ ...body, coins: body.coins.filter((coin) => ids.includes(coin.slug)) }));
}
const logo = (element: HTMLElement) => part(element, '.cfh-logo');

describe('states', () => {
  it('shows "Loading price…" in a status region until the first answer', async () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('loading');
    expect(statusText(element)).toBe('Loading price…');
    expect(part(element, '.cfh-status').getAttribute('role')).toBe('status');
    expect(shown(part(element, '.cfh-main'))).toBe(false);
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
    expect(link(element).textContent).toBe('Powered by CoinFinHub');
    expect(link(element).target).toBe('_blank');
    expect(link(element).rel).toBe('nofollow noopener');
  });

  it('shows the coin: logo, name, symbol, price and "▼ −0.01% 24h"', async () => {
    always('coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    const card = part(element, '.cfh-card');
    expect(state(element)).toBe('data');
    expect(card.getAttribute('role')).toBe('group');
    expect(card.getAttribute('aria-label')).toBe('Bitcoin price');
    expect(card.lang).toBe('en');
    expect(part(element, '.cfh-name').textContent).toBe('Bitcoin');
    expect(part(element, '.cfh-sym').textContent).toBe('BTC');
    expect(part(element, '.cfh-price').textContent).toBe(BITCOIN.price);
    expect(change(element).textContent).toBe(`▼ ${BITCOIN.change} 24h`);
    expect(change(element).className).toBe('cfh-chg cfh-down');
    expect(change(element).firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    const image = part(element, '.cfh-logo img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://cdn.coinfinhub.com/coin-logos/small/bitcoin.png?v=1');
    expect(image.alt).toBe('');
    expect(logo(element).getAttribute('aria-hidden')).toBe('true');
    expect(shown(part(element, '.cfh-badge'))).toBe(false);
    expect(shown(part(element, '.cfh-chart'))).toBe(false);
    expect(footText(element)).toBe('');
    expect(shown(part(element, '.cfh-note'))).toBe(false);
    expect(shown(part(element, '.cfh-status'))).toBe(false);
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it('keeps a newer logo when an older one fails late', async () => {
    // Versions of its own, so the logo marked as failed here never touches other tests.
    let version = 101;
    stubFetch(() => {
      const body = fixture('coins-usd') as { coins: { logo: string | null }[] };
      const [bitcoin] = body.coins;
      if (bitcoin) bitcoin.logo = `https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=${String(version)}`;
      return new Response(JSON.stringify(body));
    });
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    const old = part(element, '.cfh-logo img');
    version = 102;
    await wait(MINUTE);
    const current = part(element, '.cfh-logo img');
    expect(current.getAttribute('src')).toMatch(/v=102$/);
    old.dispatchEvent(new Event('error'));
    expect(part(element, '.cfh-logo img')).toBe(current);
  });

  it("shows the symbol's first letter when the logo fails or there is none", async () => {
    stubFetch((url) => only(['coins-top'], url));
    const api = freshBase();
    const bitcoin = await price({ coin: 'bitcoin', api });
    part(bitcoin, '.cfh-logo img').dispatchEvent(new Event('error'));
    expect(logo(bitcoin).textContent).toBe('B');
    expect(logo(bitcoin).querySelector('img')).toBeNull();
    const ethereum = await price({ coin: 'ethereum', api });
    expect(logo(ethereum).textContent).toBe('E');
    // A logo that failed once isn't asked for again by the next widget.
    const again = await price({ coin: 'bitcoin', api });
    expect(logo(again).textContent).toBe('B');
  });

  it('carries the rate label in another currency', async () => {
    always('coins-inr');
    const element = await price({ coin: 'bitcoin', currency: 'inr', api: freshBase() });
    expect(part(element, '.cfh-price').textContent).toBe('₹82,99,733.90');
    expect(footText(element)).toBe('USD rate derived from ECB data');
  });

  it('shows a badge for little trading', async () => {
    stubFetch((url) => only(['coins-usd'], url));
    const element = await price({ coin: 'quietcoin', api: freshBase() });
    expect(part(element, '.cfh-badge').textContent).toBe('Little trading');
    expect(shown(part(element, '.cfh-badge'))).toBe(true);
    expect(part(element, '.cfh-price').textContent).toBe('$0.0123');
    expect(change(element).textContent).toBe('▼ −0.07% 24h');
  });

  it('shows a change of 0.00% with a dot and no colour of up or down', async () => {
    stubFetch(() => {
      const body = fixture('coins-usd') as { coins: { change24h: number | null }[] };
      const [bitcoin] = body.coins;
      // Rounds to 0.00%: flat, whatever its sign.
      if (bitcoin) bitcoin.change24h = -0.004;
      return new Response(JSON.stringify(body));
    });
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(change(element).textContent).toBe('• 0.00% 24h');
    expect(change(element).className).toBe('cfh-chg cfh-flat');
  });

  it('shows a stopped coin with its badge and no change', async () => {
    stubFetch((url) => only(['coins-usd'], url));
    const element = await price({ coin: 'haltcoin', api: freshBase() });
    expect(part(element, '.cfh-price').textContent).toBe('$0.4560');
    expect(part(element, '.cfh-badge').textContent).toBe('No trades since 1 Oct 2026');
    expect(shown(change(element))).toBe(false);
  });

  it('falls back safely on unknown values', async () => {
    always('coins-unknown-values');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('data');
    expect(change(element).className).toBe('cfh-chg cfh-down');
    expect(change(element).textContent).toBe('▼ −1.34% 24h');
    expect(shown(part(element, '.cfh-badge'))).toBe(false);
    expect(logo(element).textContent).toBe('B');
    expect(element.shadowRoot?.textContent).not.toContain('New in v1.1');
  });

  it('shows what it has when fields are missing', async () => {
    always('coins-missing-fields');
    const element = await price({ coin: 'solana', api: freshBase() });
    expect(part(element, '.cfh-name').textContent).toBe('Solana');
    expect(part(element, '.cfh-price').textContent).toBe('$162.08');
    expect(part(element, '.cfh-sym').textContent).toBe('');
    expect(logo(element).textContent).toBe('S');
    expect(shown(change(element))).toBe(false);
    expect(shown(part(element, '.cfh-badge'))).toBe(false);
    expect(footText(element)).toBe('');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/solana');
  });

  it('writes text only, never HTML, and keeps the link and logo on CoinFinHub', async () => {
    always('coins-hostile');
    const element = await price({ coin: 'hostile', chart: '7d', api: freshBase() });
    const root = element.shadowRoot;
    expect(root?.querySelector('img, script, style, b, i, u, em')).toBeNull();
    // Only the widget's own drawings: the brand mark and the 7-day line.
    expect([...(root?.querySelectorAll('svg') ?? [])].map((node) => node.getAttribute('class'))).toEqual(['cfh-spark cfh-up', 'cfh-mark']);
    expect(root?.querySelectorAll('a')).toHaveLength(1);
    expect(part(element, '.cfh-name').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(part(element, '.cfh-sym').textContent).toBe('"><svg onload=alert(1)>');
    expect(part(element, '.cfh-price').textContent).toBe('$1.00');
    expect(shown(part(element, '.cfh-badge'))).toBe(false);
    // Only the widget's own words from the rate, whatever it holds.
    expect(footText(element)).toBe('USD rate derived from ECB data');
    expect(root?.textContent).not.toMatch(/<style>|<b>|<i>|<script>/);
    expect(change(element).className).toBe('cfh-chg cfh-up');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/hostile');
  });

  it('shows the error state for a 200 without a price', async () => {
    always('bad-no-price');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('error');
    expect(statusText(element)).toBe('Price unavailable right now.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });
});

describe('the 7-day line', () => {
  it('draws the line with chart="7d", coloured by the week (not the day), with its label', async () => {
    const mock = stubFetch(sparkWithFall);
    const api = freshBase();
    const bitcoin = await price({ coin: 'bitcoin', chart: '7d', api });
    const ethereum = await price({ coin: 'ethereum', chart: '7D', api });
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD&spark=7d', 'ids=ethereum&currency=USD&spark=7d']);
    const line = part(bitcoin, '.cfh-spark');
    expect(shown(part(bitcoin, '.cfh-chart'))).toBe(true);
    expect(line.getAttribute('class')).toBe('cfh-spark cfh-up');
    expect(line.getAttribute('role')).toBe('img');
    expect(line.getAttribute('aria-label')).toBe('Price over 7 days, up');
    const week = coinOf('coins-spark', 'bitcoin').sparkline7d ?? [];
    expect(part(bitcoin, '.cfh-line').getAttribute('points')?.split(' ')).toHaveLength(week.length);
    expect(part(bitcoin, '.cfh-area').getAttribute('points')).toMatch(/^0,32 0,[\d.]+ .* 120,32$/);
    expect(part(bitcoin, '.cfh-chart .cfh-per').textContent).toBe('7d');
    expect(part(ethereum, '.cfh-spark').getAttribute('class')).toBe('cfh-spark cfh-down');
    expect(part(ethereum, '.cfh-spark').getAttribute('aria-label')).toBe('Price over 7 days, down');
  });

  it('draws nothing without chart="7d", or without a line', async () => {
    const mock = stubFetch((url) => only(['coins-top'], url));
    const api = freshBase();
    const plain = await price({ coin: 'bitcoin', chart: 'none', api });
    const asked = await price({ coin: 'ethereum', chart: '7d', api });
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=ethereum&currency=USD&spark=7d']);
    expect(shown(part(plain, '.cfh-chart'))).toBe(false);
    expect(shown(part(asked, '.cfh-chart'))).toBe(false);
  });

  it('asks again when chart changes', async () => {
    const mock = stubFetch((url) => only(['coins-spark'], url));
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    element.setAttribute('chart', '7d');
    await settle();
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=bitcoin&currency=USD&spark=7d']);
    expect(shown(part(element, '.cfh-chart'))).toBe(true);
  });
});

describe('errors', () => {
  it('asks for a coin when there is none, without a request', async () => {
    const mock = always('coins-usd');
    const element = await price({ coin: '  ', api: freshBase() });
    expect(mock).not.toHaveBeenCalled();
    expect(state(element)).toBe('error');
    expect(statusText(element)).toBe('Add a coin, for example coin="bitcoin".');
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it("names a coin CoinFinHub doesn't know and links to the home page", async () => {
    always('error-unknown-coin');
    const element = await price({ coin: 'no-such-coin', api: freshBase() });
    expect(statusText(element)).toBe('CoinFinHub has no page for this coin.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it('says the same when the coin is missing from a call shared with other widgets', async () => {
    stubFetch((url) => only(['coins-top'], url));
    const api = freshBase();
    const elements = [document.createElement('coinfinhub-price'), document.createElement('coinfinhub-price')];
    elements[0]?.setAttribute('coin', 'bitcoin');
    elements[1]?.setAttribute('coin', 'no-such-coin');
    for (const element of elements) {
      element.setAttribute('api', api);
      document.body.append(element);
    }
    await settle();
    const [bitcoin, missing] = elements as [HTMLElement, HTMLElement];
    expect(state(bitcoin)).toBe('data');
    expect(statusText(missing)).toBe('CoinFinHub has no page for this coin.');
    expect(link(missing).href).toBe('https://www.coinfinhub.com/');
  });

  it.each(['Bit Coin', 'top=3', 'bitcoin,ethereum', '-bitcoin'])(
    'says %j is not a coin name, as the endpoint would, without asking',
    async (coin) => {
      const mock = always('coins-top');
      const bad = await price({ coin, api: freshBase() });
      expect(mock).not.toHaveBeenCalled();
      expect(state(bad)).toBe('error');
      expect(statusText(bad)).toBe((fixture('error-invalid-coin').error as { message: string }).message);
      expect(link(bad).href).toBe('https://www.coinfinhub.com/');
    },
  );

  it('passes on the message for a wrong currency', async () => {
    always('error-invalid-currency');
    const currency = await price({ coin: 'bitcoin', currency: 'XYZ', api: freshBase() });
    expect(statusText(currency)).toBe('Unknown currency. Use one of USD, EUR, GBP, JPY, CNY, INR, AUD or CHF.');
    expect(link(currency).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it.each(['error-widget-off', 'error-prices-unavailable', 'error-rate-limited'])(
    '%s shows the plain error',
    async (name) => {
      always(name);
      const element = await price({ coin: 'bitcoin', api: freshBase() });
      expect(state(element)).toBe('error');
      expect(statusText(element)).toBe('Price unavailable right now.');
      expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
    },
  );

  it("shows the server's message for a code it doesn't know", async () => {
    always('error-unknown-code');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('error');
    expect(statusText(element)).toBe((fixture('error-unknown-code').error as { message: string }).message);
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it("says why a blocked site's widgets show nothing, as the server words it", async () => {
    always('error-site-blocked');
    const element = await mount('coinfinhub-list', { top: '3', api: freshBase() });
    expect(state(element)).toBe('error');
    expect(statusText(element)).toBe('This site may not show CoinFinHub prices.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it("writes an unknown code's message as text, and the plain error when there is none", async () => {
    const message = 'Blocked. <a href="https://example.com">Why?</a>';
    let body: unknown = { error: { status: 403, code: 'site_blocked', message } };
    stubFetch(() => new Response(JSON.stringify(body), { status: 403 }));
    const element = await mount('coinfinhub-list', { top: '3', api: freshBase() });
    expect(statusText(element)).toBe(message);
    expect(element.shadowRoot?.querySelectorAll('a')).toHaveLength(1);
    body = { error: { status: 403, code: 'site_blocked' } };
    const bare = await mount('coinfinhub-list', { top: '3', api: freshBase() });
    expect(statusText(bare)).toBe('Prices unavailable right now.');
  });

  it('never rewrites the status on a refresh, so nothing is announced again', async () => {
    always('error-widget-off');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    const changes: MutationRecord[] = [];
    new MutationObserver((records) => changes.push(...records)).observe(part(element, '.cfh-status'), {
      childList: true,
      characterData: true,
      subtree: true,
    });
    await wait(300 * SECOND);
    await settle();
    expect(changes).toHaveLength(0);
  });
});

describe('refresh', () => {
  it('refreshes every widget on the page on one beat, so their coins go in one call', async () => {
    const mock = stubFetch((url) => only(['coins-usd'], url));
    const api = freshBase();
    await price({ coin: 'bitcoin', api });
    await wait(20 * SECOND);
    await price({ coin: 'ethereum', api });
    // At 60 s ethereum's price is 40 s old: still held, so only bitcoin is asked for. At 120 s both are due.
    await wait(100 * SECOND);
    expect(queries(mock)).toEqual([
      'ids=bitcoin&currency=USD',
      'ids=ethereum&currency=USD',
      'ids=bitcoin&currency=USD',
      'ids=bitcoin,ethereum&currency=USD',
    ]);
  });

  it('asks the server again at the first retry after a failure, not a held copy of it', async () => {
    const mock = inTurn('error-unknown-code', 'coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('error');
    await wait(10 * SECOND);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(state(element)).toBe('data');
  });

  it('refreshes every 60 s plus up to 10 s of jitter', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mock = always('coins-usd');
    await price({ coin: 'bitcoin', api: freshBase() });
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(65 * SECOND - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good price when a refresh fails', async () => {
    inTurn('coins-usd', 'error-prices-unavailable');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    await wait(MINUTE);
    await settle();
    expect(state(element)).toBe('data');
    expect(part(element, '.cfh-price').textContent).toBe(BITCOIN.price);
  });

  it('shows the error state once the price is over 10 minutes old', async () => {
    const mock = always('coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    mock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    // Refresh at 60 s, then retries at +10, +30, +90, +270 and +300 s: the price is 30 s old at the start.
    await wait(460 * SECOND);
    expect(mock).toHaveBeenCalledTimes(6);
    expect(state(element)).toBe('data');
    await wait(300 * SECOND);
    expect(mock).toHaveBeenCalledTimes(7);
    expect(state(element)).toBe('error');
    expect(statusText(element)).toBe('Price unavailable right now.');
    expect(shown(part(element, '.cfh-note'))).toBe(false);
    expect(footText(element)).toBe('');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it('retries after 10 s, then backs off to 5 minutes', async () => {
    const mock = offline();
    await price({ coin: 'bitcoin', api: freshBase() });
    const expected = [10, 30, 90, 270, 300, 300];
    for (const [index, seconds] of expected.entries()) {
      await wait(seconds * SECOND - 1);
      expect(mock).toHaveBeenCalledTimes(index + 1);
      await wait(1);
      expect(mock).toHaveBeenCalledTimes(index + 2);
    }
  });

  it('adds up to 5 s of jitter to the first retry', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999_999);
    const mock = offline();
    await price({ coin: 'bitcoin', api: freshBase() });
    await wait(15 * SECOND - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('waits as retryAfter says', async () => {
    const mock = inTurn('error-rate-limited', 'coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('error');
    await wait(MINUTE - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(1);
    await settle();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(state(element)).toBe('data');
  });

  it('pauses while the tab is hidden', async () => {
    const mock = always('coins-usd');
    await price({ coin: 'bitcoin', api: freshBase() });
    setHidden(true);
    await wait(5 * MINUTE);
    expect(mock).toHaveBeenCalledTimes(1);
    setHidden(false);
    await settle();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('waits until it is on screen, and pauses when scrolled away', async () => {
    screen.on = false;
    const mock = always('coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(mock).not.toHaveBeenCalled();
    expect(state(element)).toBe('loading');
    scroll(element, true);
    await settle();
    expect(mock).toHaveBeenCalledTimes(1);
    scroll(element, false);
    await wait(5 * MINUTE);
    expect(mock).toHaveBeenCalledTimes(1);
    scroll(element, true);
    await settle();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('stops when removed, and keeps its price when moved', async () => {
    const mock = always('coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    const other = document.createElement('section');
    document.body.append(other);
    other.append(element);
    await settle();
    expect(state(element)).toBe('data');
    expect(mock).toHaveBeenCalledTimes(1);
    element.remove();
    await wait(5 * MINUTE);
    expect(mock).toHaveBeenCalledTimes(1);
    other.append(element);
    expect(state(element)).toBe('data');
    await settle();
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('requests', () => {
  it('shares one call between widgets on screen together, whatever coins they show', async () => {
    const mock = stubFetch((url) => only(['coins-usd'], url));
    const api = freshBase();
    for (const coin of ['bitcoin', 'ethereum', 'bitcoin', 'Tether']) {
      const element = document.createElement('coinfinhub-price');
      element.setAttribute('coin', coin);
      element.setAttribute('api', api);
      document.body.append(element);
    }
    await settle();
    expect(queries(mock)).toEqual(['ids=bitcoin,ethereum,tether&currency=USD']);
    expect(parts(document.body.lastElementChild as HTMLElement, '.cfh-name')[0]?.textContent).toBe('Tether');
  });

  it('asks for each coin and currency at most once a minute, however often attributes change', async () => {
    const mock = stubFetch((url) => respond(url.searchParams.get('currency') === 'INR' ? 'coins-inr' : 'coins-usd'));
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    for (const currency of ['INR', 'USD', 'INR', 'USD', 'INR']) {
      element.setAttribute('currency', currency);
      await settle();
    }
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=bitcoin&currency=INR']);
  });

  it('fetches again when the coin changes, but not for the theme', async () => {
    const mock = stubFetch((url) => only(['coins-top'], url));
    const element = await price({ coin: 'bitcoin', theme: 'light', api: freshBase() });
    element.setAttribute('theme', 'dark');
    await settle();
    expect(mock).toHaveBeenCalledTimes(1);
    element.setAttribute('coin', 'ethereum');
    expect(state(element)).toBe('loading');
    await settle();
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=USD', 'ids=ethereum&currency=USD']);
  });

  it('asks widgets.coinfinhub.com, also when api is not an http(s) URL, or the api given, without its trailing slashes', async () => {
    const mock = always('coins-usd');
    await price({ coin: 'default-test' });
    await price({ coin: 'guard-test', api: 'javascript:alert(1)' });
    await price({ coin: 'bitcoin', api: 'http://localhost:8090/api/widget/' });
    await price({ coin: 'bitcoin', api: 'https://slashes.test//' });
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      'https://widgets.coinfinhub.com/v1/coins?ids=default-test&currency=USD',
      'https://widgets.coinfinhub.com/v1/coins?ids=guard-test&currency=USD',
      'http://localhost:8090/api/widget/v1/coins?ids=bitcoin&currency=USD',
      'https://slashes.test/v1/coins?ids=bitcoin&currency=USD',
    ]);
  });
});

describe('a currency without a rate', () => {
  it('shows the USD price, labelled, and asks for the currency again after retryAfter', async () => {
    let inr = 'error-rate-unavailable';
    const mock = stubFetch((url) => respond(url.searchParams.get('currency') === 'INR' ? inr : 'coins-usd'));
    const element = await price({ coin: 'bitcoin', currency: 'INR', api: freshBase() });
    expect(queries(mock)).toEqual(['ids=bitcoin&currency=INR', 'ids=bitcoin&currency=USD']);
    expect(state(element)).toBe('data');
    expect(part(element, '.cfh-price').textContent).toBe(BITCOIN.price);
    expect(noteText(element)).toBe('Shown in US dollars: no INR rate right now.');
    expect(footText(element)).toBe('');

    inr = 'coins-inr';
    await wait(10 * MINUTE);
    await settle();
    expect(queries(mock).filter((query) => query.endsWith('INR'))).toHaveLength(2);
    expect(part(element, '.cfh-price').textContent).toBe('₹82,99,733.90');
    expect(shown(part(element, '.cfh-note'))).toBe(false);
    // The fixture's prices are over 10 minutes old by now.
    expect(footText(element)).toBe('Updated 10 min ago · USD rate derived from ECB data');
  });
});

describe('the age note', () => {
  /** When the fixtures' prices were read (their updatedAt). */
  const READ = Date.parse('2026-10-06T10:55:01.352Z');
  /** A price card, mounted when the fixtures' prices are `ago` old. */
  function agedBy(ago: number, attributes: Record<string, string> = {}) {
    vi.setSystemTime(READ + ago);
    return price({ coin: 'bitcoin', ...attributes, api: freshBase() });
  }

  it.each([
    ['2:59', 2 * MINUTE + 59 * SECOND, ''],
    ['3:00', 3 * MINUTE, ''],
    ['3:01', 3 * MINUTE + SECOND, 'Updated 3 min ago'],
    ['59:59', 59 * MINUTE + 59 * SECOND, 'Updated 59 min ago'],
    ['1:00:00', HOUR, 'Updated 1 h ago'],
    ['26:30:00', 26 * HOUR + 30 * MINUTE, 'Updated 26 h ago'],
  ])('prices %s old: %j', async (_, ago, text) => {
    always('coins-usd');
    const element = await agedBy(ago);
    expect(state(element)).toBe('data');
    expect(footText(element)).toBe(text);
  });

  it('comes before the rate label, joined by a dot', async () => {
    always('coins-inr');
    const element = await agedBy(4 * MINUTE + 10 * SECOND, { currency: 'INR' });
    expect(footText(element)).toBe('Updated 4 min ago · USD rate derived from ECB data');
  });

  it('goes by the newest price the widget shows', async () => {
    stubFetch((url) => {
      const body = fixture('coins-usd') as { coins: { slug: string; updatedAt: string }[] };
      const ethereum = body.coins.find((coin) => coin.slug === 'ethereum');
      if (ethereum) ethereum.updatedAt = new Date(READ + 2 * MINUTE).toISOString();
      const ids = url.searchParams.get('ids')?.split(',') ?? [];
      return new Response(JSON.stringify({ ...body, coins: body.coins.filter((coin) => ids.includes(coin.slug)) }));
    });
    vi.setSystemTime(READ + 4 * MINUTE);
    const api = freshBase();
    const both = await mount('coinfinhub-list', { coins: 'bitcoin,ethereum', api });
    const bitcoin = await mount('coinfinhub-list', { coins: 'bitcoin', api });
    expect(footText(both)).toBe('');
    expect(footText(bitcoin)).toBe('Updated 4 min ago');
  });

  it('is worked out again on every beat of the refresh clock, also off screen', async () => {
    const mock = always('coins-usd');
    const element = await agedBy(2 * MINUTE + 30 * SECOND);
    expect(footText(element)).toBe('');
    scroll(element, false);
    await wait(MINUTE);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(footText(element)).toBe('Updated 3 min ago');
  });

  it('says how old the kept prices are while refreshes fail', async () => {
    inTurn('coins-usd', 'error-prices-unavailable');
    const element = await agedBy(30 * SECOND);
    // The refresh at 60 s fails, and so do the retries at 120 and 180 s (retryAfter 60): the price is then 3:30 old.
    await wait(3 * MINUTE);
    await settle();
    expect(state(element)).toBe('data');
    expect(footText(element)).toBe('Updated 3 min ago');
  });

  /** Answers coins-usd with `now` from a server clock `ahead` of the browser's, or none (null), or `now` as given. */
  function serverClock(ahead: number | null, now?: unknown) {
    return stubFetch(() => {
      const body = fixture('coins-usd');
      if (ahead !== null) body.now = new Date(Date.now() + ahead).toISOString();
      else if (now === undefined) delete body.now;
      else body.now = now;
      return new Response(JSON.stringify(body));
    });
  }

  it.each([
    ['2 h slow', 2 * HOUR],
    ['2 h fast', -2 * HOUR],
    ['a day fast', -24 * HOUR],
  ])("goes by the server's clock when the visitor's is %s, also between refreshes", async (_, ahead) => {
    serverClock(ahead);
    // By the server's clock, the price is 4 minutes old.
    const element = await agedBy(4 * MINUTE - ahead);
    expect(footText(element)).toBe('Updated 4 min ago');
    // Off screen, nothing is asked for; the next beat works the age out again, on the same offset.
    scroll(element, false);
    await wait(MINUTE);
    expect(footText(element)).toBe('Updated 5 min ago');
  });

  it.each([
    ['no now', undefined],
    ['a now that isn’t a time', 'in a moment'],
  ])("goes by the visitor's clock on an answer with %s", async (_, now) => {
    serverClock(null, now);
    const right = await agedBy(4 * MINUTE);
    expect(state(right)).toBe('data');
    expect(footText(right)).toBe('Updated 4 min ago');
    expect(footText(await agedBy(2 * HOUR + 4 * MINUTE))).toBe('Updated 2 h ago');
  });

  it('is empty while loading and in the error state', async () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    expect(footText(await agedBy(HOUR))).toBe('');
    always('error-prices-unavailable');
    expect(footText(await agedBy(HOUR))).toBe('');
  });
});

describe('definition', () => {
  it('defines all four elements once, even when the script loads twice', async () => {
    const names = ['coinfinhub-price', 'coinfinhub-list', 'coinfinhub-ticker', 'coinfinhub-converter'];
    const first = names.map((name) => customElements.get(name));
    expect(first.every(Boolean)).toBe(true);
    vi.resetModules();
    await expect(import('../src/coinfinhub-widget')).resolves.toBeDefined();
    expect(names.map((name) => customElements.get(name))).toEqual(first);
  });

  it('adopts one shared stylesheet, and one of its own for its width', async () => {
    always('coins-usd');
    const api = freshBase();
    const one = await price({ coin: 'bitcoin', api });
    const two = await mount('coinfinhub-list', { coins: 'bitcoin', api });
    expect(one.shadowRoot?.adoptedStyleSheets).toHaveLength(2);
    expect(one.shadowRoot?.adoptedStyleSheets[0]).toBe(two.shadowRoot?.adoptedStyleSheets[0]);
    expect(one.shadowRoot?.adoptedStyleSheets[1]).not.toBe(two.shadowRoot?.adoptedStyleSheets[1]);
  });
});

describe('width, background and border', () => {
  /** The rules of the widget's own sheet. */
  const own = (element: HTMLElement): string =>
    [...(element.shadowRoot?.adoptedStyleSheets[1]?.cssRules ?? [])].map((rule) => rule.cssText).join(' ');

  it('takes its maximum width from width, never below 200 px, and fills the container without one', async () => {
    const mock = always('coins-usd');
    const element = await price({ coin: 'bitcoin', width: '320', api: freshBase() });
    expect(own(element)).toMatch(/:host\s*\{\s*max-width:\s*320px/);
    const cases: [string, RegExp][] = [
      ['120', /max-width:\s*200px/],
      ['480.4', /max-width:\s*480px/],
      ['0', /^$/],
      ['', /^$/],
      ['wide', /^$/],
      ['300px', /^$/],
      ['-50', /^$/],
      ['1e9', /^$/],
    ];
    for (const [width, expected] of cases) {
      element.setAttribute('width', width);
      expect(own(element), width).toMatch(expected);
    }
    element.removeAttribute('width');
    expect(own(element)).toBe('');
    await settle();
    // Only the look changed: no new request, and the host's own style attribute is never written.
    expect(mock).toHaveBeenCalledTimes(1);
    expect(state(element)).toBe('data');
    expect(element.getAttribute('style')).toBeNull();
  });

  it('keeps the ticker at least 240 px wide', async () => {
    always('coins-top');
    const ticker = await mount('coinfinhub-ticker', { width: '200', api: freshBase() });
    expect(own(ticker)).toMatch(/max-width:\s*240px/);
  });

  it('changes background and border without asking again', async () => {
    const mock = always('coins-usd');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    element.setAttribute('background', 'transparent');
    element.setAttribute('border', 'none');
    await settle();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(state(element)).toBe('data');
  });
});
