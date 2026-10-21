import { describe, expect, it, vi } from 'vitest';
import '../src/coinfinhub-widget';
import {
  coinOf,
  fixture,
  freshBase,
  link,
  mount,
  only,
  part,
  parts,
  queries,
  rateText,
  respond,
  settle,
  shown,
  state,
  statusText,
  stubFetch,
  useWidgetSetup,
  wait,
} from './helpers';

useWidgetSetup();

const names = (element: HTMLElement, item = '.cfh-item') =>
  parts(element, `${item} .cfh-name`).map((name) => name.textContent);
const top = () => stubFetch(() => respond('coins-top'));
const byIds = (...fixtures: string[]) => stubFetch((url) => only(fixtures, url));

describe('<coinfinhub-list>', () => {
  it('shows rows of coins in the order asked, and leaves out coins CoinFinHub does not know', async () => {
    const mock = byIds('coins-usd');
    const element = await mount('coinfinhub-list', { coins: 'ethereum, no-such-coin,Bitcoin,ethereum,haltcoin', api: freshBase() });
    expect(queries(mock)).toEqual(['ids=ethereum,no-such-coin,bitcoin,haltcoin&currency=USD']);
    expect(state(element)).toBe('data');
    expect(part(element, '.cfh-card').getAttribute('aria-label')).toBe('Coin prices');
    expect(names(element)).toEqual(['Ethereum', 'Bitcoin', 'Haltcoin']);
    const [ethereum, , halted] = parts(element, '.cfh-item');
    expect(ethereum?.tagName).toBe('LI');
    expect(ethereum?.querySelector('.cfh-sym')?.textContent).toBe('ETH');
    expect(ethereum?.querySelector('.cfh-price')?.textContent).toBe(coinOf('coins-usd', 'ethereum').display.price);
    expect(ethereum?.querySelector('.cfh-chg')?.textContent).toBe(`▼ ${String(coinOf('coins-usd', 'ethereum').display.change)} 24h`);
    expect(halted?.querySelector('.cfh-badge')?.textContent).toBe('No trades since 1 Oct 2026');
    expect((halted?.querySelector('.cfh-chg') as HTMLElement | null)?.hidden).toBe(true);
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it('shows the top 5 by default, or as many as top says, from 1 to 20, all cut from one call', async () => {
    const mock = top();
    const api = freshBase();
    const ranked = (fixture('coins-top').coins as unknown[]).length;
    const five = await mount('coinfinhub-list', { api });
    const three = await mount('coinfinhub-list', { top: '3', api });
    const fifty = await mount('coinfinhub-list', { top: '50', api });
    const many = await mount('coinfinhub-list', { top: 'many', api });
    const none = await mount('coinfinhub-list', { top: '0', api });
    expect(queries(mock)).toEqual(['top=20&currency=USD']);
    expect([five, three, fifty, many, none].map((list) => names(list).length)).toEqual([
      Math.min(5, ranked),
      3,
      Math.min(20, ranked),
      Math.min(5, ranked),
      Math.min(5, ranked),
    ]);
  });

  it('leaves out slugs that are not well-formed, without asking for them', async () => {
    const mock = byIds('coins-usd');
    const element = await mount('coinfinhub-list', { coins: 'bitcoin, bad slug!, top=3, ethereum', api: freshBase() });
    expect(queries(mock)).toEqual(['ids=bitcoin,ethereum&currency=USD']);
    expect(names(element)).toEqual(['Bitcoin', 'Ethereum']);
    const none = await mount('coinfinhub-list', { coins: 'bad slug!', api: freshBase() });
    expect(statusText(none)).toBe("That isn't a coin name. Use the end of the coin's page address, such as bitcoin.");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('leaves out a coin that came back unreadable, and shows the rest', async () => {
    stubFetch((url) => {
      const body = JSON.parse(JSON.stringify(fixture('coins-usd'))) as { coins: { slug: string; display: Record<string, unknown> }[] };
      const ethereum = body.coins.find((coin) => coin.slug === 'ethereum');
      if (ethereum) delete ethereum.display.price;
      const ids = url.searchParams.get('ids')?.split(',') ?? [];
      return new Response(JSON.stringify({ ...body, coins: body.coins.filter((coin) => ids.includes(coin.slug)) }));
    });
    const element = await mount('coinfinhub-list', { coins: 'bitcoin,ethereum,tether', api: freshBase() });
    expect(state(element)).toBe('data');
    expect(names(element)).toEqual(['Bitcoin', 'Tether']);
  });

  it('takes coins over top, and at most 20 of them', async () => {
    const mock = byIds('coins-top');
    const coins = Array.from({ length: 25 }, (_, i) => `coin-${String(i)}`);
    await mount('coinfinhub-list', { coins: `bitcoin,${coins.join(',')}`, top: '3', api: freshBase() });
    expect(queries(mock)).toEqual([`ids=bitcoin,${coins.slice(0, 19).join(',')}&currency=USD`]);
  });

  it('marks a logo shown as an image, so its circle has no tint behind it', async () => {
    // A logo address of its own, so marking it as failed never touches other tests.
    stubFetch((url) => {
      const body = only(['coins-top'], url);
      return body.json().then((json: { coins: { logo: string | null }[] }) => {
        const [first] = json.coins;
        if (first) first.logo = 'https://www.coinfinhub.com/coin-logos/small/bitcoin.png?v=tint';
        return new Response(JSON.stringify(json));
      });
    });
    const element = await mount('coinfinhub-list', { coins: 'bitcoin,ethereum', api: freshBase() });
    const [bitcoin, ethereum] = parts(element, '.cfh-logo');
    expect(bitcoin?.className).toBe('cfh-logo cfh-pic');
    expect(ethereum?.className).toBe('cfh-logo');
    bitcoin?.querySelector('img')?.dispatchEvent(new Event('error'));
    expect(bitcoin?.className).toBe('cfh-logo');
  });

  it('keeps its rows and logos between refreshes', async () => {
    byIds('coins-top');
    const element = await mount('coinfinhub-list', { coins: 'bitcoin,ethereum', api: freshBase() });
    const [row, image] = [part(element, '.cfh-item'), part(element, '.cfh-item img')];
    await wait(61_000);
    await settle();
    expect(part(element, '.cfh-item')).toBe(row);
    expect(part(element, '.cfh-item img')).toBe(image);
  });

  it('carries the rate label', async () => {
    stubFetch(() => respond('coins-inr'));
    const element = await mount('coinfinhub-list', { coins: 'bitcoin,ethereum', currency: 'INR', api: freshBase() });
    expect(parts(element, '.cfh-price').map((price) => price.textContent)).toEqual([
      coinOf('coins-inr', 'bitcoin').display.price,
      coinOf('coins-inr', 'ethereum').display.price,
    ]);
    expect(rateText(element)).toBe('· USD rate derived from ECB data');
  });

  it('switches to the strip with layout="strip", without asking again', async () => {
    const mock = top();
    const element = await mount('coinfinhub-list', { api: freshBase() });
    const row = part(element, '.cfh-item');
    element.setAttribute('layout', 'strip');
    await settle();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(part(element, '.cfh-item')).toBe(row);
  });

  it('speaks of prices, plural, while loading and on errors', async () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    const loading = await mount('coinfinhub-list', { api: freshBase() });
    expect(statusText(loading)).toBe('Loading prices…');
    expect(shown(part(loading, '.cfh-main'))).toBe(false);
    stubFetch(() => respond('error-prices-unavailable'));
    const down = await mount('coinfinhub-list', { api: freshBase() });
    expect(statusText(down)).toBe('Prices unavailable right now.');
    expect(link(down).href).toBe('https://www.coinfinhub.com/');
  });

  it('says so when it knows none of the coins', async () => {
    byIds('coins-top');
    const element = await mount('coinfinhub-list', { coins: 'no-such-coin,other-coin', api: freshBase() });
    expect(state(element)).toBe('error');
    expect(statusText(element)).toBe('CoinFinHub has no page for these coins.');
  });

  it('writes text only', async () => {
    byIds('coins-hostile');
    const element = await mount('coinfinhub-list', { coins: 'hostile', api: freshBase() });
    expect(element.shadowRoot?.querySelector('img, script, style, b, i, em')).toBeNull();
    expect([...(element.shadowRoot?.querySelectorAll('svg') ?? [])].map((node) => node.getAttribute('class'))).toEqual(['cfh-mark']);
    expect(names(element)).toEqual(['<img src=x onerror=alert(1)>']);
  });
});

describe('<coinfinhub-ticker>', () => {
  it('shows the top 10 by default, twice: the copy for the loop hidden and inert', async () => {
    const mock = top();
    const element = await mount('coinfinhub-ticker', { api: freshBase() });
    expect(queries(mock)).toEqual(['top=20&currency=USD']);
    const [run, copy] = parts(element, '.cfh-run');
    expect(run?.getAttribute('aria-hidden')).toBeNull();
    expect(copy?.getAttribute('aria-hidden')).toBe('true');
    expect(copy?.inert).toBe(true);
    expect(names(element, '.cfh-run:first-child .cfh-tick')).toEqual(names(element, '.cfh-run:last-child .cfh-tick'));
    expect(names(element, '.cfh-run:first-child .cfh-tick')).toHaveLength((fixture('coins-top').coins as unknown[]).length);
    expect(part(element, '.cfh-tick .cfh-sym').textContent).toBe('BTC');
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it('can be focused, to pause it or scroll it', async () => {
    top();
    const element = await mount('coinfinhub-ticker', { api: freshBase() });
    expect(part(element, '.cfh-view').tabIndex).toBe(0);
    expect(part(element, '.cfh-card').getAttribute('aria-label')).toBe('Coin prices');
  });

  it('repeats the run until half the track covers the view, and moves at the same speed however wide', async () => {
    // A ResizeObserver the test drives, and sizes the test sets: happy-dom lays nothing out.
    let resized: () => void = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(): void {
          // The test calls resized() itself.
        }
      },
    );
    byIds('coins-usd');
    const ticker = await mount('coinfinhub-ticker', { coins: 'bitcoin,ethereum', api: freshBase() });
    const view = part(ticker, '.cfh-view');
    const size = (viewWidth: number, runWidth: number): void => {
      Object.defineProperty(view, 'clientWidth', { configurable: true, value: viewWidth });
      for (const run of parts(ticker, '.cfh-run')) Object.defineProperty(run, 'offsetWidth', { configurable: true, value: runWidth });
      resized();
    };
    const runs = () => parts(ticker, '.cfh-run');
    // In the widget's own sheet, never an inline style (WebKit refuses those under a strict CSP).
    const duration = () => {
      const own = [...(ticker.shadowRoot?.adoptedStyleSheets[1]?.cssRules ?? [])].map((rule) => rule.cssText).join('');
      expect(part(ticker, '.cfh-track').getAttribute('style')).toBeNull();
      return /animation-duration:\s*(\d+s)/.exec(own)?.[1];
    };

    // Two coins, 300 px, in a 1,000 px view: 4 runs make the half that covers it, 8 in all; 1,200 px at 45 px/s.
    size(1000, 300);
    expect(runs()).toHaveLength(8);
    expect(duration()).toBe('27s');
    for (const copy of runs().slice(1)) {
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.inert).toBe(true);
    }
    expect(runs()[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(runs().every((run) => run.querySelectorAll('.cfh-tick').length === 2)).toBe(true);
    // A price a digit longer keeps the duration, so the strip never jumps.
    size(1000, 310);
    expect(duration()).toBe('27s');
    // A narrower view needs fewer copies, and the same speed: 2 × 600 px in 27 s.
    size(500, 600);
    expect(runs()).toHaveLength(2);
    expect(duration()).toBe('13s');
  });

  it('takes coins, and top from 1 to 20', async () => {
    const mock = stubFetch((url) => (url.searchParams.has('top') ? respond('coins-top') : only(['coins-top'], url)));
    const api = freshBase();
    await mount('coinfinhub-ticker', { coins: 'bitcoin,ethereum', api });
    const four = await mount('coinfinhub-ticker', { top: '4', api });
    expect(queries(mock)).toEqual(['ids=bitcoin,ethereum&currency=USD', 'top=20&currency=USD']);
    expect(names(four, '.cfh-run:first-child .cfh-tick')).toHaveLength(4);
  });
});
