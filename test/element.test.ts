import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/coinfinhub-price';
import { fixture, freshBase, pairs, respond, stubFetch } from './helpers';

const TIP =
  'Compared with the combined value of the coins CoinFinHub lists. This is analysis of past prices, not a prediction or financial advice.';
const SECOND = 1_000;
const MINUTE = 60_000;

// IntersectionObserver, controlled by the tests: every widget starts on screen unless a test says otherwise.
let onScreen = true;
const observed = new Map<Element, (visible: boolean) => void>();
class FakeObserver {
  readonly #callback: IntersectionObserverCallback;
  #target: Element | null = null;
  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }
  observe(target: Element): void {
    this.#target = target;
    const fire = (isIntersecting: boolean): void => {
      this.#callback([{ isIntersecting, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    };
    observed.set(target, fire);
    queueMicrotask(() => {
      fire(onScreen);
    });
  }
  disconnect(): void {
    if (this.#target) observed.delete(this.#target);
  }
}
const scroll = (element: Element, visible: boolean): void => observed.get(element)?.(visible);

let hidden = false;
function setHidden(value: boolean): void {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Flushes the promise chain between a request and the render. */
const settle = () => vi.advanceTimersByTimeAsync(0);
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

async function mount(attributes: Record<string, string>, parent: Element = document.body): Promise<HTMLElement> {
  const element = document.createElement('coinfinhub-price');
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  parent.append(element);
  await settle();
  return element;
}

function part(element: HTMLElement, selector: string): HTMLElement {
  const found = element.shadowRoot?.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`no ${selector}`);
  return found;
}
const card = (element: HTMLElement) => part(element, '.cfh-card');
const state = (element: HTMLElement) => card(element).dataset.state;
const status = (element: HTMLElement) => part(element, '.cfh-status');
const note = (element: HTMLElement) => part(element, '.cfh-note');
const link = (element: HTMLElement) => part(element, '.cfh-link') as HTMLAnchorElement;
const change = (element: HTMLElement) => part(element, '.cfh-chg');
const context = (element: HTMLElement) => part(element, '.cfh-ctx');
const rate = (element: HTMLElement) => part(element, '.cfh-foot').lastElementChild as HTMLElement;
const shown = (node: HTMLElement): boolean => !node.hidden;

/** One fixture for every request. */
const always = (name: string) => stubFetch(() => respond(name));

/** Answers in order, repeating the last one. */
function inTurn(...names: string[]) {
  let call = 0;
  return stubFetch(() => respond(names[Math.min(call++, names.length - 1)] ?? ''));
}

const offline = () => {
  const mock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
  vi.stubGlobal('fetch', mock);
  return mock;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:41:33.000Z'));
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  onScreen = true;
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('states', () => {
  it('shows "Loading price…" in a status region until the first answer', async () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('loading');
    expect(status(element).textContent).toBe('Loading price…');
    expect(status(element).getAttribute('role')).toBe('status');
    expect(shown(part(element, '.cfh-main'))).toBe(false);
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
    expect(link(element).textContent).toBe('Powered by CoinFinHub');
    expect(link(element).target).toBe('_blank');
    expect(link(element).rel).toBe('nofollow noopener');
  });

  it('shows the contract example', async () => {
    always('ok-inr');
    const element = await mount({ coin: 'bitcoin', currency: 'INR', api: freshBase() });
    expect(state(element)).toBe('data');
    expect(card(element).getAttribute('role')).toBe('group');
    expect(card(element).getAttribute('aria-label')).toBe('Bitcoin price');
    expect(card(element).lang).toBe('en');
    expect(part(element, '.cfh-name').textContent).toBe('Bitcoin');
    expect(part(element, '.cfh-sym').textContent).toBe('BTC');
    expect(part(element, '.cfh-price').textContent).toBe('₹75,86,424.40');
    expect(change(element).textContent).toBe('▼ −1.34% 24h');
    expect(change(element).className).toBe('cfh-chg cfh-down');
    expect(change(element).firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(part(element, '.cfh-lbl').textContent).toBe('Today');
    expect(context(element).textContent).toContain('Bitcoin slips 1.3%, in line with the market.');
    expect(context(element).tabIndex).toBe(0);
    const tip = part(element, '.cfh-tip');
    expect(tip.textContent).toBe(TIP);
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(context(element).getAttribute('aria-describedby')).toBe(tip.id);
    expect(rate(element).textContent).toBe('· USD rate derived from ECB data');
    expect(shown(note(element))).toBe(false);
    expect(shown(status(element))).toBe(false);
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it.each([
    ['ok-low', 'tinycoin', "Little trading: the price may be far from what you'd pay", 'cfh-chg cfh-up'],
    ['ok-quiet', 'quietcoin', 'Price last changed 7 hours ago', 'cfh-chg cfh-flat'],
    ['ok-old', 'ethereum', 'Updated 25 min ago', 'cfh-chg cfh-up'],
  ])('%s shows its note', async (name, coin, text, changeClass) => {
    always(name);
    const element = await mount({ coin, api: freshBase() });
    expect(note(element).textContent).toBe(text);
    expect(shown(note(element))).toBe(true);
    expect(change(element).className).toBe(changeClass);
  });

  it('shows a flat change with a dot', async () => {
    always('ok-quiet');
    const element = await mount({ coin: 'quietcoin', api: freshBase() });
    expect(change(element).textContent).toBe('• 0.00% 24h');
  });

  it('shows a stopped coin with its note and no change or Today line', async () => {
    always('ok-stopped');
    const element = await mount({ coin: 'oldcoin', api: freshBase() });
    expect(part(element, '.cfh-price').textContent).toBe('$0.0731');
    expect(shown(change(element))).toBe(false);
    expect(shown(context(element))).toBe(false);
    expect(note(element).textContent).toBe('No trades since 12 Oct 2026: this is the last price');
  });

  it("shows a stablecoin's peg sentence, with what a peg is in its tip", async () => {
    always('ok-stablecoin');
    const element = await mount({ coin: 'tether', api: freshBase() });
    expect(context(element).textContent).toContain('Tether holds its $1 peg.');
    expect(part(element, '.cfh-tip').textContent).toBe(
      'Tether is a stablecoin: its issuer aims to keep it worth one US dollar. This is analysis of past prices, not a prediction or financial advice.',
    );
  });

  it('falls back safely on unknown values', async () => {
    always('ok-unknown-values');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('data');
    expect(change(element).className).toBe('cfh-chg');
    expect(change(element).textContent).toBe(' −1.34% 24h');
    expect(shown(note(element))).toBe(false);
    expect(element.shadowRoot?.textContent).not.toContain('New in v1.1');
  });

  it('shows what it has when fields are missing', async () => {
    always('ok-missing-fields');
    const element = await mount({ coin: 'solana', api: freshBase() });
    expect(part(element, '.cfh-name').textContent).toBe('Solana');
    expect(part(element, '.cfh-price').textContent).toBe('$162.08');
    expect(part(element, '.cfh-sym').textContent).toBe('');
    expect(shown(change(element))).toBe(false);
    expect(shown(context(element))).toBe(false);
    expect(shown(note(element))).toBe(false);
    expect(rate(element).textContent).toBe('');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/solana');
  });

  it('keeps the Today line only with its definition', async () => {
    stubFetch(() => {
      const body = fixture('ok-usd') as { display: Record<string, unknown> };
      body.display.contextTip = null;
      return new Response(JSON.stringify(body));
    });
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    expect(shown(context(element))).toBe(false);
  });

  it('writes text only, never HTML, and keeps the link on CoinFinHub', async () => {
    always('ok-usd');
    const plain = await mount({ coin: 'bitcoin', api: freshBase() });
    const elements = plain.shadowRoot?.querySelectorAll('*').length;
    always('ok-hostile');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    const root = element.shadowRoot;
    expect(root?.querySelectorAll('*').length).toBe(elements);
    expect(root?.querySelector('img, script, svg, style, b, i, u, em')).toBeNull();
    expect(root?.querySelectorAll('a').length).toBe(1);
    expect(part(element, '.cfh-name').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(part(element, '.cfh-price').textContent).toBe('<b>$1.00</b>');
    expect(rate(element).textContent).toBe('· <style>*{display:none}</style>');
    expect(change(element).className).toBe('cfh-chg');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it('shows the error state for a 200 without a price', async () => {
    always('bad-no-price');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('error');
    expect(status(element).textContent).toBe('Price unavailable right now.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });
});

describe('errors', () => {
  it('asks for a coin when there is none, without a request', async () => {
    const mock = always('ok-usd');
    const element = await mount({ api: freshBase() });
    expect(mock).not.toHaveBeenCalled();
    expect(state(element)).toBe('error');
    expect(status(element).textContent).toBe('Add a coin, for example coin="bitcoin".');
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it("names an unknown coin and links to CoinFinHub's home page", async () => {
    always('error-unknown-coin');
    const element = await mount({ coin: 'no-such-coin', api: freshBase() });
    expect(status(element).textContent).toBe('CoinFinHub has no page for this coin.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/');
  });

  it('passes on the message for a wrong currency', async () => {
    always('error-invalid-currency');
    const element = await mount({ coin: 'bitcoin', currency: 'XYZ', api: freshBase() });
    expect(status(element).textContent).toBe('Unknown currency. Use one of USD, EUR, GBP, JPY, CNY, INR, AUD or CHF.');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it.each(['error-widget-off', 'error-prices-unavailable', 'error-rate-limited', 'error-unknown-code'])(
    '%s shows the plain error',
    async (name) => {
      always(name);
      const element = await mount({ coin: 'bitcoin', api: freshBase() });
      expect(state(element)).toBe('error');
      expect(status(element).textContent).toBe('Price unavailable right now.');
      expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
    },
  );

  it('never rewrites the status on a refresh, so nothing is announced again', async () => {
    always('error-widget-off');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    const changes: MutationRecord[] = [];
    new MutationObserver((records) => changes.push(...records)).observe(status(element), {
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
  it('refreshes every 60 s plus up to 10 s of jitter', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mock = always('ok-usd');
    await mount({ coin: 'bitcoin', api: freshBase() });
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(65 * SECOND - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good price when a refresh fails', async () => {
    inTurn('ok-usd', 'error-prices-unavailable');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    await wait(MINUTE);
    await settle();
    expect(state(element)).toBe('data');
    expect(part(element, '.cfh-price').textContent).toBe('$86,091.97');
  });

  it('shows the error state, with the age, once the price is over 10 minutes old', async () => {
    const mock = stubFetch(() => respond('ok-usd'));
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    mock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    // Refresh at 60 s, then retries at +10, +30, +90, +270 and +300 s: the price is 30 s old at the start.
    await wait(460 * SECOND);
    expect(mock).toHaveBeenCalledTimes(6);
    expect(state(element)).toBe('data');
    await wait(300 * SECOND);
    expect(mock).toHaveBeenCalledTimes(7);
    expect(state(element)).toBe('error');
    expect(status(element).textContent).toBe('Price unavailable right now.');
    expect(note(element).textContent).toBe('Updated 13 minutes ago');
    expect(link(element).href).toBe('https://www.coinfinhub.com/price/bitcoin');
  });

  it('retries after 10 s, then backs off to 5 minutes', async () => {
    const mock = offline();
    await mount({ coin: 'bitcoin', api: freshBase() });
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
    await mount({ coin: 'bitcoin', api: freshBase() });
    await wait(15 * SECOND - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('waits as retryAfter says', async () => {
    const mock = inTurn('error-rate-limited', 'ok-usd');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    expect(state(element)).toBe('error');
    await wait(MINUTE - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await wait(1);
    await settle();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(state(element)).toBe('data');
  });

  it('pauses while the tab is hidden', async () => {
    const mock = always('ok-usd');
    await mount({ coin: 'bitcoin', api: freshBase() });
    setHidden(true);
    await wait(5 * MINUTE);
    expect(mock).toHaveBeenCalledTimes(1);
    setHidden(false);
    await settle();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('waits until it is on screen, and pauses when scrolled away', async () => {
    onScreen = false;
    const mock = always('ok-usd');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
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
    const mock = always('ok-usd');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
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
  it('shares one request between widgets showing the same coin and currency', async () => {
    const mock = always('ok-usd');
    const api = freshBase();
    await mount({ coin: 'bitcoin', api });
    await mount({ coin: 'bitcoin', api });
    await mount({ coin: 'bitcoin', currency: 'usd', api });
    await mount({ coin: 'bitcoin', currency: 'INR', api });
    expect(pairs(mock)).toEqual(['bitcoin USD', 'bitcoin INR']);
  });

  it('asks for each pair at most once a minute, however often attributes change', async () => {
    const mock = always('ok-usd');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    for (const currency of ['INR', 'USD', 'INR', 'USD', 'INR']) {
      element.setAttribute('currency', currency);
      await settle();
    }
    expect(pairs(mock)).toEqual(['bitcoin USD', 'bitcoin INR']);
  });

  it('fetches again when the coin changes, but not for the theme', async () => {
    const mock = always('ok-usd');
    const element = await mount({ coin: 'bitcoin', theme: 'light', api: freshBase() });
    element.setAttribute('theme', 'dark');
    await settle();
    expect(mock).toHaveBeenCalledTimes(1);
    element.setAttribute('coin', 'ethereum');
    expect(state(element)).toBe('loading');
    await settle();
    expect(pairs(mock)).toEqual(['bitcoin USD', 'ethereum USD']);
  });

  it('uses the real endpoint when api is not an http(s) URL, and trims slashes', async () => {
    const mock = always('ok-usd');
    await mount({ coin: 'guard-test', api: 'javascript:alert(1)' });
    await mount({ coin: 'bitcoin', api: 'https://slashes.test//' });
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      'https://www.coinfinhub.com/api/widget/v1/price/guard-test?currency=USD',
      'https://slashes.test/api/widget/v1/price/bitcoin?currency=USD',
    ]);
  });
});

describe('a currency without a rate', () => {
  it('shows the USD price, labelled, and asks for the currency again after retryAfter', async () => {
    let inr = 'error-rate-unavailable';
    const mock = stubFetch((url) => respond(url.searchParams.get('currency') === 'INR' ? inr : 'ok-usd'));
    const element = await mount({ coin: 'bitcoin', currency: 'INR', api: freshBase() });
    expect(pairs(mock)).toEqual(['bitcoin INR', 'bitcoin USD']);
    expect(state(element)).toBe('data');
    expect(part(element, '.cfh-price').textContent).toBe('$86,091.97');
    expect(note(element).textContent).toBe('Shown in US dollars: no INR rate right now.');
    expect(rate(element).textContent).toBe('');

    inr = 'ok-inr';
    await wait(10 * MINUTE);
    await settle();
    expect(pairs(mock).filter((pair) => pair === 'bitcoin INR')).toHaveLength(2);
    expect(part(element, '.cfh-price').textContent).toBe('₹75,86,424.40');
    expect(shown(note(element))).toBe(false);
    expect(rate(element).textContent).toBe('· USD rate derived from ECB data');
  });
});

describe('the Today tip', () => {
  it('opens on tap and closes on a second tap', async () => {
    always('ok-usd');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    const line = context(element);
    line.dispatchEvent(new PointerEvent('pointerdown'));
    line.click();
    expect(element.shadowRoot?.activeElement).toBe(line);
    expect(line.classList.contains('cfh-shut')).toBe(false);
    line.dispatchEvent(new PointerEvent('pointerdown'));
    line.click();
    expect(line.classList.contains('cfh-shut')).toBe(true);
    line.blur();
    expect(line.classList.contains('cfh-shut')).toBe(false);
  });

  it('closes with Escape only when open', async () => {
    always('ok-usd');
    const element = await mount({ coin: 'bitcoin', api: freshBase() });
    const line = context(element);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(line.classList.contains('cfh-shut')).toBe(false);
    line.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(line.classList.contains('cfh-shut')).toBe(true);
  });
});

describe('definition', () => {
  it('is defined once, even when the script loads twice', async () => {
    const first = customElements.get('coinfinhub-price');
    expect(first).toBeDefined();
    vi.resetModules();
    await expect(import('../src/coinfinhub-price')).resolves.toBeDefined();
    expect(customElements.get('coinfinhub-price')).toBe(first);
  });

  it('adopts one shared stylesheet', async () => {
    always('ok-usd');
    const api = freshBase();
    const one = await mount({ coin: 'bitcoin', api });
    const two = await mount({ coin: 'bitcoin', api });
    expect(one.shadowRoot?.adoptedStyleSheets).toHaveLength(1);
    expect(one.shadowRoot?.adoptedStyleSheets[0]).toBe(two.shadowRoot?.adoptedStyleSheets[0]);
  });
});
