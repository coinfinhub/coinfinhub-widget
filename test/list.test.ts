import { describe, expect, it } from 'vitest';
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

  it('shows the top 5 by default, or as many as top says, from 1 to 20', async () => {
    const mock = top();
    const api = freshBase();
    const five = await mount('coinfinhub-list', { api });
    await mount('coinfinhub-list', { top: '3', api });
    await mount('coinfinhub-list', { top: '50', api });
    await mount('coinfinhub-list', { top: 'many', api });
    await mount('coinfinhub-list', { top: '0', api });
    expect(queries(mock)).toEqual(['top=5&currency=USD', 'top=3&currency=USD', 'top=20&currency=USD']);
    expect(names(five)).toHaveLength((fixture('coins-top').coins as unknown[]).length);
  });

  it('takes coins over top, and at most 20 of them', async () => {
    const mock = byIds('coins-top');
    const coins = Array.from({ length: 25 }, (_, i) => `coin-${String(i)}`);
    await mount('coinfinhub-list', { coins: `bitcoin,${coins.join(',')}`, top: '3', api: freshBase() });
    expect(queries(mock)).toEqual([`ids=bitcoin,${coins.slice(0, 19).join(',')}&currency=USD`]);
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
    expect(queries(mock)).toEqual(['top=10&currency=USD']);
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

  it('moves at the same speed whatever the number of coins', async () => {
    byIds('coins-usd');
    const four = await mount('coinfinhub-ticker', { coins: 'bitcoin,ethereum,tether,quietcoin', api: freshBase() });
    expect(part(four, '.cfh-track').style.animationDuration).toBe('20s');
  });

  it('takes coins, and top from 1 to 20', async () => {
    const mock = stubFetch((url) => (url.searchParams.has('top') ? respond('coins-top') : only(['coins-top'], url)));
    const api = freshBase();
    await mount('coinfinhub-ticker', { coins: 'bitcoin,ethereum', api });
    await mount('coinfinhub-ticker', { top: '4', api });
    expect(queries(mock)).toEqual(['ids=bitcoin,ethereum&currency=USD', 'top=4&currency=USD']);
  });
});
