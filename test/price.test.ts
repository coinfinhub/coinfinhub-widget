import { describe, expect, it, vi } from 'vitest';
import '../src/coinfinhub-widget';
import {
  coinOf,
  fixture,
  freshBase,
  link,
  mount,
  noteText,
  offline,
  only,
  part,
  parts,
  queries,
  rateText,
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
const BITCOIN = coinOf('coins-usd', 'bitcoin').display;

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
    expect(change(element).textContent).toBe(`▼ ${String(BITCOIN.change)} 24h`);
    expect(change(element).className).toBe('cfh-chg cfh-down');
    expect(change(element).firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    const image = part(element, '.cfh-logo img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=1');
    expect(image.alt).toBe('');
    expect(logo(element).getAttribute('aria-hidden')).toBe('true');
    expect(shown(part(element, '.cfh-badge'))).toBe(false);
    expect(shown(part(element, '.cfh-chart'))).toBe(false);
    expect(rateText(element)).toBe('');
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
    expect(part(element, '.cfh-price').textContent).toBe(coinOf('coins-inr', 'bitcoin').display.price);
    expect(rateText(element)).toBe('· USD rate derived from ECB data');
  });

  it('shows a badge for little trading', async () => {
    stubFetch((url) => only(['coins-usd'], url));
    const element = await price({ coin: 'quietcoin', api: freshBase() });
    expect(part(element, '.cfh-badge').textContent).toBe('Little trading');
    expect(shown(part(element, '.cfh-badge'))).toBe(true);
    expect(change(element).textContent).toBe(`▼ ${String(coinOf('coins-usd', 'quietcoin').display.change)} 24h`);
  });

  it('shows a change of 0.00% with a dot and no colour of up or down', async () => {
    stubFetch(() => {
      const body = fixture('coins-usd') as { coins: { display: Record<string, unknown> }[] };
      const [bitcoin] = body.coins;
      if (bitcoin) Object.assign(bitcoin.display, { change: '0.00%', direction: 'flat' });
      return new Response(JSON.stringify(body));
    });
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(change(element).textContent).toBe('• 0.00% 24h');
    expect(change(element).className).toBe('cfh-chg cfh-flat');
  });

  it('shows a stopped coin with its badge and no change', async () => {
    stubFetch((url) => only(['coins-usd'], url));
    const element = await price({ coin: 'haltcoin', api: freshBase() });
    expect(part(element, '.cfh-price').textContent).toBe(coinOf('coins-usd', 'haltcoin').display.price);
    expect(part(element, '.cfh-badge').textContent).toBe('No trades since 1 Oct 2026');
    expect(shown(change(element))).toBe(false);
  });

  it('falls back safely on unknown values', async () => {
    always('coins-unknown-values');
    const element = await price({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('data');
    expect(change(element).className).toBe('cfh-chg');
    expect(change(element).textContent).toBe(' −1.34% 24h');
    expect(part(element, '.cfh-badge').textContent).toBe('Paused');
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
    expect(rateText(element)).toBe('');
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
    expect(part(element, '.cfh-price').textContent).toBe('<b>$1.00</b>');
    expect(part(element, '.cfh-badge').textContent).toBe('<em>badge</em>');
    expect(rateText(element)).toBe('· <style>*{display:none}</style>');
    expect(change(element).className).toBe('cfh-chg');
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
    const week = (coinOf('coins-spark', 'bitcoin') as unknown as { sparkline7d: number[] }).sparkline7d;
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

  it.each(['error-widget-off', 'error-prices-unavailable', 'error-rate-limited', 'error-unknown-code'])(
    '%s shows the plain error',
    async (name) => {
      always(name);
      const element = await price({ coin: 'bitcoin', api: freshBase() });
      expect(state(element)).toBe('error');
      expect(statusText(element)).toBe('Price unavailable right now.');
      expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
    },
  );

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
    const mock = always('coins-usd');
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

  it('uses the real endpoint when api is not an http(s) URL, and trims slashes', async () => {
    const mock = always('coins-usd');
    await price({ coin: 'guard-test', api: 'javascript:alert(1)' });
    await price({ coin: 'bitcoin', api: 'https://slashes.test//' });
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      'https://www.coinfinhub.com/api/widget/v1/coins?ids=guard-test&currency=USD',
      'https://slashes.test/api/widget/v1/coins?ids=bitcoin&currency=USD',
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
    expect(rateText(element)).toBe('');

    inr = 'coins-inr';
    await wait(10 * MINUTE);
    await settle();
    expect(queries(mock).filter((query) => query.endsWith('INR'))).toHaveLength(2);
    expect(part(element, '.cfh-price').textContent).toBe(coinOf('coins-inr', 'bitcoin').display.price);
    expect(shown(part(element, '.cfh-note'))).toBe(false);
    expect(rateText(element)).toBe('· USD rate derived from ECB data');
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

  it('adopts one shared stylesheet', async () => {
    always('coins-usd');
    const api = freshBase();
    const one = await price({ coin: 'bitcoin', api });
    const two = await mount('coinfinhub-list', { coins: 'bitcoin', api });
    expect(one.shadowRoot?.adoptedStyleSheets).toHaveLength(1);
    expect(one.shadowRoot?.adoptedStyleSheets[0]).toBe(two.shadowRoot?.adoptedStyleSheets[0]);
  });
});
